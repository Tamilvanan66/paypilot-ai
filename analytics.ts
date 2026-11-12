import mongoose from 'mongoose';
import { Order } from '../models/Order.js';
import { Product } from '../models/Product.js';
import { Customer } from '../models/Customer.js';
import { Transaction } from '../models/Payment.js';
import { round2 } from '../utils/helpers.js';

const PAID = ['paid', 'processing', 'shipped', 'delivered'];

export const rangeStart = (days: number) => {
  const d = new Date();
  d.setUTCHours(0, 0, 0, 0);
  d.setUTCDate(d.getUTCDate() - (days - 1));
  return d;
};

export async function overview(storeId: mongoose.Types.ObjectId) {
  const [agg] = await Order.aggregate([
    { $match: { storeId } },
    {
      $group: {
        _id: null,
        totalOrders: { $sum: 1 },
        pendingOrders: {
          $sum: { $cond: [{ $in: ['$status', ['pending', 'processing']] }, 1, 0] },
        },
        completedOrders: { $sum: { $cond: [{ $eq: ['$status', 'delivered'] }, 1, 0] } },
        cancelledOrders: { $sum: { $cond: [{ $eq: ['$status', 'cancelled'] }, 1, 0] } },
        pendingPayments: {
          $sum: { $cond: [{ $eq: ['$paymentStatus', 'unpaid'] }, 1, 0] },
        },
        paidTotals: {
          $sum: {
            $cond: [{ $and: [{ $eq: ['$paymentStatus', 'paid'] }, { $in: ['$status', PAID] }] }, '$total', 0],
          },
        },
        pendingPaymentValue: {
          $sum: { $cond: [{ $eq: ['$paymentStatus', 'unpaid'] }, '$total', 0] },
        },
      },
    },
  ]);

  const refunds = await Transaction.aggregate([
    { $match: { storeId, type: 'refund', status: 'completed' } },
    { $group: { _id: null, total: { $sum: '$amount' } } },
  ]);

  const [productAgg] = await Product.aggregate([
    { $match: { storeId, status: 'active' } },
    {
      $group: {
        _id: null,
        totalProducts: { $sum: 1 },
        inventoryUnits: { $sum: '$stock' },
        inventoryValue: { $sum: { $multiply: ['$stock', '$price'] } },
        lowStock: {
          $sum: {
            $cond: [
              {
                $and: [
                  { $gt: ['$stock', 0] },
                  { $lte: ['$stock', { $ifNull: ['$lowStockThreshold', 5] }] },
                ],
              },
              1,
              0,
            ],
          },
        },
        outOfStock: { $sum: { $cond: [{ $lte: ['$stock', 0] }, 1, 0] } },
      },
    },
  ]);

  const customerCount = await Customer.countDocuments({ storeId });

  const start30 = rangeStart(30);
  const [last30] = await Order.aggregate([
    { $match: { storeId, createdAt: { $gte: start30 } } },
    {
      $group: {
        _id: null,
        orders: { $sum: 1 },
        revenue: {
          $sum: {
            $cond: [{ $and: [{ $eq: ['$paymentStatus', 'paid'] }, { $in: ['$status', PAID] }] }, '$total', 0],
          },
        },
      },
    },
  ]);

  const totalRevenue = round2(agg?.paidTotals ?? 0);
  const grossRefunds = round2(refunds[0]?.total ?? 0);
  const totalOrders = agg?.totalOrders ?? 0;

  return {
    revenue: {
      gross: totalRevenue,
      refunds: grossRefunds,
      net: round2(totalRevenue - grossRefunds),
      last30Days: round2(last30?.revenue ?? 0),
    },
    orders: {
      total: totalOrders,
      pending: agg?.pendingOrders ?? 0,
      completed: agg?.completedOrders ?? 0,
      cancelled: agg?.cancelledOrders ?? 0,
      pendingPayments: agg?.pendingPayments ?? 0,
      pendingPaymentValue: round2(agg?.pendingPaymentValue ?? 0),
      last30Days: last30?.orders ?? 0,
      averageOrderValue: totalOrders ? round2(totalRevenue / Math.max(1, agg?.completedOrders || totalOrders)) : 0,
    },
    products: {
      total: productAgg?.totalProducts ?? 0,
      lowStock: productAgg?.lowStock ?? 0,
      outOfStock: productAgg?.outOfStock ?? 0,
      inventoryUnits: productAgg?.inventoryUnits ?? 0,
      inventoryValue: round2(productAgg?.inventoryValue ?? 0),
    },
    customers: { total: customerCount },
    computedAt: new Date().toISOString(),
  };
}

export async function revenueSeries(storeId: mongoose.Types.ObjectId, days = 30) {
  const start = rangeStart(days);
  const rows = await Order.aggregate([
    { $match: { storeId, createdAt: { $gte: start } } },
    {
      $group: {
        _id: { $dateToString: { format: '%Y-%m-%d', date: '$createdAt', timezone: 'UTC' } },
        orders: { $sum: 1 },
        revenue: {
          $sum: {
            $cond: [{ $and: [{ $eq: ['$paymentStatus', 'paid'] }, { $in: ['$status', PAID] }] }, '$total', 0],
          },
        },
      },
    },
    { $sort: { _id: 1 } },
  ]);

  const map = new Map(rows.map((r) => [r._id as string, r]));
  const series: { date: string; revenue: number; orders: number }[] = [];
  for (let i = 0; i < days; i += 1) {
    const d = new Date(start);
    d.setUTCDate(start.getUTCDate() + i);
    const key = d.toISOString().slice(0, 10);
    const row = map.get(key);
    series.push({
      date: key,
      revenue: round2(row?.revenue ?? 0),
      orders: row?.orders ?? 0,
    });
  }
  return series;
}

export async function productPerformance(storeId: mongoose.Types.ObjectId, limit = 8) {
  const rows = await Order.aggregate([
    { $match: { storeId, paymentStatus: 'paid', status: { $in: PAID } } },
    { $unwind: '$items' },
    {
      $group: {
        _id: '$items.productId',
        name: { $first: '$items.name' },
        sku: { $first: '$items.sku' },
        unitsSold: { $sum: '$items.quantity' },
        revenue: { $sum: '$items.lineTotal' },
        orders: { $sum: 1 },
      },
    },
    { $sort: { revenue: -1 } },
    { $limit: limit },
  ]);

  const ids = rows.map((r) => r._id);
  const products = await Product.find({ _id: { $in: ids } })
    .select('stock imageUrl price')
    .lean();
  const pmap = new Map(products.map((p) => [String(p._id), p]));

  return rows.map((r) => ({
    productId: String(r._id),
    name: r.name as string,
    sku: r.sku as string,
    unitsSold: r.unitsSold as number,
    revenue: round2(r.revenue as number),
    orders: r.orders as number,
    stock: pmap.get(String(r._id))?.stock ?? 0,
    imageUrl: pmap.get(String(r._id))?.imageUrl ?? '',
  }));
}

export async function salesByCategory(storeId: mongoose.Types.ObjectId) {
  const rows = await Order.aggregate([
    { $match: { storeId, paymentStatus: 'paid', status: { $in: PAID } } },
    { $unwind: '$items' },
    {
      $lookup: {
        from: 'products',
        localField: 'items.productId',
        foreignField: '_id',
        as: 'p',
      },
    },
    { $unwind: { path: '$p', preserveNullAndEmptyArrays: true } },
    {
      $lookup: {
        from: 'categories',
        localField: 'p.categoryId',
        foreignField: '_id',
        as: 'c',
      },
    },
    { $unwind: { path: '$c', preserveNullAndEmptyArrays: true } },
    {
      $group: {
        _id: { $ifNull: ['$c.name', 'Uncategorised'] },
        revenue: { $sum: '$items.lineTotal' },
        units: { $sum: '$items.quantity' },
      },
    },
    { $sort: { revenue: -1 } },
  ]);
  return rows.map((r) => ({ category: r._id as string, revenue: round2(r.revenue), units: r.units }));
}

export async function orderStatusBreakdown(storeId: mongoose.Types.ObjectId) {
  const rows = await Order.aggregate([
    { $match: { storeId } },
    { $group: { _id: '$status', count: { $sum: 1 }, value: { $sum: '$total' } } },
    { $sort: { count: -1 } },
  ]);
  return rows.map((r) => ({ status: r._id as string, count: r.count, value: round2(r.value) }));
}

export async function customerActivity(storeId: mongoose.Types.ObjectId, days = 30) {
  const start = rangeStart(days);
  const rows = await Order.aggregate([
    { $match: { storeId, createdAt: { $gte: start } } },
    {
      $group: {
        _id: '$customerEmail',
        name: { $last: '$customerName' },
        orders: { $sum: 1 },
        spend: { $sum: { $cond: [{ $eq: ['$paymentStatus', 'paid'] }, '$total', 0] } },
        lastOrderAt: { $max: '$createdAt' },
      },
    },
    { $sort: { orders: -1, spend: -1 } },
    { $limit: 10 },
  ]);
  return rows.map((r) => ({
    email: r._id as string,
    name: r.name as string,
    orders: r.orders as number,
    spend: round2(r.spend as number),
    lastOrderAt: r.lastOrderAt,
  }));
}

export async function inventoryInsights(storeId: mongoose.Types.ObjectId) {
  const [agg] = await Product.aggregate([
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
        count: { $sum: 1 },
      },
    },
  ]);
  const lowItems = await Product.find({
    storeId,
    status: 'active',
    $expr: { $lte: ['$stock', { $ifNull: ['$lowStockThreshold', 5] }] },
  })
    .sort({ stock: 1 })
    .limit(8)
    .select('name sku stock imageUrl')
    .lean();

  return {
    units: agg?.units ?? 0,
    value: round2(agg?.value ?? 0),
    lowCount: agg?.low ?? 0,
    outCount: agg?.out ?? 0,
    productCount: agg?.count ?? 0,
    lowItems: lowItems.map((p) => ({
      id: String(p._id),
      name: p.name,
      sku: p.sku,
      stock: p.stock,
      imageUrl: p.imageUrl ?? '',
    })),
  };
}
