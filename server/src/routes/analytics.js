import { Router } from "express";
import Order from "../models/Order.js";
import Product from "../models/Product.js";
const router = Router();
router.get("/", async (_req, res) => {
  try {
    const [products, paidOrders, pendingOrders] = await Promise.all([
      Product.countDocuments({ active: true }),
      Order.find({ status: "PAID" }),
      Order.countDocuments({ status: "PENDING" })
    ]);
    const revenue = paidOrders.reduce((sum, order) => sum + order.total, 0);
    res.json({ products, paidOrders: paidOrders.length, pendingOrders, revenue: Number(revenue.toFixed(2)) });
  } catch { res.status(500).json({ error: "Could not calculate analytics" }); }
});
export default router;
