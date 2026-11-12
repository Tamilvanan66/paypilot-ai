import { describe, it, expect } from 'vitest';
import { registerOwner, makeProduct, makeOrder } from './helpers.js';

describe('order workflow', () => {
  it('prices the order from database values, ignoring browser input', async () => {
    const s = await registerOwner();
    const p = await makeProduct(s, { price: 100, stock: 10 });

    const res = await s.agent.post('/api/orders').send({
      items: [{ productId: p._id, quantity: 2 }],
      customer: { name: 'Buyer', email: 'buyer@example.com' },
      total: 0.01,
      subtotal: 0.01,
    });
    expect(res.status).toBe(201);
    // subtotal 200, shipping 0 (>=75), tax 8% = 16
    expect(res.body.data.subtotal).toBe(200);
    expect(res.body.data.tax).toBe(16);
    expect(res.body.data.shipping).toBe(0);
    expect(res.body.data.total).toBe(216);
    expect(res.body.data.paymentStatus).toBe('unpaid');
    expect(res.body.data.status).toBe('pending');
  });

  it('applies shipping under the free-shipping threshold', async () => {
    const s = await registerOwner();
    const p = await makeProduct(s, { price: 20 });
    const order = await makeOrder(s, [{ productId: p._id, quantity: 1 }]);
    expect(order.subtotal).toBe(20);
    expect(order.shipping).toBe(5);
    expect(order.total).toBe(26.6);
  });

  it('rejects an order that exceeds available stock', async () => {
    const s = await registerOwner();
    const p = await makeProduct(s, { stock: 2 });
    const res = await s.agent.post('/api/orders').send({
      items: [{ productId: p._id, quantity: 5 }],
      customer: { name: 'Buyer', email: 'buyer@example.com' },
    });
    expect(res.status).toBe(409);
    expect(res.body.error.message).toMatch(/insufficient stock/i);
  });

  it('rejects an empty or malformed order', async () => {
    const s = await registerOwner();
    const empty = await s.agent.post('/api/orders').send({
      items: [],
      customer: { name: 'Buyer', email: 'buyer@example.com' },
    });
    expect(empty.status).toBe(400);

    const badId = await s.agent.post('/api/orders').send({
      items: [{ productId: 'nope', quantity: 1 }],
      customer: { name: 'Buyer', email: 'buyer@example.com' },
    });
    expect(badId.status).toBe(400);
  });

  it('lists, filters and searches orders', async () => {
    const s = await registerOwner();
    const p = await makeProduct(s, { stock: 50 });
    await makeOrder(s, [{ productId: p._id, quantity: 1 }], 'first@example.com');
    await makeOrder(s, [{ productId: p._id, quantity: 2 }], 'second@example.com');

    const all = await s.agent.get('/api/orders');
    expect(all.body.data.total).toBe(2);
    expect(all.body.data.statusCounts.pending).toBe(2);

    const filtered = await s.agent.get('/api/orders?search=second');
    expect(filtered.body.data.total).toBe(1);
    expect(filtered.body.data.items[0].customerEmail).toBe('second@example.com');
  });

  it('enforces valid status transitions', async () => {
    const s = await registerOwner();
    const p = await makeProduct(s);
    const order = await makeOrder(s, [{ productId: p._id, quantity: 1 }]);

    // cannot ship an unpaid order
    const ship = await s.agent.put(`/api/orders/${order._id}/status`).send({ status: 'shipped' });
    expect(ship.status).toBe(400);

    // illegal jump
    const jump = await s.agent.put(`/api/orders/${order._id}/status`).send({ status: 'delivered' });
    expect(jump.status).toBe(400);

    const cancel = await s.agent.put(`/api/orders/${order._id}/status`).send({ status: 'cancelled' });
    expect(cancel.status).toBe(200);
    expect(cancel.body.data.fulfilmentStatus).toBe('cancelled');

    const after = await s.agent.put(`/api/orders/${order._id}/status`).send({ status: 'processing' });
    expect(after.status).toBe(400);
  });

  it('creates a notification for a new order', async () => {
    const s = await registerOwner();
    const p = await makeProduct(s);
    await makeOrder(s, [{ productId: p._id, quantity: 1 }]);
    const notifications = await s.agent.get('/api/notifications');
    expect(notifications.body.data.unreadCount).toBeGreaterThan(0);
    expect(notifications.body.data.items.some((n: { type: string }) => n.type === 'new_order')).toBe(true);
  });
});
