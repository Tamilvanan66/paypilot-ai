import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { registerOwner, makeProduct } from './helpers.js';
import { env } from '../src/config/env.js';
import { recommend } from '../src/services/recommendations.js';
import { finalizePaidOrder } from '../src/services/payments.js';
import { Payment } from '../src/models/Payment.js';
import mongoose from 'mongoose';
import request from 'supertest';
import { app } from './helpers.js';

describe('AI assistant and recommendations (no AI key configured)', () => {
  const originalKey = env.ai.apiKey;
  beforeEach(() => {
    env.ai.apiKey = '';
  });
  afterEach(() => {
    env.ai.apiKey = originalKey;
    vi.unstubAllGlobals();
  });

  it('answers via the deterministic fallback and grounds prices in the catalogue', async () => {
    const s = await registerOwner();
    await makeProduct(s, { name: 'Bass Headphones', price: 120, stock: 5, shortDescription: 'Deep bass headphones' });
    await makeProduct(s, { name: 'Cheap Earbuds', price: 30, stock: 8, shortDescription: 'Budget earbuds' });

    const res = await s.agent.post('/api/ai/chat').send({ message: 'I want headphones under $50' });
    expect(res.status).toBe(200);
    expect(res.body.data.source).toBe('fallback');
    expect(res.body.data.aiEnabled).toBe(false);
    expect(res.body.data.reply).toMatch(/Cheap Earbuds/);
    expect(res.body.data.reply).not.toMatch(/Bass Headphones/);
    expect(res.body.data.conversationId).toBeTruthy();
  });

  it('keeps conversation context across turns', async () => {
    const s = await registerOwner();
    await makeProduct(s, { name: 'Travel Charger', price: 25, stock: 3 });
    const first = await s.agent.post('/api/ai/chat').send({ message: 'Do you sell chargers?' });
    const id = first.body.data.conversationId;

    const second = await s.agent.post('/api/ai/chat').send({ message: 'Is it in stock?', conversationId: id });
    expect(second.status).toBe(200);
    expect(second.body.data.conversationId).toBe(id);

    const history = await s.agent.get(`/api/ai/conversations/${id}`);
    expect(history.status).toBe(200);
    expect(history.body.data.messages.length).toBe(4);
    expect(history.body.data.messages[0].role).toBe('user');
    expect(history.body.data.messages[1].role).toBe('assistant');
  });

  it('never recommends archived or out-of-stock-only products as available', async () => {
    const s = await registerOwner();
    const archived = await makeProduct(s, { name: 'Old Speaker', price: 40, stock: 9 });
    await s.agent.put(`/api/products/${archived._id}`).send({ status: 'archived' });
    const live = await makeProduct(s, { name: 'New Speaker', price: 60, stock: 4 });

    const res = await s.agent.post('/api/ai/recommendations').send({ query: 'speaker', limit: 3 });
    expect(res.status).toBe(200);
    const ids = res.body.data.items.map((i: { productId: string }) => i.productId);
    expect(ids).toContain(live._id);
    expect(ids).not.toContain(archived._id);
  });

  it('respects a budget filter and explains each recommendation', async () => {
    const s = await registerOwner();
    await makeProduct(s, { name: 'Premium Watch', price: 400, stock: 5 });
    await makeProduct(s, { name: 'Budget Watch', price: 45, stock: 5 });

    const res = await s.agent.post('/api/ai/recommendations').send({ query: 'watch under 100', limit: 3 });
    const items = res.body.data.items as { name: string; reason: string; available: boolean }[];
    expect(items.length).toBe(1);
    expect(items[0].name).toBe('Budget Watch');
    expect(items[0].reason.length).toBeGreaterThan(10);
    expect(res.body.data.appliedBudget).toBe(100);
  });

  it('discards hallucinated product ids from the AI ranking', async () => {
    env.ai.apiKey = 'test-key';
    const s = await registerOwner();
    const real = await makeProduct(s, { name: 'Real Lamp', price: 30, stock: 5 });

    vi.stubGlobal(
      'fetch',
      (async () =>
        new Response(
          JSON.stringify({
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    items: [
                      { id: '0123456789abcdef01234567', reason: 'Invented product' },
                      { id: real._id, reason: 'Genuine match for lamp' },
                    ],
                  }),
                },
              },
            ],
          }),
          { status: 200, headers: { 'content-type': 'application/json' } },
        )) as unknown as typeof fetch,
    );

    const result = await recommend({ storeId: new mongoose.Types.ObjectId(s.storeId), query: 'lamp', limit: 3 });
    expect(result.items).toHaveLength(1);
    expect(result.items[0].name).toBe('Real Lamp');
    expect(result.items[0].reason).toBe('Genuine match for lamp');
  });

  it('falls back gracefully when the AI provider errors', async () => {
    env.ai.apiKey = 'test-key';
    vi.stubGlobal(
      'fetch',
      (async () => new Response('{"error":"boom"}', { status: 500 })) as unknown as typeof fetch,
    );
    const s = await registerOwner();
    await makeProduct(s, { name: 'Fallback Mug', price: 12, stock: 9 });

    const res = await s.agent.post('/api/ai/chat').send({ message: 'mug please' });
    expect(res.status).toBe(200);
    expect(res.body.data.source).toBe('fallback');
    expect(res.body.data.reply).toMatch(/Fallback Mug/);
  });

  it('generates a product description with the template fallback', async () => {
    const s = await registerOwner();
    const res = await s.agent
      .post('/api/ai/generate-description')
      .send({ name: 'Linen Shirt', category: 'Apparel', specs: '100% linen, machine washable' });
    expect(res.status).toBe(200);
    expect(res.body.data.source).toBe('template');
    expect(res.body.data.description).toContain('Linen Shirt');
    expect(res.body.data.seoTitle).toContain('Linen Shirt');
    expect(Array.isArray(res.body.data.keywords)).toBe(true);
  });

  it('returns business insights derived from real records only', async () => {
    const s = await registerOwner();
    const p = await makeProduct(s, { name: 'Insight Item', price: 100, stock: 10 });
    const order = await s.agent.post('/api/orders').send({
      items: [{ productId: p._id, quantity: 1 }],
      customer: { name: 'Buyer', email: 'b@example.com' },
    });
    const o = order.body.data;
    await Payment.create({
      storeId: s.storeId,
      orderId: o._id,
      paypalOrderId: 'PP-INSIGHT',
      amount: o.total,
      currency: 'USD',
      status: 'created',
    });
    await finalizePaidOrder({
      paypalOrderId: 'PP-INSIGHT',
      source: 'capture',
      capture: {
        status: 'COMPLETED',
        purchase_units: [
          {
            payments: {
              captures: [
                { id: 'CAP-INSIGHT', status: 'COMPLETED', amount: { value: o.total.toFixed(2), currency_code: 'USD' } },
              ],
            },
          },
        ],
      },
    });

    const res = await s.agent.post('/api/ai/business-insights').send({});
    expect(res.status).toBe(200);
    expect(res.body.data.source).toBe('deterministic');
    expect(res.body.data.metrics.overview.revenue.gross).toBe(o.total);
    expect(res.body.data.metrics.topProducts[0].name).toBe('Insight Item');
    expect(res.body.data.observations.some((o2: string) => o2.includes(String(o.total)))).toBe(true);
  });
});

describe('analytics', () => {
  it('computes overview metrics from database records, not hardcoded values', async () => {
    const s = await registerOwner();
    const before = await s.agent.get('/api/analytics/overview');
    expect(before.body.data.revenue.gross).toBe(0);
    expect(before.body.data.orders.total).toBe(0);

    const p = await makeProduct(s, { name: 'Metric Item', price: 50, stock: 20, lowStockThreshold: 5 });
    const order = await s.agent.post('/api/orders').send({
      items: [{ productId: p._id, quantity: 2 }],
      customer: { name: 'Buyer', email: 'b@example.com' },
    });
    const o = order.body.data;

    const mid = await s.agent.get('/api/analytics/overview');
    expect(mid.body.data.orders.total).toBe(1);
    expect(mid.body.data.revenue.gross).toBe(0); // unpaid -> no revenue
    expect(mid.body.data.orders.pendingPayments).toBe(1);

    await Payment.create({
      storeId: s.storeId,
      orderId: o._id,
      paypalOrderId: 'PP-AN-1',
      amount: o.total,
      currency: 'USD',
      status: 'created',
    });
    await finalizePaidOrder({
      paypalOrderId: 'PP-AN-1',
      source: 'capture',
      capture: {
        status: 'COMPLETED',
        purchase_units: [
          {
            payments: {
              captures: [
                { id: 'CAP-AN-1', status: 'COMPLETED', amount: { value: o.total.toFixed(2), currency_code: 'USD' } },
              ],
            },
          },
        ],
      },
    });

    const after = await s.agent.get('/api/analytics/overview');
    expect(after.body.data.revenue.gross).toBe(o.total);
    expect(after.body.data.products.total).toBe(1);
    expect(after.body.data.products.lowStock).toBe(0); // 18 left, above the threshold of 5
  });

  it('returns a 30-day revenue series with one row per day', async () => {
    const s = await registerOwner();
    const res = await s.agent.get('/api/analytics/revenue?days=30');
    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(30);
    expect(res.body.data[29].date).toBe(new Date().toISOString().slice(0, 10));
  });

  it('returns order status breakdown and product performance', async () => {
    const s = await registerOwner();
    const p = await makeProduct(s, { name: 'Perf Item', price: 20 });
    await s.agent.post('/api/orders').send({
      items: [{ productId: p._id, quantity: 1 }],
      customer: { name: 'Buyer', email: 'b@example.com' },
    });
    const orders = await s.agent.get('/api/analytics/orders');
    expect(orders.body.data.statuses[0].status).toBe('pending');

    const products = await s.agent.get('/api/analytics/products');
    expect(products.status).toBe(200);
    expect(products.body.data.inventory.productCount).toBe(1);
  });

  it('requires authentication for analytics', async () => {
    const res = await request(app).get('/api/analytics/overview');
    expect(res.status).toBe(401);
  });
});
