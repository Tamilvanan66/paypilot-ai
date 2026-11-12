import { describe, it, expect } from 'vitest';
import { registerOwner, makeProduct } from './helpers.js';
import { finalizePaidOrder } from '../src/services/payments.js';
import { Payment } from '../src/models/Payment.js';
import { Order } from '../src/models/Order.js';
import { Product } from '../src/models/Product.js';
import { InventoryMovement } from '../src/models/InventoryMovement.js';

async function payOrder(session: { storeId: string }, order: Record<string, any>, value?: number) {
  // upsert so replaying the same capture in a test does not hit the unique index
  await Payment.updateOne(
    { paypalOrderId: `PP-${order._id}` },
    {
      $setOnInsert: {
        storeId: session.storeId,
        orderId: order._id,
        paypalOrderId: `PP-${order._id}`,
        amount: order.total,
        currency: 'USD',
        status: 'created',
      },
    },
    { upsert: true },
  );
  return finalizePaidOrder({
    paypalOrderId: `PP-${order._id}`,
    source: 'capture',
    capture: {
      id: `PP-${order._id}`,
      status: 'COMPLETED',
      payer: { email_address: 'p@example.com' },
      purchase_units: [
        {
          payments: {
            captures: [
              {
                id: `CAP-${order._id}`,
                status: 'COMPLETED',
                amount: { value: String(value ?? order.total), currency_code: 'USD' },
              },
            ],
          },
        },
      ],
    },
  });
}

describe('inventory management', () => {
  it('records an initial movement and lists it', async () => {
    const s = await registerOwner();
    const p = await makeProduct(s, { stock: 12 });
    const movements = await s.agent.get('/api/inventory/movements');
    expect(movements.status).toBe(200);
    expect(movements.body.data.items).toHaveLength(1);
    expect(movements.body.data.items[0].type).toBe('initial');
    expect(movements.body.data.items[0].newStock).toBe(12);
    expect(p.stock).toBe(12);
  });

  it('adjusts stock with an audit trail and rejects negative stock', async () => {
    const s = await registerOwner();
    const p = await makeProduct(s, { stock: 5 });

    const ok = await s.agent.put(`/api/inventory/${p._id}`).send({ newStock: 9, reason: 'Delivery received' });
    expect(ok.status).toBe(200);
    const fresh = await Product.findById(p._id).lean();
    expect(fresh?.stock).toBe(9);

    const movements = await s.agent.get(`/api/inventory/movements?productId=${p._id}`);
    const adjustment = movements.body.data.items.find((m: { type: string }) => m.type === 'restock');
    expect(adjustment.quantityChange).toBe(4);
    expect(adjustment.previousStock).toBe(5);

    const bad = await s.agent.put(`/api/inventory/${p._id}`).send({ newStock: -3, reason: 'oops' });
    expect(bad.status).toBe(400);

    const noReason = await s.agent.put(`/api/inventory/${p._id}`).send({ newStock: 4 });
    expect(noReason.status).toBe(400);
  });

  it('deducts stock once and restores it on cancellation', async () => {
    const s = await registerOwner();
    const p = await makeProduct(s, { price: 100, stock: 10 });
    const created = await s.agent.post('/api/orders').send({
      items: [{ productId: p._id, quantity: 3 }],
      customer: { name: 'Buyer', email: 'b@example.com' },
    });
    const order = created.body.data;

    const paid = await payOrder(s, order);
    expect(paid.ok).toBe(true);
    expect((await Product.findById(p._id).lean())?.stock).toBe(7);

    const cancel = await s.agent.put(`/api/orders/${order._id}/status`).send({ status: 'cancelled' });
    expect(cancel.status).toBe(200);
    expect((await Product.findById(p._id).lean())?.stock).toBe(10);

    const restore = await InventoryMovement.findOne({ orderId: order._id, type: 'cancellation_restore' }).lean();
    expect(restore?.quantityChange).toBe(3);

    // cancelling again must not restore twice
    const repeat = await s.agent.put(`/api/orders/${order._id}/status`).send({ status: 'cancelled' });
    expect(repeat.status).toBe(200);
    expect((await Product.findById(p._id).lean())?.stock).toBe(10);
  });

  it('is idempotent when the same capture is replayed', async () => {
    const s = await registerOwner();
    const p = await makeProduct(s, { price: 100, stock: 10 });
    const created = await s.agent.post('/api/orders').send({
      items: [{ productId: p._id, quantity: 2 }],
      customer: { name: 'Buyer', email: 'b@example.com' },
    });
    const order = created.body.data;

    const first = await payOrder(s, order);
    const second = await payOrder(s, order);
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    expect((await Product.findById(p._id).lean())?.stock).toBe(8);
    expect(await Order.countDocuments({ _id: order._id, paymentStatus: 'paid' })).toBe(1);
  });

  it('raises a low-stock notification when the last units sell', async () => {
    const s = await registerOwner();
    const p = await makeProduct(s, { price: 100, stock: 3, lowStockThreshold: 2 });
    const created = await s.agent.post('/api/orders').send({
      items: [{ productId: p._id, quantity: 2 }],
      customer: { name: 'Buyer', email: 'b@example.com' },
    });
    await payOrder(s, created.body.data);

    const notifications = await s.agent.get('/api/notifications');
    expect(
      notifications.body.data.items.some((n: { type: string }) => n.type === 'low_inventory'),
    ).toBe(true);
  });

  it('reports inventory summary and low/out filters', async () => {
    const s = await registerOwner();
    const low = await makeProduct(s, { name: 'Nearly Gone', stock: 2, lowStockThreshold: 5 });
    await makeProduct(s, { name: 'Plenty', stock: 40 });
    await makeProduct(s, { name: 'Sold Out', stock: 0 });

    const all = await s.agent.get('/api/inventory');
    expect(all.body.data.summary.units).toBe(42);
    expect(all.body.data.summary.low).toBe(1);
    expect(all.body.data.summary.out).toBe(1);

    const filtered = await s.agent.get('/api/inventory?filter=low');
    expect(filtered.body.data.items).toHaveLength(1);
    expect(filtered.body.data.items[0]._id).toBe(low._id);
  });

  it('blocks stock deduction beyond what exists', async () => {
    const s = await registerOwner();
    const p = await makeProduct(s, { price: 10, stock: 1 });
    const created = await s.agent.post('/api/orders').send({
      items: [{ productId: p._id, quantity: 1 }],
      customer: { name: 'Buyer', email: 'b@example.com' },
    });
    const order = created.body.data;
    // simulate another sale consuming the stock first
    await Product.updateOne({ _id: p._id }, { $set: { stock: 0 } });

    const result = await payOrder(s, order);
    // payment captured; inventory commit fails and is flagged, stock never goes negative
    expect(result.ok).toBe(true);
    const fresh = await Product.findById(p._id).lean();
    expect(fresh?.stock).toBe(0);
    const notifications = await s.agent.get('/api/notifications');
    expect(
      notifications.body.data.items.some((n: { title: string }) => /could not be reserved/i.test(n.title)),
    ).toBe(true);
  });
});
