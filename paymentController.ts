import type { Request, Response } from 'express';
import { Types } from 'mongoose';
import { Order } from '../models/Order.js';
import { Payment, Transaction } from '../models/Payment.js';
import { ApiError } from '../utils/errors.js';
import { env, paypalConfigured } from '../config/env.js';
import {
  capturePayPalOrder,
  createPayPalOrder,
  verifyPayPalWebhookSignature,
} from '../services/paypal.js';
import { finalizePaidOrder } from '../services/payments.js';
import { paginate, parsePagination, round2 } from '../utils/helpers.js';
import { Notification } from '../models/Notification.js';

const storeIdOf = (req: Request) => new Types.ObjectId(String(req.user!.storeId));

export async function paypalConfig(_req: Request, res: Response) {
  res.json({
    success: true,
    data: {
      configured: paypalConfigured(),
      environment: env.paypal.envName,
      currency: env.paypal.currency,
      clientId: paypalConfigured() ? env.paypal.clientId : null,
      webhookConfigured: Boolean(env.paypal.webhookId),
    },
  });
}

export async function createOrder(req: Request, res: Response) {
  const storeId = storeIdOf(req);
  const { orderId, orderNumber } = req.body as { orderId: string; orderNumber: string };

  const order = await Order.findOne({ _id: orderId, storeId });
  if (!order) throw ApiError.notFound('Order not found');
  if (order.orderNumber !== orderNumber) throw ApiError.badRequest('Order number does not match');
  if (order.paymentStatus === 'paid') throw ApiError.conflict('This order is already paid');
  if (order.status === 'cancelled') throw ApiError.conflict('This order was cancelled');

  // Reuse an existing live PayPal order for this order (idempotent).
  const existing = await Payment.findOne({
    orderId: order._id,
    status: { $in: ['created', 'approved'] },
  }).sort({ createdAt: -1 });

  if (existing) {
    return res.json({
      success: true,
      data: {
        paypalOrderId: existing.paypalOrderId,
        amount: existing.amount,
        currency: existing.currency,
        reused: true,
      },
    });
  }

  // Total comes from the DB — never from the browser.
  const amount = round2(order.total);
  const created = await createPayPalOrder({
    amount,
    currency: order.currency,
    referenceId: String(order._id),
    description: `Order ${order.orderNumber}`,
  });

  await Payment.create({
    storeId,
    orderId: order._id,
    provider: 'paypal',
    paypalOrderId: created.id,
    status: 'created',
    amount,
    currency: order.currency,
    rawCreate: created,
  });

  order.paymentStatus = 'pending';
  await order.save();

  res.status(201).json({
    success: true,
    data: { paypalOrderId: created.id, amount, currency: order.currency, reused: false },
  });
}

export async function captureOrder(req: Request, res: Response) {
  const { paypalOrderId } = req.body as { paypalOrderId: string };

  const payment = await Payment.findOne({ paypalOrderId });
  if (!payment) throw ApiError.notFound('Unknown PayPal order');

  // Scope: an authenticated dashboard user may only capture their own store's payments.
  if (req.user && String(payment.storeId) !== String(req.user.storeId)) {
    throw ApiError.forbidden('This payment belongs to another store');
  }

  if (payment.status === 'captured') {
    const order = await Order.findById(payment.orderId).lean();
    return res.json({
      success: true,
      data: { order, payment, alreadyProcessed: true },
    });
  }

  let capture: Record<string, unknown>;
  try {
    capture = await capturePayPalOrder(paypalOrderId);
  } catch (err) {
    payment.status = 'failed';
    payment.failureReason = (err as Error).message;
    await payment.save();
    await Notification.create({
      storeId: payment.storeId,
      type: 'payment_failed',
      severity: 'error',
      title: 'PayPal capture failed',
      body: (err as Error).message.slice(0, 300),
      link: `/orders/${String(payment.orderId)}`,
    });
    if (err instanceof ApiError) throw err;
    throw ApiError.upstream('PayPal capture failed');
  }

  const result = await finalizePaidOrder({ paypalOrderId, capture, source: 'capture' });

  if (!result.ok) {
    throw ApiError.badRequest(`Payment could not be verified (${result.reason})`, result.reason);
  }

  const order = await Order.findById(payment.orderId).lean();
  res.json({
    success: true,
    data: {
      order,
      payment: result.payment,
      alreadyProcessed: 'alreadyProcessed' in result ? result.alreadyProcessed : false,
      verified: true,
    },
  });
}

export async function webhook(req: Request, res: Response) {
  const event = req.body as Record<string, unknown>;
  const eventType = String(event.event_type ?? '');
  const resource = (event.resource as Record<string, unknown>) ?? {};

  const verification = await verifyPayPalWebhookSignature({
    transmissionId: req.header('paypal-transmission-id') ?? undefined,
    transmissionTime: req.header('paypal-transmission-time') ?? undefined,
    certUrl: req.header('paypal-cert-url') ?? undefined,
    authAlgo: req.header('paypal-auth-algo') ?? undefined,
    transmissionSig: req.header('paypal-transmission-sig') ?? undefined,
    webhookEvent: event,
  });

  if (!verification.verified) {
    // 400 tells PayPal to retry; the event is never trusted.
    return res.status(400).json({
      success: false,
      error: { code: 'invalid_signature', message: verification.reason ?? 'Signature verification failed' },
    });
  }

  try {
    if (eventType === 'CHECKOUT.ORDER.APPROVED') {
      const paypalOrderId = String(resource.id ?? '');
      await Payment.updateOne({ paypalOrderId }, { $set: { status: 'approved' } });
    } else if (eventType === 'PAYMENT.CAPTURE.COMPLETED') {
      const supplementary = (resource.supplementary_data as Record<string, unknown> | undefined) ?? {};
      const related = (supplementary.related_ids as Record<string, unknown> | undefined) ?? {};
      const paypalOrderId = String(related.order_id ?? '');
      if (paypalOrderId) {
        const reconstructed = {
          id: paypalOrderId,
          status: 'COMPLETED',
          purchase_units: [
            {
              payments: { captures: [resource] },
            },
          ],
          payer: { email_address: '' },
        };
        await finalizePaidOrder({ paypalOrderId, capture: reconstructed, source: 'webhook' });
      }
    } else if (eventType === 'PAYMENT.CAPTURE.DENIED' || eventType === 'PAYMENT.CAPTURE.REFUNDED') {
      const captureId = String(resource.id ?? '');
      const payment = await Payment.findOne({ captureId });
      if (payment) {
        if (eventType === 'PAYMENT.CAPTURE.REFUNDED') {
          payment.status = 'refunded';
          await payment.save();
          await Transaction.updateOne(
            { providerTransactionId: captureId },
            { $set: { status: 'reversed' } },
          );
          const refundId = `${captureId}-refund`;
          await Transaction.updateOne(
            { providerTransactionId: refundId },
            {
              $setOnInsert: {
                storeId: payment.storeId,
                orderId: payment.orderId,
                paymentId: payment._id,
                type: 'refund',
                provider: 'paypal',
                providerTransactionId: refundId,
                amount: payment.amount,
                currency: payment.currency,
                status: 'completed',
                source: 'webhook',
              },
            },
            { upsert: true },
          );
          await Order.updateOne(
            { _id: payment.orderId, paymentStatus: 'paid' },
            { $set: { paymentStatus: 'refunded', status: 'refunded', refundedAt: new Date() } },
          );
          await Notification.create({
            storeId: payment.storeId,
            type: 'payment_failed',
            severity: 'warning',
            title: 'Payment refunded by PayPal',
            body: `Capture ${captureId} was refunded.`,
            link: `/orders/${String(payment.orderId)}`,
          });
        } else {
          payment.status = 'failed';
          payment.failureReason = 'Denied by PayPal webhook';
          await payment.save();
          await Notification.create({
            storeId: payment.storeId,
            type: 'payment_failed',
            severity: 'error',
            title: 'Payment denied by PayPal',
            body: `Capture ${captureId} was denied.`,
            link: `/orders/${String(payment.orderId)}`,
          });
        }
      }
    }
    return res.json({ success: true, data: { received: true, eventType } });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error('[paypal-webhook]', err);
    return res.status(500).json({
      success: false,
      error: { code: 'webhook_processing_failed', message: 'Could not process webhook' },
    });
  }
}

export async function listPayments(req: Request, res: Response) {
  const storeId = storeIdOf(req);
  const { page, limit, skip } = parsePagination(req.query as Record<string, unknown>);
  const [items, total] = await Promise.all([
    Payment.find({ storeId }).sort({ createdAt: -1 }).skip(skip).limit(limit).lean(),
    Payment.countDocuments({ storeId }),
  ]);
  const transactions = await Transaction.find({ storeId }).sort({ createdAt: -1 }).limit(20).lean();
  res.json({ success: true, data: { ...paginate(items, total, page, limit), transactions } });
}
