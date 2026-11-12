import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { app, registerOwner, makeProduct } from './helpers.js';

describe('product management', () => {
  it('creates, reads, updates and deletes a product', async () => {
    const s = await registerOwner();
    const created = await makeProduct(s, { name: 'Aurora Lamp', price: 42.5, stock: 7 });
    expect(created.price).toBe(42.5);
    expect(created.stock).toBe(7);

    const list = await s.agent.get('/api/products');
    expect(list.status).toBe(200);
    expect(list.body.data.items).toHaveLength(1);
    expect(list.body.data.total).toBe(1);

    const updated = await s.agent
      .put(`/api/products/${created._id}`)
      .send({ name: 'Aurora Lamp Pro', price: 55 });
    expect(updated.status).toBe(200);
    expect(updated.body.data.name).toBe('Aurora Lamp Pro');
    expect(updated.body.data.price).toBe(55);
    // stock is only mutable through /inventory
    expect(updated.body.data.stock).toBe(7);

    const removed = await s.agent.delete(`/api/products/${created._id}`);
    expect(removed.status).toBe(200);
    expect(removed.body.data.deleted).toBe(true);

    const gone = await s.agent.get(`/api/products/${created._id}`);
    expect(gone.status).toBe(404);
  });

  it('validates required fields and rejects negative prices', async () => {
    const s = await registerOwner();
    const bad = await s.agent.post('/api/products').send({ name: 'x', sku: '', price: -5, stock: -1 });
    expect(bad.status).toBe(400);
    const fields = bad.body.error.details.map((d: { field: string }) => d.field);
    expect(fields).toEqual(expect.arrayContaining(['name', 'sku', 'price', 'stock']));
  });

  it('rejects duplicate SKUs inside one store', async () => {
    const s = await registerOwner();
    await makeProduct(s, { sku: 'DUP-1' });
    const dup = await s.agent
      .post('/api/products')
      .send({ name: 'Second', sku: 'DUP-1', price: 10, stock: 1 });
    expect(dup.status).toBe(409);
  });

  it('paginates and searches', async () => {
    const s = await registerOwner();
    for (let i = 0; i < 7; i += 1) {
      await makeProduct(s, { name: i % 2 === 0 ? `Blue Kettle ${i}` : `Red Toaster ${i}` });
    }
    const page1 = await s.agent.get('/api/products?page=1&limit=3');
    expect(page1.body.data.items).toHaveLength(3);
    expect(page1.body.data.totalPages).toBe(3);

    const searched = await s.agent.get('/api/products?search=kettle');
    expect(searched.body.data.total).toBe(4);
  });

  it('archives instead of deleting a product that has orders', async () => {
    const s = await registerOwner();
    const p = await makeProduct(s);
    await s.agent.post('/api/orders').send({
      items: [{ productId: p._id, quantity: 1 }],
      customer: { name: 'Buyer', email: 'b@example.com' },
    });
    const res = await s.agent.delete(`/api/products/${p._id}`);
    expect(res.status).toBe(200);
    expect(res.body.data.archived).toBe(true);

    const detail = await s.agent.get(`/api/products/${p._id}`);
    expect(detail.body.data.product.status).toBe('archived');
  });

  it('keeps stores isolated from each other', async () => {
    const a = await registerOwner('a@example.com', 'Store A');
    const b = await registerOwner('b@example.com', 'Store B');
    const product = await makeProduct(a);

    const listB = await b.agent.get('/api/products');
    expect(listB.body.data.total).toBe(0);

    const direct = await b.agent.get(`/api/products/${product._id}`);
    expect(direct.status).toBe(404);

    const steal = await b.agent.put(`/api/products/${product._id}`).send({ price: 1 });
    expect(steal.status).toBe(404);
  });

  it('enforces role-based authorisation on delete', async () => {
    const s = await registerOwner('role@example.com');
    const product = await makeProduct(s);

    // downgrade the same user to manager, then attempt an owner-only action
    const { User } =await import('../src/models/User.js');
    await User.updateOne({ email: 'role@example.com' }, { $set: { role: 'manager' } });

    const asManager = await s.agent.delete(`/api/products/${product._id}`);
    expect(asManager.status).toBe(403);

    const edit = await s.agent.put(`/api/products/${product._id}`).send({ price: 12 });
    expect(edit.status).toBe(200);
  });
});
