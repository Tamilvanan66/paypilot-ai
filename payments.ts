import mongoose from 'mongoose';
import { Order } from '../models/Order.js';
import { Payment, Transaction } from '../models/Payment.js';
import { Notification } from '../models/Notification.js';
import { commitOrderInventory } from './inventory.js';
import { round2 } from '../utils/helpers.js';

export interface CaptureVerifyInput {
  paypalOrderId: string;
  /** The capture payload returned by PayPal (or reconstructed from a webhook). */
  capture: Record<string, unknown>;
  source: 'capture' | 'webhook';
}

export function extractCapture(capture: Record<string, unknown>) {
  const units = (capture.purchase_units as Record<string, unknown>[] | undefined) ?? [];
  const first = units[0] ?? {};
  const payments = (first.payments as Record<string, unknown> | undefined) ?? {};
  const captures = (payments.captures as Record<string, unknown>[] | undefined) ?? [];
  const primary = captures[0] ?? {};
  const amount = (primary.amount as { value?: string; currency_code?: string } | undefined) ?? {};
  const payer = (capture.payer as Record<string, unknown> | undefined) ?? {};
  const payerName = (payer.name as { given_name?: string; surname?: string } | undefined) ?? {};
  return {
    status: String(capture.status ?? primary.status ?? ''),
    captureId: primary.id ? String(primary.id) : null,
    value: amount.value !== undefined ? Number(amount.value) : null,
    currency: amount.currency_code ? String(amount.currency_code).toUpperCase() : null,
    payerEmail: payer.email_address ? String(payer.email_address) : '',
    payerName: [payerName.given_name, payerName.surname].filter(Boolean).join(' '),
    transactionStatus: primary.status ? String(primary.status) : '',
  };
}

/**
 * Single idempotent entry point that marks an order paid.
 * Safe to call from both the capture endpoint and the webhook: the order is
 * claimed with an atomic conditional update, so stock can only be deducted once.
 */
export async function finalizePaidOrder(input: CaptureVerifyInput) {
  const { paypalOrderId, capture, source } = input;

  const payment = await Payment.findOne({ paypalOrderId });
  if (!payment) return { ok: false as const, reason: 'unknown_payment' };

  const order = await Order.findById(payment.orderId);
  if (!order) return { ok: false as const, reason: 'unknown_order' };

  const details = extractCapture(capture);

  // ---- amount / currency verification against the trusted local order ----
  const expected = round2(order.total);
  if (details.value === null) {
    return { ok: false as const, reason: 'missing_amount' };
  }
  if (round2(details.value) !== expected) {
    payment.status = 'failed';
    payment.failureReason = `Amount mismatch: PayPal ${details.value} vs order ${expected}`;
    await payment.save();
    await Notification.create({
      storeId: order.storeId,
      type: 'payment_failed',
      severity: 'error',
      title: `Amount mismatch on ${order.orderNumber}`,
      body: `PayPal captured ${details.value} ${details.currency ?? ''} but the order total is ${expected}.`,
      link: `/orders/${String(order._id)}`,
    });
    return { ok: false as const, reason: 'amount_mismatch' };
  }
  if (details.currency && details.currency !== order.currency) {
    payment.status = 'failed';
    payment.failureReason = `Currency mismatch: ${details.currency} vs ${order.currency}`;
    await payment.save();
    return { ok: false as const, reason: 'currency_mismatch' };
  }
  if (!['COMPLETED', 'APPROVED'].includes(details.status) && details.transactionStatus !== 'COMPLETED') {
    payment.status = 'failed';
    payment.failureReason = `Unexpected PayPal status: ${details.status}`;
    await payment.save();
    return { ok: false as const, reason: 'not_completed' };
  }

  // ---- claim the order atomically: only one caller can flip unpaid -> paid ----
  const claimed = await Order.findOneAndUpdate(
    { _id: order._id, paymentStatus: { $ne: 'paid' } },
    {
      $set: {
        paymentStatus: 'paid',
        status: order.status === 'pending' ? 'paid' : order.status,
        paidAt: new Date(),
      },
    },
    { new: true },
  );

  payment.captureId = details.captureId ?? payment.captureId;
  payment.payerEmail = details.payerEmail || payment.payerEmail;
  payment.payerName = details.payerName || payment.payerName;
  if (source === 'capture') payment.rawCapture = capture;
  if (details.status === 'COMPLETED' || details.transactionStatus === 'COMPLETED') {
    payment.status = 'captured';
  }
  await payment.save();

  if (!claimed) {
    // Already paid (duplicate capture / webhook replay) — record tx idempotently.
    if (details.captureId) {
      await Transaction.updateOne(
        { providerTransactionId: details.captureId },
        {
          $setOnInsert: {
            storeId: order.storeId,
            orderId: order._id,
            paymentId: payment._id,
            type: 'sale',
            provider: 'paypal',
            providerTransactionId: details.captureId,
            amount: expected,
            currency: order.currency,
            status: 'completed',
            source,
          },
        },
        { upsert: true },
      );
    }
    return { ok: true as const, alreadyProcessed: true, order: claimed ?? order, payment };
  }

  if (details.captureId) {
    await Transaction.updateOne(
      { providerTransactionId: details.captureId },
      {
        $setOnInsert: {
          storeId: order.storeId,
          orderId: order._id,
          paymentId: payment._id,
          type: 'sale',
          provider: 'paypal',
          providerTransactionId: details.captureId,
          amount: expected,
          currency: order.currency,
          status: 'completed',
          source,
        },
      },
      { upsert: true },
    );
  }

  // ---- inventory deduction (idempotent per order) ----
  const inventoryClaim = await Order.findOneAndUpdate(
    { _id: order._id, inventoryCommitted: false },
    { $set: { inventoryCommitted: true } },
    { new: true },
  );

  if (inventoryClaim) {
    try {
      await commitOrderInventory({
        storeId: order.storeId as mongoose.Types.ObjectId,
        orderId: order._id as mongoose.Types.ObjectId,
        lines: order.items.map((i) => ({
          productId: i.productId,
          name: i.name,
          quantity: i.quantity,
        })),
        idempotencyScope: `order:${String(order._id)}`,
      });
    } catch (err) {
      // Payment succeeded but stock could not be committed: flag for review.
      await Notification.create({
        storeId: order.storeId,
        type: 'low_inventory',
        severity: 'error',
        title: `Stock could not be reserved for ${order.orderNumber}`,
        body: `Payment captured but inventory update failed: ${(err as Error).message}. Review and adjust stock manually.`,
        link: `/inventory`,
      });
    }
  }

  await Notification.create({
    storeId: order.storeId,
    type: 'payment_succeeded',
    severity: 'success',
    title: `Payment received: ${order.currency} ${expected.toFixed(2)}`,
    body: `${order.orderNumber} · ${order.customerName}`,
    link: `/orders/${String(order._id)}`,
  });

  return { ok: true as const, alreadyProcessed: false, order: claimed, payment };
}
