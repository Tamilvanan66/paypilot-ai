import mongoose, { Schema, type InferSchemaType } from 'mongoose';
import { defineModel } from './defineModel.js';

const productSchema = new Schema(
  {
    storeId: { type: Schema.Types.ObjectId, ref: 'Store', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 160 },
    sku: { type: String, required: true, trim: true, uppercase: true, maxlength: 64 },
    slug: { type: String, default: '', index: true },
    description: { type: String, default: '', maxlength: 4000 },
    shortDescription: { type: String, default: '', maxlength: 300 },
    categoryId: { type: Schema.Types.ObjectId, ref: 'Category', default: null, index: true },
    price: { type: Number, required: true, min: 0 },
    compareAtPrice: { type: Number, default: null, min: 0 },
    currency: { type: String, default: 'USD', uppercase: true },
    stock: { type: Number, required: true, default: 0, min: 0 },
    lowStockThreshold: { type: Number, default: null, min: 0 },
    imageUrl: { type: String, default: '' },
    status: { type: String, enum: ['active', 'archived'], default: 'active', index: true },
    tags: { type: [String], default: [] },
    keywords: { type: [String], default: [] },
    salesCount: { type: Number, default: 0 },
  },
  { timestamps: true },
);

productSchema.index({ storeId: 1, sku: 1 }, { unique: true });
productSchema.index({ storeId: 1, status: 1, categoryId: 1 });
productSchema.index({ name: 'text', description: 'text', tags: 'text' });

productSchema.virtual('stockStatus').get(function (this: { stock: number; lowStockThreshold?: number | null }) {
  if (this.stock <= 0) return 'out_of_stock';
  if (this.stock <= (this.lowStockThreshold ?? 5)) return 'low_stock';
  return 'in_stock';
});

productSchema.set('toJSON', { virtuals: true });
productSchema.set('toObject', { virtuals: true });

export type ProductDoc = InferSchemaType<typeof productSchema>;
export const Product = defineModel<ProductDoc>('Product', productSchema);
