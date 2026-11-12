import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { registerOwner, makeProduct, makeOrder } from './helpers.js';
import { env } from '../src/config/env.js';
import { Payment } from '../src/models/Payment.js';
import { Order } from '../src/models/Order.js';
import { Product } from '../src/models/Product.js';

type FetchMock = (url: string | URL | Request, init?: RequestInit) => Promise<Response>;

function json(body: unknown, ok = true, status = 200) {
  return Promise.resolve(
    new Response(JSON.stringify(body), { status: ok ? status : status, headers: { 'content-type': 'application/json' } }),
  );
}

/** Simulates the three PayPal endpoints the backend uses. */
function installPaypalMock(opts: { captureValue?: 'correct' | 'wrong'; captureStatus?: string } = {}) {
  const calls: string[] = [];
  const mock: FetchMock = async (input) => {
    const url = String(input);
    calls.push(url);
    if (url.includes('/v1/oauth2/token')) {
      return json({ access_token: 'test-token', expires_in: 3600 });
    }
    if (url.endsWith('/v2/checkout/orders')) {
      return json({ id: 'PAYPAL-ORDER-123', status: 'CREATED', links: [] }, true, 201);
    }
    if (url.includes('/v2/checkout/orders/PAYPAL-ORDER-123/capture')) {
      return json({
        id: 'PAYPAL-ORDER-123',
        status: opts.captureStatus ?? 'COMPLETED',
        payer: { email_address: 'payer@example.com', name: { given_name: 'Pat', surname: 'Payer' } },
        purchase_units: [
          {
            payments: {
              captures: [
                {
                  id: 'CAPTURE-ABC-1',
                  status: 'COMPLETED',
                  amount: { value: opts.captureValue === 'wrong' ? '1.00' : '216.00', currency_code: 'USD' },
                },
              ],
            },
          },
        ],
      });
    }
    return json({ error: 'unexpected url' }, false, 500);
  };
  vi.stubGlobal('fetch', mock as unknown as typeof fetch);
  return calls;
}

describe('paypal payments', () => {
  const original = { id: env.paypal.clientId, secret: env.paypal.clientSecret, webhook: env.paypal.webhookId };
  beforeEach(() => {
    env.paypal.clientId = 'test-client-id';
    env.paypal.clientSecret = 'test-client-secret';
    env.paypal.webhookId = '';
  });
  afterEach(() => {
    env.paypal.clientId = original.id;
    env.paypal.clientSecret = original.secret;
    env.paypal.webhookId = original.webhook;
    vi.unstubAllGlobals();
  });

  it('reports configuration state without leaking the secret', async () => {
    const s = await registerOwner();
    const res = await s.agent.get('/api/payments/paypal/config');
    expect(res.status).toBe(200);
    expect(res.body.data.configured).toBe(true);
    expect(JSON.stringify(res.body)).not.toContain('test-client-secret');
  });

  it('creates a PayPal order using the database total, not the browser total', async () => {
    installPaypalMock();
    const s = await registerOwner();
    const p = await makeProduct(s, { price: 100, stock: 10 });
    const order = await makeOrder(s, [{ productId: p._id, quantity: 2 }]);

    const res = await s.agent
      .post('/api/payments/paypal/create-order')
      .send({ orderId: order._id, orderNumber: order.orderNumber, amount: 0.01 });

    expect(res.status).toBe(201);
    expect(res.body.data.amount).toBe(216);
    const payment = await Payment.findOne({ orderId: order._id }).lean();
    expect(payment?.amount).toBe(216);
    expect(payment?.currency).toBe('USD');
  });

  it('reuses an existing PayPal order (create is idempotent)', async () => {
    installPaypalMock();
    const s = await registerOwner();
    const p = await makeProduct(s, { price: 100 });
    const order = await makeOrder(s, [{ productId: p._id, quantity: 1 }]);

    const first = await s.agent
      .post('/api/payments/paypal/create-order')
      .send({ orderId: order._id, orderNumber: order.orderNumber });
    const second = await s.agent
      .post('/api/payments/paypal/create-order')
      .send({ orderId: order._id, orderNumber: order.orderNumber });

    expect(first.status).toBe(201);
    expect(second.status).toBe(200);
    expect(second.body.data.reused).toBe(true);
    expect(await Payment.countDocuments({ orderId: order._id })).toBe(1);
  });

  it('captures, verifies and deducts stock exactly once', async () => {
    installPaypalMock();
    const s = await registerOwner();
    const p = await makeProduct(s, { price: 100, stock: 10 });
    const order = await makeOrder(s, [{ productId: p._id, quantity: 2 }]);
    await s.agent
      .post('/api/payments/paypal/create-order')
      .send({ orderId: order._id, orderNumber: order.orderNumber });

    const capture = await s.agent
      .post('/api/payments/paypal/capture-order')
      .send({ paypalOrderId: 'PAYPAL-ORDER-123' });

    expect(capture.status).toBe(200);
    expect(capture.body.data.verified).toBe(true);
    expect(capture.body.data.order.paymentStatus).toBe('paid');
    expect(capture.body.data.order.status).toBe('paid');

    const after = await Product.findById(p._id).lean();
    expect(after?.stock).toBe(8);

    // duplicate capture -> no second deduction
    const again = await s.agent
      .post('/api/payments/paypal/capture-order')
      .send({ paypalOrderId: 'PAYPAL-ORDER-123' });
    expect(again.status).toBe(200);
    expect(again.body.data.alreadyProcessed).toBe(true);

    const final = await Product.findById(p._id).lean();
    expect(final?.stock).toBe(8);
    expect(final?.salesCount).toBe(1);
  });

  it('refuses to mark an order paid when the captured amount does not match', async () => {
    installPaypalMock({ captureValue: 'wrong' });
    const s = await registerOwner();
    const p = await makeProduct(s, { price: 100, stock: 10 });
    const order = await makeOrder(s, [{ productId: p._id, quantity: 2 }]);
    await s.agent
      .post('/api/payments/paypal/create-order')
      .send({ orderId: order._id, orderNumber: order.orderNumber });

    const res = await s.agent
      .post('/api/payments/paypal/capture-order')
      .send({ paypalOrderId: 'PAYPAL-ORDER-123' });

    expect(res.status).toBe(400);
    expect(res.body.error.details).toBe('amount_mismatch');

    const fresh = await Order.findById(order._id).lean();
    expect(fresh?.paymentStatus).not.toBe('paid');
    const product = await Product.findById(p._id).lean();
    expect(product?.stock).toBe(10); // nothing deducted
    const payment = await Payment.findOne({ orderId: order._id }).lean();
    expect(payment?.status).toBe('failed');
  });

  it('rejects a webhook without a valid signature', async () => {
    const s = await registerOwner();
    const res = await s.agent
      .post('/api/payments/paypal/webhook')
      .set('paypal-transmission-id', 'abc')
      .send({ event_type: 'PAYMENT.CAPTURE.COMPLETED', resource: { id: 'CAP-1' } });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('invalid_signature');
  });

  it('ignores a spoofed webhook that lacks PayPal transmission headers', async () => {
    const s = await registerOwner();
    const p = await makeProduct(s, { price: 50, stock: 4 });
    const order = await makeOrder(s, [{ productId: p._id, quantity: 1 }]);
    await Payment.create({
      storeId: s.storeId,
      orderId: order._id,
      paypalOrderId: 'PAYPAL-ORDER-123',
      amount: order.total,
      currency: 'USD',
      status: 'created',
    });

    const res = await s.agent
      .post('/api/payments/paypal/webhook')
      .send({
        event_type: 'PAYMENT.CAPTURE.COMPLETED',
        resource: { id: 'CAP-9', amount: { value: String(order.total), currency_code: 'USD' } },
      });
    expect(res.status).toBe(400);

    const fresh = await Order.findById(order._id).lean();
    expect(fresh?.paymentStatus).toBe('unpaid');
  });

  it('accepts a webhook only after PayPal confirms the signature', async () => {
    env.paypal.webhookId = 'WEBHOOK-TEST-ID';
    const calls: string[] = [];
    vi.stubGlobal(
      'fetch',
      (async (input: string | URL | Request) => {
        const url = String(input);
        calls.push(url);
        if (url.includes('/v1/oauth2/token')) {
          return json({ access_token: 't', expires_in: 3600 });
        }
        if (url.includes('/v1/notifications/verify-webhook-signature')) {
          return json({ verification_status: 'SUCCESS' });
        }
        return json({}, false, 500);
      }) as unknown as typeof fetch,
    );

    const s = await registerOwner();
    const p = await makeProduct(s, { price: 100, stock: 5 });
    const order = await makeOrder(s, [{ productId: p._id, quantity: 1 }]);
    await Payment.create({
      storeId: s.storeId,
      orderId: order._id,
      paypalOrderId: 'PAYPAL-ORDER-123',
      amount: order.total,
      currency: 'USD',
      status: 'created',
    });

    const res = await s.agent
      .post('/api/payments/paypal/webhook')
      .set('paypal-transmission-id', 'tid')
      .set('paypal-transmission-time', new Date().toISOString())
      .set('paypal-cert-url', 'https://api.paypal.com/cert.pem')
      .set('paypal-auth-algo', 'SHA256withRSA')
      .set('paypal-transmission-sig', 'sig')
      .send({
        event_type: 'PAYMENT.CAPTURE.COMPLETED',
        resource: {
          id: 'CAPTURE-WEBHOOK-1',
          status: 'COMPLETED',
          amount: { value: order.total.toFixed(2), currency_code: 'USD' },
          supplementary_data: { related_ids: { order_id: 'PAYPAL-ORDER-123' } },
        },
      });

    expect(res.status).toBe(200);
    expect(calls.some((c) => c.includes('verify-webhook-signature'))).toBe(true);

    const fresh = await Order.findById(order._id).lean();
    expect(fresh?.paymentStatus).toBe('paid');
    const product = await Product.findById(p._id).lean();
    expect(product?.stock).toBe(4);
  });

  it('fails safely when PayPal is not configured', async () => {
    env.paypal.clientId = '';
    env.paypal.clientSecret = '';
    const s = await registerOwner();
    const p = await makeProduct(s, { price: 10 });
    const order = await makeOrder(s, [{ productId: p._id, quantity: 1 }]);
    const res = await s.agent
      .post('/api/payments/paypal/create-order')
      .send({ orderId: order._id, orderNumber: order.orderNumber });
    expect(res.status).toBe(502);
    expect(JSON.stringify(res.body)).toContain('paypal_not_configured');
  });
});
