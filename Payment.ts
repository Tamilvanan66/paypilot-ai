import mongoose, { Schema, type InferSchemaType } from 'mongoose';
import { defineModel } from './defineModel.js';

const paymentSchema = new Schema(
  {
    storeId: { type: Schema.Types.ObjectId, ref: 'Store', required: true, index: true },
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
    provider: { type: String, default: 'paypal' },
    paypalOrderId: { type: String, required: true, unique: true, index: true },
    captureId: { type: String, default: null },
    status: {
      type: String,
      enum: ['created', 'approved', 'captured', 'failed', 'refunded', 'cancelled'],
      default: 'created',
      index: true,
    },
    amount: { type: Number, required: true, min: 0 },
    currency: { type: String, required: true, uppercase: true },
    payerEmail: { type: String, default: '' },
    payerName: { type: String, default: '' },
    rawCreate: { type: Schema.Types.Mixed, default: null },
    rawCapture: { type: Schema.Types.Mixed, default: null },
    failureReason: { type: String, default: '' },
  },
  { timestamps: true },
);

paymentSchema.index({ storeId: 1, createdAt: -1 });

const transactionSchema = new Schema(
  {
    storeId: { type: Schema.Types.ObjectId, ref: 'Store', required: true, index: true },
    orderId: { type: Schema.Types.ObjectId, ref: 'Order', required: true, index: true },
    paymentId: { type: Schema.Types.ObjectId, ref: 'Payment', default: null, index: true },
    type: {
      type: String,
      enum: ['sale', 'refund', 'chargeback', 'adjustment'],
      default: 'sale',
      index: true,
    },
    provider: { type: String, default: 'paypal' },
    providerTransactionId: { type: String, required: true, unique: true, index: true },
    amount: { type: Number, required: true },
    currency: { type: String, required: true, uppercase: true },
    status: { type: String, enum: ['completed', 'pending', 'failed', 'reversed'], default: 'completed' },
    source: { type: String, enum: ['capture', 'webhook', 'manual'], default: 'capture' },
  },
  { timestamps: true },
);

transactionSchema.index({ storeId: 1, createdAt: -1 });

export type PaymentDoc = InferSchemaType<typeof paymentSchema>;
export const Payment = defineModel<PaymentDoc>('Payment', paymentSchema);
export type TransactionDoc = InferSchemaType<typeof transactionSchema>;
export const Transaction = defineModel<TransactionDoc>('Transaction', transactionSchema);
