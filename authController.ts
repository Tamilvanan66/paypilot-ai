import crypto from 'node:crypto';
import { comparePassword, hashPassword } from '../models/User.js';
import type { Request, Response } from 'express';
import { Store } from '../models/Store.js';
import { User } from '../models/User.js';
import { PasswordResetToken } from '../models/Notification.js';
import { ApiError } from '../utils/errors.js';
import { slugify } from '../utils/helpers.js';
import { clearAuthCookie, setAuthCookie, signToken } from '../middleware/auth.js';
import { env } from '../config/env.js';

const publicUser = (u: {
  _id: unknown;
  name: string;
  email: string;
  role: string;
  storeId: unknown;
}) => ({
  id: String(u._id),
  name: u.name,
  email: u.email,
  role: u.role,
  storeId: String(u.storeId),
});

export async function register(req: Request, res: Response) {
  const { name, email, password, storeName } = req.body as {
    name: string;
    email: string;
    password: string;
    storeName: string;
  };

  const existing = await User.findOne({ email }).lean();
  if (existing) throw ApiError.conflict('An account with that email already exists');

  let slug = slugify(storeName) || 'store';
  let attempt = 0;
  while (await Store.exists({ slug })) {
    attempt += 1;
    slug = `${slugify(storeName) || 'store'}-${attempt}`;
  }

  const store = await Store.create({ name: storeName, slug, currency: env.paypal.currency });

  const passwordHash = await hashPassword(password);
  const user = await User.create({
    name,
    email,
    passwordHash,
    role: 'owner',
    storeId: store._id,
  });

  setAuthCookie(res, signToken(String(user._id)));
  res.status(201).json({
    success: true,
    data: { user: publicUser(user), store: { id: String(store._id), name: store.name, slug: store.slug } },
  });
}

export async function login(req: Request, res: Response) {
  const { email, password } = req.body as { email: string; password: string };
  const user = await User.findOne({ email }).select('+passwordHash');
  if (!user) throw ApiError.unauthorized('Invalid email or password');

  const ok = await comparePassword(password, user.passwordHash);
  if (!ok) throw ApiError.unauthorized('Invalid email or password');

  user.lastLoginAt = new Date();
  await user.save({ validateModifiedOnly: true });

  const store = await Store.findById(user.storeId).lean();
  setAuthCookie(res, signToken(String(user._id)));
  res.json({
    success: true,
    data: {
      user: publicUser(user),
      store: store
        ? { id: String(store._id), name: store.name, slug: store.slug, currency: store.currency }
        : null,
    },
  });
}

export async function logout(_req: Request, res: Response) {
  clearAuthCookie(res);
  res.json({ success: true, data: { message: 'Signed out' } });
}

export async function me(req: Request, res: Response) {
  const user = await User.findById(req.user!.id).lean();
  if (!user) throw ApiError.unauthorized();
  const store = await Store.findById(user.storeId).lean();
  res.json({
    success: true,
    data: {
      user: publicUser(user),
      store: store ? { ...store, id: String(store._id) } : null,
    },
  });
}

export async function forgotPassword(req: Request, res: Response) {
  const { email } = req.body as { email: string };
  const user = await User.findOne({ email }).lean();

  // Always respond 200 to avoid account enumeration.
  const generic = {
    success: true,
    data: {
      message: 'If that email exists, a reset link has been generated.',
      // Delivered out-of-band by email in production; surfaced here so the flow
      // is testable without an SMTP provider.
      resetToken: null as string | null,
    },
  };

  if (!user) return res.json(generic);

  const token = crypto.randomBytes(32).toString('hex');
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  await PasswordResetToken.create({
    userId: user._id,
    tokenHash,
    expiresAt: new Date(Date.now() + env.resetTtlMinutes * 60_000),
  });

  generic.data.resetToken = env.nodeEnv === 'production' ? null : token;
  res.json(generic);
}

export async function resetPassword(req: Request, res: Response) {
  const { token, password } = req.body as { token: string; password: string };
  const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
  const record = await PasswordResetToken.findOne({
    tokenHash,
    usedAt: null,
    expiresAt: { $gt: new Date() },
  });
  if (!record) throw ApiError.badRequest('Reset link is invalid or has expired');

  const user = await User.findById(record.userId);
  if (!user) throw ApiError.badRequest('Reset link is invalid or has expired');

  user.passwordHash = await hashPassword(password);
  await user.save();
  record.usedAt = new Date();
  await record.save();
  clearAuthCookie(res);

  res.json({ success: true, data: { message: 'Password updated. You can sign in now.' } });
}
