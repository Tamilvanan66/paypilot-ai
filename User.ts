import { Schema, type InferSchemaType } from 'mongoose';
import bcrypt from 'bcryptjs';
import { defineModel } from './defineModel.js';

export const ROLES = ['owner', 'manager'] as const;
export type Role = (typeof ROLES)[number];

const userSchema = new Schema(
  {
    name: { type: String, required: [true, 'Name is required'], trim: true, maxlength: 80 },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ROLES, default: 'owner', index: true },
    storeId: { type: Schema.Types.ObjectId, ref: 'Store', required: true, index: true },
    lastLoginAt: { type: Date, default: null },
  },
  { timestamps: true },
);

export type UserDoc = InferSchemaType<typeof userSchema>;

userSchema.methods.comparePassword = function (
  this: UserDoc & { passwordHash: string },
  plain: string,
): Promise<boolean> {
  return bcrypt.compare(plain, this.passwordHash);
};

userSchema.statics.hashPassword = (plain: string): Promise<string> => bcrypt.hash(plain, 10);

export const User = defineModel<UserDoc>('User', userSchema);

/** Typed helpers so controllers do not depend on mongoose's instance typings. */
export const hashPassword = (plain: string) => bcrypt.hash(plain, 10);
export const comparePassword = (plain: string, hash: string) => bcrypt.compare(plain, hash);
