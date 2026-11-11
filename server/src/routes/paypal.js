import { Router } from "express";
import Product from "../models/Product.js";
import Order from "../models/Order.js";

const router = Router();
const base = () => process.env.PAYPAL_BASE_URL || "https://api-m.sandbox.paypal.com";

async function paypalToken() {
  const id = process.env.PAYPAL_CLIENT_ID;
  const secret = process.env.PAYPAL_CLIENT_SECRET;
  if (!id || !secret) throw new Error("PayPal Sandbox credentials are not configured");
  const auth = Buffer.from(`${id}:${secret}`).toString("base64");
  const response = await fetch(`${base()}/v1/oauth2/token`, {
    method: "POST",
    headers: { Authorization: `Basic ${auth}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: "grant_type=client_credentials"
  });
  if (!response.ok) throw new Error("Could not authenticate with PayPal");
  return (await response.json()).access_token;
}

// Browser sends product IDs and quantities only. Prices are always loaded from MongoDB.
router.post("/create-order", async (req, res) => {
  try {
    const items = req.body.items;
    if (!Array.isArray(items) || !items.length) return res.status(400).json({ error: "Cart is empty" });
    const normalized = [];
    for (const item of items) {
      const quantity = Number(item.quantity);
      if (!Number.isInteger(quantity) || quantity < 1 || quantity > 20) return res.status(400).json({ error: "Invalid quantity" });
      const product = await Product.findOne({ _id: item.productId, active: true });
      if (!product || product.stock < quantity) return res.status(400).json({ error: "Product unavailable or insufficient stock" });
      normalized.push({ productId: product._id, name: product.name, quantity, unitPrice: product.price });
    }
    const total = Number(normalized.reduce((sum, item) => sum + item.unitPrice * item.quantity, 0).toFixed(2));
    if (total <= 0) return res.status(400).json({ error: "Invalid order total" });

    const token = await paypalToken();
    const pp = await fetch(`${base()}/v2/checkout/orders`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        intent: "CAPTURE",
        purchase_units: [{ amount: { currency_code: "USD", value: total.toFixed(2) } }]
      })
    });
    const data = await pp.json();
    if (!pp.ok) return res.status(502).json({ error: "PayPal could not create the order" });
    const order = await Order.create({ items: normalized, total, paypalOrderId: data.id, status: "PENDING" });
    res.status(201).json({ orderId: order._id, paypalOrderId: data.id });
  } catch (error) { res.status(500).json({ error: error.message || "Could not create checkout" }); }
});

router.post("/capture-order", async (req, res) => {
  try {
    const { paypalOrderId } = req.body;
    if (!paypalOrderId) return res.status(400).json({ error: "PayPal order ID is required" });
    const order = await Order.findOne({ paypalOrderId });
    if (!order) return res.status(404).json({ error: "Local order not found" });
    if (order.status === "PAID") return res.json({ status: "PAID", message: "Order already captured" });

    const token = await paypalToken();
    const pp = await fetch(`${base()}/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}/capture`, {
      method: "POST", headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }
    });
    const data = await pp.json();
    if (!pp.ok || data.status !== "COMPLETED") {
      order.status = "FAILED"; await order.save();
      return res.status(400).json({ error: "PayPal did not confirm a completed payment" });
    }
    const unit = data.purchase_units?.[0];
    const captured = unit?.payments?.captures?.[0];
    const amount = Number(captured?.amount?.value);
    const currency = captured?.amount?.currency_code;
    if (currency !== "USD" || amount !== order.total) {
      return res.status(400).json({ error: "Captured amount did not match the local order" });
    }
    order.status = "PAID";
    order.paypalCaptureId = captured.id;
    await order.save();
    for (const item of order.items) {
      await Product.updateOne({ _id: item.productId, stock: { $gte: item.quantity } }, { $inc: { stock: -item.quantity } });
    }
    res.json({ status: "PAID", captureId: captured.id });
  } catch (error) { res.status(500).json({ error: error.message || "Could not capture payment" }); }
});
export default router;
