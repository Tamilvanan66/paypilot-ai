import type { Request, Response } from 'express';
import { Types } from 'mongoose';
import { Order, type PAYMENT_STATUSES } from '../models/Order.js';
import { Product } from '../models/Product.js';
import { Customer } from '../models/Customer.js';
import { Notification } from '../models/Notification.js';
import { ApiError } from '../utils/errors.js';
import { generateOrderNumber, money, paginate, parsePagination } from '../utils/helpers.js';
import { restoreOrderInventory } from '../services/inventory.js';

const storeIdOf = (req: Request) => new Types.ObjectId(String(req.user!.storeId));

export async function createOrder(req: Request, res: Response) {
  const storeId = storeIdOf(req);
  const { items, customer, notes } = req.body as {
    items: { productId: string; quantity: number }[];
    customer: { name: string; email: string; phone?: string; address?: Record<string, string> };
    notes?: string;
  };

  // Merge duplicate lines, then price from the DATABASE only.
  const merged = new Map<string, number>();
  for (const line of items) merged.set(line.productId, (merged.get(line.productId) ?? 0) + line.quantity);

  const productIds = [...merged.keys()];
  const products = await Product.find({ _id: { $in: productIds }, storeId, status: 'active' }).lean();
  if (products.length !== productIds.length) {
    throw ApiError.badRequest('One or more products are unavailable');
  }

  const orderItems = products.map((p) => {
    const quantity = merged.get(String(p._id))!;
    if (p.stock < quantity) {
      throw ApiError.conflict(`Insufficient stock for ${p.name} (only ${p.stock} left)`);
    }
    return {
      productId: p._id,
      name: p.name,
      sku: p.sku,
      price: p.price,
      quantity,
      imageUrl: p.imageUrl ?? '',
      lineTotal: money(p.price * quantity),
    };
  });

  const subtotal = money(orderItems.reduce((s, i) => s + i.lineTotal, 0));
  const shipping = subtotal >= 75 ? 0 : 5;
  const tax = money(subtotal * 0.08);
  const total = money(subtotal + shipping + tax);

  const customerDoc = await Customer.findOneAndUpdate(
    { storeId, email: customer.email },
    {
      $set: { name: customer.name, phone: customer.phone ?? '', ...(customer.address ? { address: customer.address } : {}) },
      $setOnInsert: { storeId },
    },
    { upsert: true, new: true, setDefaultsOnInsert: true },
  );

  const order = await Order.create({
    storeId,
    orderNumber: generateOrderNumber(),
    customerId: customerDoc._id,
    customerName: customer.name,
    customerEmail: customer.email,
    items: orderItems,
    subtotal,
    tax,
    shipping,
    total,
    currency: 'USD',
    status: 'pending',
    paymentStatus: 'unpaid',
    fulfilmentStatus: 'unfulfilled',
    notes: notes ?? '',
  });

  await Notification.create({
    storeId,
    type: 'new_order',
    severity: 'info',
    title: `New order ${order.orderNumber}`,
    body: `${customer.name} · ${orderItems.length} item(s) · USD ${total.toFixed(2)}`,
    link: `/orders/${String(order._id)}`,
  });

  res.status(201).json({ success: true, data: order });
}

export async function listOrders(req: Request, res: Response) {
  const storeId = storeIdOf(req);
  const { page, limit, skip } = parsePagination(req.query as Record<string, unknown>);
  const { search, status, paymentStatus, from, to } = req.query as Record<string, string | undefined>;

  const filter: Record<string, unknown> = { storeId };
  if (status && status !== 'all') filter.status = status;
  if (paymentStatus && paymentStatus !== 'all') filter.paymentStatus = paymentStatus;
  if (search) {
    const rx = new RegExp(search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');
    filter.$or = [{ orderNumber: rx }, { customerName: rx }, { customerEmail: rx }];
  }
  if (from || to) {
    const range: Record<string, Date> = {};
    if (from && !Number.isNaN(Date.parse(from))) range.$gte = new Date(from);
    if (to && !Number.isNaN(Date.parse(to))) {
      const d = new Date(to);
      d.setUTCHours(23, 59, 59, 999);
      range.$lte = d;
    }
    if (Object.keys(range).length) filter.createdAt = range;
  }

  const [items, total, statusCounts] = await Promise.all([
    Order.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Order.countDocuments(filter),
    Order.aggregate([{ $match: { storeId } }, { $group: { _id: '$status', count: { $sum: 1 } } }]),
  ]);

  res.json({
    success: true,
    data: {
      ...paginate(items, total, page, limit),
      statusCounts: Object.fromEntries(statusCounts.map((s) => [s._id as string, s.count as number])),
    },
  });
}

export async function getOrder(req: Request, res: Response) {
  const storeId = storeIdOf(req);
  const order = await Order.findOne({ _id: req.params.id, storeId }).lean();
  if (!order) throw ApiError.notFound('Order not found');
  const customer = await Customer.findById(order.customerId).lean();
  res.json({ success: true, data: { order, customer } });
}

const TRANSITIONS: Record<string, string[]> = {
  pending: ['processing', 'cancelled', 'paid'],
  paid: ['processing', 'shipped', 'cancelled', 'refunded'],
  processing: ['shipped', 'cancelled', 'refunded'],
  shipped: ['delivered', 'refunded'],
  delivered: ['refunded'],
  cancelled: [],
  refunded: [],
};

export async function updateOrderStatus(req: Request, res: Response) {
  const storeId = storeIdOf(req);
  const { status, note } = req.body as { status: string; note?: string };

  const order = await Order.findOne({ _id: req.params.id, storeId });
  if (!order) throw ApiError.notFound('Order not found');

  if (order.status === status) {
    return res.json({ success: true, data: order, meta: { unchanged: true } });
  }
  const allowed = TRANSITIONS[order.status] ?? [];
  if (!allowed.includes(status)) {
    throw ApiError.badRequest(`Cannot move an order from “${order.status}” to “${status}”`);
  }
  if (['shipped', 'delivered', 'processing'].includes(status) && order.paymentStatus !== 'paid') {
    throw ApiError.badRequest('Only paid orders can move to processing, shipped or delivered');
  }

  order.status = status as typeof order.status;
  const now = new Date();
  if (status === 'shipped') {
    order.shippedAt = now;
    order.fulfilmentStatus = 'shipped';
  }
  if (status === 'delivered') {
    order.deliveredAt = now;
    order.fulfilmentStatus = 'delivered';
  }
  if (status === 'processing') order.fulfilmentStatus = 'processing';
  if (status === 'cancelled') {
    order.cancelledAt = now;
    order.fulfilmentStatus = 'cancelled';
    if (order.paymentStatus === 'unpaid') order.paymentStatus = 'unpaid';
  }
  if (status === 'refunded') {
    order.refundedAt = now;
    order.paymentStatus = 'refunded';
  }
  if (note) order.notes = `${order.notes ? `${order.notes}\n` : ''}${note}`.slice(0, 1000);
  await order.save();

  // Restore stock for cancellations of paid orders and refunds (once only).
  const shouldRestore =
    (status === 'cancelled' || status === 'refunded') && order.inventoryCommitted && !order.inventoryRestored;
  if (shouldRestore) {
    order.inventoryRestored = true;
    await order.save();
    await restoreOrderInventory({
      storeId,
      orderId: order._id as Types.ObjectId,
      lines: order.items.map((i) => ({ productId: i.productId, name: i.name, quantity: i.quantity })),
      idempotencyScope: `order:${String(order._id)}`,
      type: status === 'refunded' ? 'refund_restore' : 'cancellation_restore',
    });
  }

  await Notification.create({
    storeId,
    type: 'order_status',
    severity: status === 'cancelled' || status === 'refunded' ? 'warning' : 'info',
    title: `${order.orderNumber} is now ${status}`,
    body: note ?? `Status updated by ${req.user!.name}.`,
    link: `/orders/${String(order._id)}`,
  });

  res.json({ success: true, data: order });
}

export async function recentOrders(req: Request, res: Response) {
  const storeId = storeIdOf(req);
  const items = await Order.find({ storeId }).sort({ createdAt: -1 }).limit(6).lean();
  res.json({ success: true, data: items });
}

export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];
