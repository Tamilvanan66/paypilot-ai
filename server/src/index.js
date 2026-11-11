import express from "express";
import cors from "cors";
import mongoose from "mongoose";
import dotenv from "dotenv";
import productsRouter from "./routes/products.js";
import ordersRouter from "./routes/orders.js";
import paypalRouter from "./routes/paypal.js";
import aiRouter from "./routes/ai.js";
import analyticsRouter from "./routes/analytics.js";

dotenv.config();
const app = express();
app.use(cors({ origin: process.env.CLIENT_URL || "http://localhost:5173" }));
app.use(express.json({ limit: "1mb" }));

app.get("/api/health", (_req, res) => res.json({ ok: true, app: "PayPilot AI" }));
app.use("/api/products", productsRouter);
app.use("/api/orders", ordersRouter);
app.use("/api/paypal", paypalRouter);
app.use("/api/ai", aiRouter);
app.use("/api/analytics", analyticsRouter);

const port = process.env.PORT || 5000;
try {
  await mongoose.connect(process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/paypilot_ai");
  console.log("MongoDB connected");
  app.listen(port, () => console.log(`PayPilot API running on http://localhost:${port}`));
} catch (error) {
  console.error("Startup failed:", error.message);
  process.exit(1);
}
