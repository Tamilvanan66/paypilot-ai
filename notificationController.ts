import type { Request, Response } from 'express';
import { Types } from 'mongoose';
import { Notification } from '../models/Notification.js';
import { ApiError } from '../utils/errors.js';
import { paginate, parsePagination } from '../utils/helpers.js';

const storeIdOf = (req: Request) => new Types.ObjectId(String(req.user!.storeId));

export async function listNotifications(req: Request, res: Response) {
  const storeId = storeIdOf(req);
  const { page, limit, skip } = parsePagination(req.query as Record<string, unknown>, 20);
  const unreadOnly = (req.query as Record<string, string>).unreadOnly === 'true';
  const filter: Record<string, unknown> = { storeId };
  if (unreadOnly) filter.read = false;

  const [items, total, unread] = await Promise.all([
    Notification.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Notification.countDocuments(filter),
    Notification.countDocuments({ storeId, read: false }),
  ]);
  res.json({ success: true, data: { ...paginate(items, total, page, limit), unreadCount: unread } });
}

export async function markRead(req: Request, res: Response) {
  const storeId = storeIdOf(req);
  const notification = await Notification.findOneAndUpdate(
    { _id: req.params.id, storeId },
    { $set: { read: true } },
    { new: true },
  );
  if (!notification) throw ApiError.notFound('Notification not found');
  res.json({ success: true, data: notification });
}

export async function markAllRead(req: Request, res: Response) {
  const storeId = storeIdOf(req);
  const result = await Notification.updateMany({ storeId, read: false }, { $set: { read: true } });
  res.json({ success: true, data: { updated: result.modifiedCount } });
}
