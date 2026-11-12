# PayPal Sandbox integration

## What the code does

| Step | Where |
| --- | --- |
| Server-side order creation priced from DB | `server/src/controllers/paymentController.ts` → `services/paypal.ts:createPayPalOrder` |
| Total recomputed, browser amount ignored | `create-order` handler (reads `Order.total`) |
| Browser approval via official JS SDK | `client/src/components/PayPalCheckout.tsx` |
| Server capture | `services/paypal.ts:capturePayPalOrder` |
| Amount + currency verification | `services/payments.ts:extractCapture` + `finalizePaidOrder` |
| Idempotency | `Payment.paypalOrderId` unique index, `Transaction.providerTransactionId` upsert, `Order.inventoryCommitted` flag, `InventoryMovement.idempotencyKey` unique |
| Webhook signature verification | `services/paypal.ts:verifyPayPalWebhookSignature` → `POST /v1/notifications/verify-webhook-signature` |
| Never expose the secret | `GET /api/payments/paypal/config` returns only `clientId`, `environment`, `currency`, `webhookConfigured` |

Failure modes handled explicitly:
- PayPal not configured → `502 paypal_not_configured` (the UI shows a setup panel instead of a button).
- Capture amount ≠ order total → `400 amount_mismatch`, order stays `unpaid`, `Payment.status = failed`,
  error notification written, no stock deducted.
- Currency mismatch → same rejection path.
- Replayed capture → `alreadyProcessed: true`, no second charge, no second deduction.
- Unsigned or spoofed webhook → `400 invalid_signature`, nothing changes.
- Insufficient stock at capture time → payment still recorded, order flagged, error notification
  (`inventory could not be reserved`), stock never goes negative.

## Setup

1. **Create a Sandbox app**
   <https://developer.paypal.com/dashboard/applications/sandbox> → *Create App* → copy the
   **Client ID** and **Secret**.

2. **Fill `server/.env`**
   ```env
   PAYPAL_ENV=sandbox
   PAYPAL_CLIENT_ID=AX...
   PAYPAL_CLIENT_SECRET=EL...
   PAYPAL_CURRENCY=USD
   PUBLIC_API_URL=https://your-public-api-host
   ```

3. **Create a webhook**
   Dashboard → your app → *Webhooks* → add
   `https://<PUBLIC_API_URL>/api/payments/paypal/webhook`
   Events: `PAYMENT.CAPTURE.COMPLETED`, `PAYMENT.CAPTURE.DENIED`, `PAYMENT.CAPTURE.REFUNDED`,
   `CHECKOUT.ORDER.APPROVED`.
   Copy the **Webhook ID** into `PAYPAL_WEBHOOK_ID`. Without it every webhook is rejected —
   that is deliberate.

4. **Expose your machine** for local webhook testing:
   ```bash
   ngrok http 5000
   # then set PUBLIC_API_URL=https://<ngrok-id>.ngrok-free.app
   ```

5. **Test a payment**
   - Create an order (API or seed data), open `/orders/:id`.
   - The PayPal buttons appear only when `configured: true`.
   - Approve with a Sandbox **personal** account (Accounts → Sandbox → Personal → credentials).
   - Confirm the order flips to `paid`, stock decrements once, a `Transaction` row appears in
     `/payments`.

## Troubleshooting

| Symptom | Cause |
| --- | --- |
| "PayPal Sandbox is not configured" panel | `PAYPAL_CLIENT_ID`/`SECRET` missing, or API not restarted |
| `paypal_not_configured` 502 from the API | Same as above (server side) |
| Buttons never render | Client ID invalid, or the SDK script blocked by the network/adblocker |
| Webhook returns `400 invalid_signature` | `PAYPAL_WEBHOOK_ID` missing or belongs to another app |
| `amount_mismatch` | The order total changed after the PayPal order was created — re-create it |
| Duplicate capture warning | Expected: replay is idempotent and reports `alreadyProcessed` |

## Going live

Set `PAYPAL_ENV=live`, swap in live credentials, register a live webhook, and ensure the host uses
HTTPS. Nothing else in the code path changes.
