import mongoose, { Schema, type InferSchemaType } from 'mongoose';
import { defineModel } from './defineModel.js';

const conversationSchema = new Schema(
  {
    storeId: { type: Schema.Types.ObjectId, ref: 'Store', required: true, index: true },
    channel: { type: String, enum: ['web', 'dashboard'], default: 'web' },
    customerEmail: { type: String, default: '', lowercase: true },
    title: { type: String, default: 'New conversation' },
    lastMessageAt: { type: Date, default: Date.now, index: true },
    messageCount: { type: Number, default: 0 },
    language: { type: String, default: 'en' },
  },
  { timestamps: true },
);
conversationSchema.index({ storeId: 1, lastMessageAt: -1 });

const messageSchema = new Schema(
  {
    storeId: { type: Schema.Types.ObjectId, ref: 'Store', required: true, index: true },
    conversationId: { type: Schema.Types.ObjectId, ref: 'Conversation', required: true, index: true },
    role: { type: String, enum: ['user', 'assistant', 'system'], required: true },
    content: { type: String, required: true, maxlength: 8000 },
    source: { type: String, enum: ['ai', 'fallback', 'system'], default: 'ai' },
    products: { type: [Schema.Types.Mixed], default: [] },
    tokens: { type: Number, default: 0 },
  },
  { timestamps: true },
);
messageSchema.index({ conversationId: 1, createdAt: 1 });

export type ConversationDoc = InferSchemaType<typeof conversationSchema>;
export const Conversation = defineModel<ConversationDoc>('Conversation', conversationSchema);
export type MessageDoc = InferSchemaType<typeof messageSchema>;
export const Message = defineModel<MessageDoc>('Message', messageSchema);
