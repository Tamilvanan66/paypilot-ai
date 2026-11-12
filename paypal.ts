import { env, paypalConfigured } from '../config/env.js';
import { ApiError } from '../utils/errors.js';

interface TokenCache {
  token: string;
  expiresAt: number;
}
let cache: TokenCache | null = null;

export const paypalBase = () =>
  env.paypal.envName === 'live'
    ? 'https://api-m.paypal.com'
    : 'https://api-m.sandbox.paypal.com';

export { paypalConfigured };

export async function getAccessToken(): Promise<string> {
  if (!paypalConfigured()) {
    throw ApiError.upstream(
      'PayPal is not configured. Set PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET.',
      { code: 'paypal_not_configured' },
    );
  }
  if (cache && cache.expiresAt > Date.now() + 30_000) return cache.token;

  const basic = Buffer.from(
    `${env.paypal.clientId}:${env.paypal.clientSecret}`,
  ).toString('base64');

  const res = await fetch(`${paypalBase()}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${basic}`,
      'Content-Type': 'application/x-www-form-urlencoded',
      Accept: 'application/json',
    },
    body: 'grant_type=client_credentials',
  });

  if (!res.ok) {
    const text = await res.text();
    throw ApiError.upstream(`PayPal auth failed (${res.status})`, text.slice(0, 400));
  }
  const data = (await res.json()) as { access_token: string; expires_in: number };
  cache = { token: data.access_token, expiresAt: Date.now() + data.expires_in * 1000 };
  return cache.token;
}

export interface PayPalOrderResponse {
  id: string;
  status: string;
  links?: { href: string; rel: string; method?: string }[];
  [k: string]: unknown;
}

export async function createPayPalOrder(input: {
  amount: number;
  currency: string;
  referenceId: string;
  description?: string;
}): Promise<PayPalOrderResponse> {
  const token = await getAccessToken();
  const res = await fetch(`${paypalBase()}/v2/checkout/orders`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'PayPal-Request-Id': `create-${input.referenceId}`,
    },
    body: JSON.stringify({
      intent: 'CAPTURE',
      purchase_units: [
        {
          reference_id: input.referenceId,
          description: (input.description ?? 'PayPilot AI order').slice(0, 127),
          amount: {
            currency_code: input.currency,
            value: input.amount.toFixed(2),
          },
        },
      ],
      application_context: {
        brand_name: 'PayPilot AI',
        shipping_preference: 'NO_SHIPPING',
        user_action: 'PAY_NOW',
      },
    }),
  });

  const data = (await res.json()) as PayPalOrderResponse & { message?: string };
  if (!res.ok) {
    throw ApiError.upstream(`PayPal create-order failed (${res.status})`, data);
  }
  return data;
}

export async function capturePayPalOrder(paypalOrderId: string): Promise<Record<string, unknown>> {
  const token = await getAccessToken();
  const res = await fetch(`${paypalBase()}/v2/checkout/orders/${paypalOrderId}/capture`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      'PayPal-Request-Id': `capture-${paypalOrderId}`,
    },
  });
  const data = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    throw ApiError.upstream(`PayPal capture failed (${res.status})`, data);
  }
  return data;
}

export async function getPayPalOrder(paypalOrderId: string): Promise<Record<string, unknown>> {
  const token = await getAccessToken();
  const res = await fetch(`${paypalBase()}/v2/checkout/orders/${paypalOrderId}`, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  });
  const data = (await res.json()) as Record<string, unknown>;
  if (!res.ok) throw ApiError.upstream(`PayPal get-order failed (${res.status})`, data);
  return data;
}

/**
 * Server-side webhook signature verification using PayPal's
 * /v1/notifications/verify-webhook-signature endpoint.
 */
export async function verifyPayPalWebhookSignature(input: {
  transmissionId?: string;
  transmissionTime?: string;
  certUrl?: string;
  authAlgo?: string;
  transmissionSig?: string;
  webhookEvent: unknown;
}): Promise<{ verified: boolean; reason?: string }> {
  if (!env.paypal.webhookId) {
    return { verified: false, reason: 'PAYPAL_WEBHOOK_ID is not configured' };
  }
  const {
    transmissionId,
    transmissionTime,
    certUrl,
    authAlgo,
    transmissionSig,
    webhookEvent,
  } = input;

  if (!transmissionId || !transmissionTime || !certUrl || !authAlgo || !transmissionSig) {
    return { verified: false, reason: 'Missing PayPal transmission headers' };
  }

  const token = await getAccessToken();
  const res = await fetch(`${paypalBase()}/v1/notifications/verify-webhook-signature`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      transmission_id: transmissionId,
      transmission_time: transmissionTime,
      cert_url: certUrl,
      auth_algo: authAlgo,
      transmission_sig: transmissionSig,
      webhook_id: env.paypal.webhookId,
      webhook_event: webhookEvent,
    }),
  });

  const data = (await res.json().catch(() => ({}))) as {
    verification_status?: string;
    [k: string]: unknown;
  };
  if (!res.ok) {
    return { verified: false, reason: `verify-webhook-signature failed (${res.status})` };
  }
  return {
    verified: data.verification_status === 'SUCCESS',
    reason: data.verification_status,
  };
}
