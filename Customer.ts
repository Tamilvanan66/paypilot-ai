import mongoose, { Schema, type InferSchemaType } from 'mongoose';
import { defineModel } from './defineModel.js';

const customerSchema = new Schema(
  {
    storeId: { type: Schema.Types.ObjectId, ref: 'Store', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    email: { type: String, required: true, lowercase: true, trim: true },
    phone: { type: String, default: '' },
    address: {
      line1: { type: String, default: '' },
      line2: { type: String, default: '' },
      city: { type: String, default: '' },
      state: { type: String, default: '' },
      postalCode: { type: String, default: '' },
      country: { type: String, default: '' },
    },
    totalOrders: { type: Number, default: 0 },
    totalSpent: { type: Number, default: 0 },
    lastOrderAt: { type: Date, default: null },
  },
  { timestamps: true },
);

customerSchema.index({ storeId: 1, email: 1 }, { unique: true });

export type CustomerDoc = InferSchemaType<typeof customerSchema>;
export const Customer = defineModel<CustomerDoc>('Customer', customerSchema);
