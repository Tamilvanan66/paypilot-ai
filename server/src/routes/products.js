import { Router } from "express";
import Product from "../models/Product.js";
const router = Router();

router.get("/", async (_req, res) => {
  try { res.json(await Product.find({ active: true }).sort({ createdAt: -1 })); }
  catch { res.status(500).json({ error: "Could not load products" }); }
});

router.post("/", async (req, res) => {
  try {
    const { name, description = "", category = "General", price, stock = 0 } = req.body;
    if (!name?.trim() || !Number.isFinite(Number(price)) || Number(price) < 0 || !Number.isInteger(Number(stock)) || Number(stock) < 0)
      return res.status(400).json({ error: "Provide a name, non-negative price, and non-negative whole-number stock." });
    const product = await Product.create({ name: name.trim(), description, category, price: Number(price), stock: Number(stock) });
    res.status(201).json(product);
  } catch { res.status(500).json({ error: "Could not create product" }); }
});
export default router;
