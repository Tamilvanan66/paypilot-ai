import type { Request, Response } from 'express';
import { Types } from 'mongoose';
import { Product } from '../models/Product.js';
import { InventoryMovement } from '../models/InventoryMovement.js';
import { manualAdjust } from '../services/inventory.js';
import { paginate, parsePagination } from '../utils/helpers.js';
import { ApiError } from '../utils/errors.js';

export async function listInventory(req: Request, res: Response) {
  const storeId = new Types.ObjectId(String(req.user!.storeId));
  const { page, limit, skip } = parsePagination(req.query as Record<string, unknown>);
  const { search, filter } = req.query as Record<string, string | undefined>;

  const match: Record<string, unknown> = { storeId, status: 'active' };
  if (search) {
    const rx = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    match.$or = [{ name: rx }, { sku: rx }];
  }
  if (filter === 'out') match.stock = { $lte: 0 };
  if (filter === 'low') {
    match.stock = { $gt: 0 };
    match.$expr = { $lte: ['$stock', { $ifNull: ['$lowStockThreshold', 5] }] };
  }

  const [items, total, summary] = await Promise.all([
    Product.find(match).sort({ stock: 1 }).skip(skip).limit(limit).lean(),
    Product.countDocuments(match),
    Product.aggregate([
      { $match: { storeId, status: 'active' } },
      {
        $group: {
          _id: null,
          units: { $sum: '$stock' },
          value: { $sum: { $multiply: ['$stock', '$price'] } },
          low: {
            $sum: {
              $cond: [
                { $and: [{ $gt: ['$stock', 0] }, { $lte: ['$stock', { $ifNull: ['$lowStockThreshold', 5] }] }] },
                1,
                0,
              ],
            },
          },
          out: { $sum: { $cond: [{ $lte: ['$stock', 0] }, 1, 0] } },
        },
      },
    ]),
  ]);

  res.json({
    success: true,
    data: {
      ...paginate(items, total, page, limit),
      summary: {
        units: summary[0]?.units ?? 0,
        value: summary[0]?.value ?? 0,
        low: summary[0]?.low ?? 0,
        out: summary[0]?.out ?? 0,
      },
    },
  });
}

export async function adjustInventory(req: Request, res: Response) {
  const storeId = new Types.ObjectId(String(req.user!.storeId));
  const { newStock, reason } = req.body as { newStock: number; reason: string };
  const result = await manualAdjust({
    storeId,
    productId: req.params.productId,
    newStock,
    reason,
    userId: new Types.ObjectId(req.user!.id),
  });
  res.json({ success: true, data: result });
}

export async function listMovements(req: Request, res: Response) {
  const storeId = new Types.ObjectId(String(req.user!.storeId));
  const { page, limit, skip } = parsePagination(req.query as Record<string, unknown>, 30);
  const { productId, type } = req.query as Record<string, string | undefined>;
  const filter: Record<string, unknown> = { storeId };
  if (productId && Types.ObjectId.isValid(productId)) filter.productId = new Types.ObjectId(productId);
  if (type && type !== 'all') filter.type = type;

  const [rows, total] = await Promise.all([
    InventoryMovement.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).populate('productId', 'name sku').lean(),
    InventoryMovement.countDocuments(filter),
  ]);
  if (!rows) throw ApiError.notFound();
  res.json({ success: true, data: paginate(rows, total, page, limit) });
}
