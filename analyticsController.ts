import type { Request, Response } from 'express';
import type { Types } from 'mongoose';
import {
  customerActivity,
  inventoryInsights,
  orderStatusBreakdown,
  overview,
  productPerformance,
  revenueSeries,
  salesByCategory,
} from '../services/analytics.js';
import { Order } from '../models/Order.js';
import { Transaction } from '../models/Payment.js';

const storeIdOf = (req: Request) => req.user!.storeId as Types.ObjectId;

export async function getOverview(req: Request, res: Response) {
  const storeId = storeIdOf(req);
  const data = await overview(storeId);
  const recentOrders = await Order.find({ storeId }).sort({ createdAt: -1 }).limit(5).lean();
  const recentTransactions = await Transaction.find({ storeId }).sort({ createdAt: -1 }).limit(5).lean();
  const activity = await customerActivity(storeId, 14);
  res.json({ success: true, data: { ...data, recentOrders, recentTransactions, activity } });
}

export async function getRevenue(req: Request, res: Response) {
  const days = Number(req.query.days ?? 30);
  res.json({ success: true, data: await revenueSeries(storeIdOf(req), days) });
}

export async function getProducts(req: Request, res: Response) {
  const storeId = storeIdOf(req);
  const [performance, categories, inventory] = await Promise.all([
    productPerformance(storeId, 10),
    salesByCategory(storeId),
    inventoryInsights(storeId),
  ]);
  res.json({ success: true, data: { performance, categories, inventory } });
}

export async function getOrders(req: Request, res: Response) {
  const storeId = storeIdOf(req);
  const days = Number(req.query.days ?? 30);
  const [statuses, series, activity] = await Promise.all([
    orderStatusBreakdown(storeId),
    revenueSeries(storeId, days),
    customerActivity(storeId, days),
  ]);
  res.json({ success: true, data: { statuses, series, activity } });
}
