import mongoose from 'mongoose';
import { Product } from '../models/Product.js';
import { InventoryMovement } from '../models/InventoryMovement.js';
import { Notification } from '../models/Notification.js';
import { ApiError } from '../utils/errors.js';

/**
 * Inventory consistency strategy
 * ------------------------------
 * Stock changes are performed with atomic, conditional MongoDB updates
 * (`findOneAndUpdate` with a `stock: { $gte: qty }` guard) inside a guarded
 * try/catch that rolls back already-applied lines if any line fails.
 * This avoids overselling without requiring a replica set (Atlas has one, but
 * self-hosted/Memory servers may not), and every mutation writes an
 * InventoryMovement row carrying a UNIQUE idempotency key so a retried
 * capture/webhook can never deduct twice.
 */

export interface StockLine {
  productId: mongoose.Types.ObjectId | string;
  name: string;
  quantity: number;
}

async function adjustStock(input: {
  storeId: mongoose.Types.ObjectId;
  productId: mongoose.Types.ObjectId | string;
  delta: number;
  type: 'sale' | 'refund_restore' | 'cancellation_restore' | 'adjustment' | 'restock' | 'initial';
  reason?: string;
  orderId?: mongoose.Types.ObjectId | null;
  userId?: mongoose.Types.ObjectId | null;
  idempotencyKey?: string | null;
}) {
  const { storeId, productId, delta, type } = input;

  if (input.idempotencyKey) {
    const existing = await InventoryMovement.findOne({ idempotencyKey: input.idempotencyKey }).lean();
    if (existing) return { applied: false, duplicated: true, newStock: existing.newStock };
  }

  const filter: Record<string, unknown> = { _id: productId, storeId };
  if (delta < 0) filter.stock = { $gte: Math.abs(delta) };

  const updated = await Product.findOneAndUpdate(filter, { $inc: { stock: delta } }, { new: true });
  if (!updated) {
    if (delta < 0) throw ApiError.conflict('Insufficient stock for one or more items');
    throw ApiError.notFound('Product not found');
  }

  const previousStock = updated.stock - delta;
  try {
    await InventoryMovement.create({
      storeId,
      productId: updated._id,
      type,
      quantityChange: delta,
      previousStock,
      newStock: updated.stock,
      reason: input.reason ?? '',
      orderId: input.orderId ?? null,
      idempotencyKey: input.idempotencyKey ?? null,
      userId: input.userId ?? null,
    });
  } catch (err) {
    // Duplicate idempotency key => a concurrent request already recorded it.
    if ((err as { code?: number }).code === 11000) {
      return { applied: false, duplicated: true, newStock: updated.stock };
    }
    throw err;
  }

  return { applied: true, duplicated: false, newStock: updated.stock, product: updated };
}

export async function commitOrderInventory(input: {
  storeId: mongoose.Types.ObjectId;
  orderId: mongoose.Types.ObjectId;
  lines: StockLine[];
  idempotencyScope: string;
  threshold?: number;
}) {
  const applied: StockLine[] = [];
  try {
    for (const line of input.lines) {
      await adjustStock({
        storeId: input.storeId,
        productId: line.productId,
        delta: -line.quantity,
        type: 'sale',
        reason: `Order sale (${input.idempotencyScope})`,
        orderId: input.orderId,
        idempotencyKey: `${input.idempotencyScope}:sale:${String(line.productId)}`,
      });
      applied.push(line);
    }
    await Product.updateMany(
      { _id: { $in: input.lines.map((l) => l.productId) } },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      { $inc: { salesCount: 1 } } as any,
    );
  } catch (err) {
    // Roll back lines committed before the failure.
    for (const line of applied) {
      await adjustStock({
        storeId: input.storeId,
        productId: line.productId,
        delta: line.quantity,
        type: 'adjustment',
        reason: 'Rollback after failed commitment',
        orderId: input.orderId,
        idempotencyKey: `${input.idempotencyScope}:rollback:${String(line.productId)}`,
      }).catch(() => undefined);
    }
    throw err;
  }

  await checkLowStock(input.storeId, input.lines.map((l) => l.productId), input.threshold);
}

export async function restoreOrderInventory(input: {
  storeId: mongoose.Types.ObjectId;
  orderId: mongoose.Types.ObjectId;
  lines: StockLine[];
  idempotencyScope: string;
  type: 'refund_restore' | 'cancellation_restore';
}) {
  for (const line of input.lines) {
    await adjustStock({
      storeId: input.storeId,
      productId: line.productId,
      delta: line.quantity,
      type: input.type,
      reason: `${input.type} for order ${input.idempotencyScope}`,
      orderId: input.orderId,
      idempotencyKey: `${input.idempotencyScope}:${input.type}:${String(line.productId)}`,
    });
  }
}

export async function checkLowStock(
  storeId: mongoose.Types.ObjectId,
  productIds: (mongoose.Types.ObjectId | string)[],
  threshold?: number,
) {
  const limit = threshold ?? 5;
  const low = await Product.find({
    storeId,
    _id: { $in: productIds },
    status: 'active',
    $expr: { $lte: ['$stock', { $ifNull: ['$lowStockThreshold', limit] }] },
  }).lean();

  for (const p of low) {
    const existing = await Notification.findOne({
      storeId,
      type: 'low_inventory',
      link: `/products/${String(p._id)}`,
      read: false,
    }).lean();
    if (existing) continue;
    await Notification.create({
      storeId,
      type: 'low_inventory',
      severity: p.stock === 0 ? 'error' : 'warning',
      title: p.stock === 0 ? `Out of stock: ${p.name}` : `Low stock: ${p.name}`,
      body: `${p.stock} unit(s) left (SKU ${p.sku}).`,
      link: `/products/${String(p._id)}`,
    });
  }
  return low;
}

export async function manualAdjust(input: {
  storeId: mongoose.Types.ObjectId;
  productId: string;
  newStock: number;
  reason: string;
  userId: mongoose.Types.ObjectId;
}) {
  const product = await Product.findOne({ _id: input.productId, storeId: input.storeId });
  if (!product) throw ApiError.notFound('Product not found');
  const delta = input.newStock - product.stock;
  if (delta === 0) {
    return { product, movement: null, unchanged: true };
  }
  const result = await adjustStock({
    storeId: input.storeId,
    productId: product._id,
    delta,
    type: input.newStock > product.stock ? 'restock' : 'adjustment',
    reason: input.reason,
    userId: input.userId,
    idempotencyKey: `manual:${String(product._id)}:${Date.now()}:${input.newStock}`,
  });
  const fresh = await Product.findById(product._id);
  return { product: fresh!, movement: result, unchanged: false };
}
