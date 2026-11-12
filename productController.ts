import type { Request, Response } from 'express';
import { Types } from 'mongoose';
import { Product } from '../models/Product.js';
import { Category } from '../models/Category.js';
import { Order } from '../models/Order.js';
import { ApiError } from '../utils/errors.js';
import { paginate, parsePagination, slugify } from '../utils/helpers.js';
import { InventoryMovement } from '../models/InventoryMovement.js';

function scope(req: Request) {
  return { storeId: new Types.ObjectId(String(req.user!.storeId)) };
}

export async function listProducts(req: Request, res: Response) {
  const { page, limit, skip } = parsePagination(req.query as Record<string, unknown>);
  const { search, categoryId, status, stock, sort } = req.query as Record<string, string | undefined>;

  const filter: Record<string, unknown> = { ...scope(req) };
  if (status && status !== 'all') filter.status = status;
  else if (!status) filter.status = 'active';
  if (categoryId && Types.ObjectId.isValid(categoryId)) filter.categoryId = new Types.ObjectId(categoryId);
  if (search) {
    const rx = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ name: rx }, { sku: rx }, { description: rx }, { shortDescription: rx }];
  }
  if (stock === 'out') filter.stock = { $lte: 0 };
  if (stock === 'low') filter.$expr = { $lte: ['$stock', { $ifNull: ['$lowStockThreshold', 5] }] };
  if (stock === 'in') filter.stock = { $gt: 0 };

  const sortMap: Record<string, Record<string, 1 | -1>> = {
    newest: { createdAt: -1 },
    oldest: { createdAt: 1 },
    price_asc: { price: 1 },
    price_desc: { price: -1 },
    name: { name: 1 },
  };

  const [items, total] = await Promise.all([
    Product.find(filter).sort(sortMap[sort ?? 'newest']).skip(skip).limit(limit).lean(),
    Product.countDocuments(filter),
  ]);

  res.json({ success: true, data: paginate(items, total, page, limit) });
}

export async function getProduct(req: Request, res: Response) {
  const product = await Product.findOne({ _id: req.params.id, ...scope(req) }).lean();
  if (!product) throw ApiError.notFound('Product not found');
  const movements = await InventoryMovement.find({ storeId: scope(req).storeId, productId: product._id })
    .sort({ createdAt: -1 })
    .limit(10)
    .lean();
  res.json({ success: true, data: { product, movements } });
}

export async function createProduct(req: Request, res: Response) {
  const body = req.body as Record<string, unknown>;
  const { storeId } = scope(req);

  if (body.categoryId) {
    const ok = await Category.exists({ _id: body.categoryId, storeId });
    if (!ok) throw ApiError.badRequest('Category does not belong to this store');
  }

  const product = await Product.create({
    ...body,
    storeId,
    slug: slugify(String(body.name ?? '')),
    currency: 'USD',
  });

  await InventoryMovement.create({
    storeId,
    productId: product._id,
    type: 'initial',
    quantityChange: product.stock,
    previousStock: 0,
    newStock: product.stock,
    reason: 'Initial stock on product creation',
    userId: new Types.ObjectId(req.user!.id),
    idempotencyKey: `initial:${String(product._id)}`,
  });

  res.status(201).json({ success: true, data: product });
}

export async function updateProduct(req: Request, res: Response) {
  const { storeId } = scope(req);
  const body = req.body as Record<string, unknown>;

  if (body.categoryId) {
    const ok = await Category.exists({ _id: body.categoryId, storeId });
    if (!ok) throw ApiError.badRequest('Category does not belong to this store');
  }

  const product = await Product.findOne({ _id: req.params.id, storeId });
  if (!product) throw ApiError.notFound('Product not found');

  const before = product.stock;
  // Stock is managed through the inventory endpoints so every change is audited.
  delete body.stock;

  Object.assign(product, body);
  if (body.name) product.slug = slugify(String(body.name));
  await product.save();

  if (product.stock !== before) {
    await InventoryMovement.create({
      storeId,
      productId: product._id,
      type: 'adjustment',
      quantityChange: product.stock - before,
      previousStock: before,
      newStock: product.stock,
      reason: 'Product update',
      userId: new Types.ObjectId(req.user!.id),
      idempotencyKey: `update:${String(product._id)}:${Date.now()}`,
    });
  }

  res.json({ success: true, data: product });
}

export async function deleteProduct(req: Request, res: Response) {
  const { storeId } = scope(req);
  const product = await Product.findOne({ _id: req.params.id, storeId });
  if (!product) throw ApiError.notFound('Product not found');

  const referenced = await Order.countDocuments({ storeId, 'items.productId': product._id });
  if (referenced > 0) {
    product.status = 'archived';
    await product.save();
    return res.json({
      success: true,
      data: { archived: true, product, message: 'Product had orders, so it was archived instead of deleted' },
    });
  }

  await product.deleteOne();
  res.json({ success: true, data: { deleted: true, id: req.params.id } });
}

export async function listCategories(req: Request, res: Response) {
  const { storeId } = scope(req);
  const items = await Category.find({ storeId }).sort({ name: 1 }).lean();
  res.json({ success: true, data: items });
}

export async function createCategory(req: Request, res: Response) {
  const { storeId } = scope(req);
  const { name, description } = req.body as { name: string; description?: string };
  const category = await Category.create({
    storeId,
    name,
    slug: slugify(name),
    description: description ?? '',
  });
  res.status(201).json({ success: true, data: category });
}
