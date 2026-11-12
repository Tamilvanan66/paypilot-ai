import mongoose, { Schema, type InferSchemaType } from 'mongoose';
import { defineModel } from './defineModel.js';

const categorySchema = new Schema(
  {
    storeId: { type: Schema.Types.ObjectId, ref: 'Store', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    slug: { type: String, required: true, trim: true },
    description: { type: String, default: '', maxlength: 400 },
  },
  { timestamps: true },
);

categorySchema.index({ storeId: 1, slug: 1 }, { unique: true });

export type CategoryDoc = InferSchemaType<typeof categorySchema>;
export const Category = defineModel<CategoryDoc>('Category', categorySchema);
