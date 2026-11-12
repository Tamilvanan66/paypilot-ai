import { Schema, type InferSchemaType } from 'mongoose';
import { defineModel } from './defineModel.js';

export const ORDER_STATUSES = [
  'pending',
  'paid',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
  'refunded',
] as const;

export const PAYMENT_STATUSES = ['unpaid', 'pending', 'paid', 'failed', 'refunded'] as const;

export const FULFILMENT_STATUSES = [
  'unfulfilled',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
  'returned',
] as const;

const orderLineSchema = new Schema(
  {
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    name: { type: String, required: true },
    sku: { type: String, required: true },
    price: { type: Number, required: true, min: 0 },
    quantity: { type: Number, required: true, min: 1 },
    imageUrl: { type: String, default: '' },
    lineTotal: { type: Number, required: true, min: 0 },
  },
  { _id: true },
);

const orderSchema = new Schema(
  {
    storeId: { type: Schema.Types.ObjectId, ref: 'Store', required: true, index: true },
    orderNumber: { type: String, required: true, unique: true, index: true },
    customerId: { type: Schema.Types.ObjectId, ref: 'Customer', required: true, index: true },
    customerName: { type: String, required: true },
    customerEmail: { type: String, required: true, lowercase: true },
    items: { type: [orderLineSchema], default: [] },
    subtotal: { type: Number, required: true, min: 0 },
    tax: { type: Number, default: 0, min: 0 },
    shipping: { type: Number, default: 0, min: 0 },
    total: { type: Number, required: true, min: 0 },
    currency: { type: String, default: 'USD', uppercase: true },
    status: { type: String, enum: ORDER_STATUSES, default: 'pending', index: true },
    paymentStatus: { type: String, enum: PAYMENT_STATUSES, default: 'unpaid', index: true },
    fulfilmentStatus: {
      type: String,
      enum: FULFILMENT_STATUSES,
      default: 'unfulfilled',
      index: true,
    },
    paymentMethod: { type: String, default: 'paypal' },
    notes: { type: String, default: '', maxlength: 1000 },
    inventoryCommitted: { type: Boolean, default: false, index: true },
    inventoryRestored: { type: Boolean, default: false },
    paidAt: { type: Date, default: null },
    shippedAt: { type: Date, default: null },
    deliveredAt: { type: Date, default: null },
    cancelledAt: { type: Date, default: null },
    refundedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

orderSchema.index({ storeId: 1, createdAt: -1 });
orderSchema.index({ storeId: 1, status: 1, createdAt: -1 });
orderSchema.index({ storeId: 1, customerEmail: 1 });

export type OrderDoc = InferSchemaType<typeof orderSchema>;
export const Order = defineModel<OrderDoc>('Order', orderSchema);

/** Denormalised order-line collection for reporting joins. */
const orderItemSchema = new Schema(
  {
    storeId: { type: Schema.Types.ObjectId, ref: 'Store', required: true, index: true },
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
    productId: { type: Schema.Types.ObjectId, ref: 'Product', required: true, index: true },
    name: { type: String, required: true },
    sku: { type: String, required: true },
    price: { type: Number, required: true },
    quantity: { type: Number, required: true },
    lineTotal: { type: Number, required: true },
  },
  { timestamps: true },
);

export type OrderItemDoc = InferSchemaType<typeof orderItemSchema>;
export const OrderItem = defineModel<OrderItemDoc>('OrderItem', orderItemSchema);
