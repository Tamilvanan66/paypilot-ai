import request from 'supertest';
import { createApp } from '../src/app.js';

export const app = createApp();

export interface Session {
  agent: ReturnType<typeof request.agent>;
  token: string;
  storeId: string;
  userId: string;
}

export async function registerOwner(
  email = 'owner@example.com',
  storeName = 'Test Store',
): Promise<Session> {
  const agent = request.agent(app);
  const res = await agent
    .post('/api/auth/register')
    .send({ name: 'Owner One', email, password: 'Password123!', storeName });
  if (res.status !== 201) throw new Error(`register failed: ${res.status} ${JSON.stringify(res.body)}`);
  const cookie = res.headers['set-cookie']?.[0] ?? '';
  const token = decodeURIComponent(cookie.split('=')[1]?.split(';')[0] ?? '');
  return { agent, token, storeId: res.body.data.user.storeId, userId: res.body.data.user.id };
}

export async function makeProduct(
  session: Session,
  overrides: Record<string, unknown> = {},
): Promise<Record<string, any>> {
  const body = {
    name: 'Test Widget',
    sku: `SKU-${Math.random().toString(36).slice(2, 8).toUpperCase()}`,
    price: 100,
    stock: 10,
    shortDescription: 'A test widget',
    description: 'A test widget for automated tests.',
    ...overrides,
  };
  const res = await session.agent.post('/api/products').send(body);
  if (res.status !== 201) throw new Error(`product failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.data;
}

export async function makeOrder(
  session: Session,
  items: { productId: string; quantity: number }[],
  customerEmail = 'buyer@example.com',
): Promise<Record<string, any>> {
  const res = await session.agent.post('/api/orders').send({
    items,
    customer: { name: 'Buyer One', email: customerEmail },
  });
  if (res.status !== 201) throw new Error(`order failed: ${res.status} ${JSON.stringify(res.body)}`);
  return res.body.data;
}
