import { Router } from "express";
import Order from "../models/Order.js";
const router = Router();
router.get("/", async (_req, res) => {
  try { res.json(await Order.find().sort({ createdAt: -1 }).limit(100)); }
  catch { res.status(500).json({ error: "Could not load orders" }); }
});
export default router;
