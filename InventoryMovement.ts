import mongoose, { Schema, type InferSchemaType } from 'mongoose';
import { defineModel } from './defineModel.js';

const inventoryMovementSchema = new Schema(
  {
    storeId: { type: Schema.Types.ObjectId, ref: 'Store', required: true, index: true },
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    type: {
      type: String,
      enum: ['adjustment', 'sale', 'restock', 'refund_restore', 'cancellation_restore', 'initial'],
      required: true,
      index: true,
    },
    quantityChange: { type: Number, required: true },
    previousStock: { type: Number, required: true },
    newStock: { type: Number, required: true },
    reason: { type: String, default: '' },
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', default: null, index: true },
    idempotencyKey: { type: String, default: null, unique: true, sparse: true },
    userId: { type: Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true },
);

inventoryMovementSchema.index({ storeId: 1, createdAt: -1 });

export type InventoryMovementDoc = InferSchemaType<typeof inventoryMovementSchema>;
export const InventoryMovement = defineModel<InventoryMovementDoc>('InventoryMovement', inventoryMovementSchema);
