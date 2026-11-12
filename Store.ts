import mongoose, { Schema, type InferSchemaType } from 'mongoose';
import { defineModel } from './defineModel.js';

const storeSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    slug: { type: String, required: true, unique: true, index: true },
    description: { type: String, default: '', maxlength: 600 },
    currency: { type: String, default: 'USD', uppercase: true, maxlength: 3 },
    supportEmail: { type: String, default: '' },
    lowStockThreshold: { type: Number, default: 5, min: 0 },
    aiPersona: {
      type: String,
      default:
        'You are a helpful, concise sales assistant. Be friendly, factual and never invent prices.',
    },
    paypalConnected: { type: Boolean, default: false },
  },
  { timestamps: true },
);

export type StoreDoc = InferSchemaType<typeof storeSchema>;
export const Store = defineModel<StoreDoc>('Store', storeSchema);
