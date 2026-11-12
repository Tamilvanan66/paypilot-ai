import mongoose, { Schema, type InferSchemaType } from 'mongoose';
import { defineModel } from './defineModel.js';

const notificationSchema = new Schema(
  {
    storeId: { type: Schema.Types.ObjectId, ref: 'Store', required: true, index: true },
    type: {
      type: String,
      enum: [
        'new_order',
        'payment_succeeded',
        'payment_failed',
        'low_inventory',
        'order_status',
        'insight',
      ],
      required: true,
      index: true,
    },
    severity: { type: String, enum: ['info', 'success', 'warning', 'error'], default: 'info' },
    title: { type: String, required: true, maxlength: 160 },
    body: { type: String, default: '', maxlength: 600 },
    link: { type: String, default: '' },
    read: { type: Boolean, default: false, index: true },
  },
  { timestamps: true },
);
notificationSchema.index({ storeId: 1, createdAt: -1 });

const passwordResetSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tokenHash: { type: String, required: true, index: true },
    expiresAt: { type: Date, required: true, index: { expires: 0 } },
    usedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

export type NotificationDoc = InferSchemaType<typeof notificationSchema>;
export const Notification = defineModel<NotificationDoc>('Notification', notificationSchema);
export type PasswordResetDoc = InferSchemaType<typeof passwordResetSchema>;
export const PasswordResetToken = defineModel<PasswordResetDoc>('PasswordResetToken', passwordResetSchema);
