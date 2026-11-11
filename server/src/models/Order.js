import mongoose from "mongoose";
const orderSchema = new mongoose.Schema({
  items: [{ productId: { type: mongoose.Schema.Types.ObjectId, ref: "Product" }, name: String, quantity: Number, unitPrice: Number }],
  total: { type: Number, required: true },
  currency: { type: String, default: "USD" },
  status: { type: String, enum: ["PENDING", "PAID", "FAILED"], default: "PENDING" },
  paypalOrderId: String,
  paypalCaptureId: String
}, { timestamps: true });
export default mongoose.model("Order", orderSchema);
