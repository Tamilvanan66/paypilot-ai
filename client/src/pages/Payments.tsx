import { CreditCard, ShieldCheck, Webhook } from 'lucide-react';
import { usePayments, usePayPalConfig } from '../hooks/queries';
import {
  Badge,
  Card,
  EmptyState,
  ErrorState,
  PageHeader,
  Skeleton,
  StatusBadge,
  TableSkeleton,
} from '../components/ui';
import { currency, dateTime } from '../utils/format';
import { useAuth } from '../context/AuthContext';

export default function Payments() {
  const { store } = useAuth();
  const cur = store?.currency ?? 'USD';
  const { data, isLoading, isError, error, refetch } = usePayments();
  const config = usePayPalConfig();

  return (
    <div className="space-y-4">
      <PageHeader
        title="Payments"
        subtitle="Every capture is verified server-side against the order total before an order is marked paid."
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <Card>
          <div className="flex items-center gap-2 text-xs text-muted">
            <CreditCard className="h-4 w-4 text-accent" /> PayPal environment
          </div>
          {config.isLoading ? (
            <Skeleton className="mt-2 h-5 w-24" />
          ) : (
            <p className="mt-1.5 text-sm font-semibold capitalize text-ink">
              {config.data?.configured ? config.data.environment : 'Not configured'}
            </p>
          )}
        </Card>
        <Card>
          <div className="flex items-center gap-2 text-xs text-muted">
            <ShieldCheck className="h-4 w-4 text-accent" /> Client secret
          </div>
          <p className="mt-1.5 text-sm font-semibold text-ink">Never sent to the browser</p>
          <p className="mt-0.5 text-[11px] text-muted">Only the public client ID is exposed.</p>
        </Card>
        <Card>
          <div className="flex items-center gap-2 text-xs text-muted">
            <Webhook className="h-4 w-4 text-accent" /> Webhooks
          </div>
          <p className="mt-1.5 text-sm font-semibold text-ink">
            {config.data?.webhookConfigured ? 'Signature verification active' : 'Not configured'}
          </p>
          <p className="mt-0.5 text-[11px] text-muted">Verified via PayPal's verify-webhook-signature API.</p>
        </Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card className="p-0">
          <div className="border-b border-line px-5 py-3.5">
            <h2 className="text-sm font-semibold text-ink">Payment attempts</h2>
          </div>
          {isError ? (
            <ErrorState message={(error as Error)?.message ?? 'Could not load payments.'} onRetry={() => void refetch()} />
          ) : isLoading ? (
            <TableSkeleton rows={5} cols={3} />
          ) : !data?.items.length ? (
            <EmptyState
              title="No payment attempts yet"
              description="PayPal orders created from an order page are recorded here, including failures."
              icon={<CreditCard className="h-5 w-5" />}
            />
          ) : (
            <div className="divide-y divide-line/50">
              {data.items.map((p) => (
                <div key={p._id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-ink">{p.paypalOrderId}</p>
                    <p className="truncate text-[11px] text-muted">
                      {p.captureId ? `Capture ${p.captureId}` : 'Not captured'} · {dateTime(p.createdAt)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-xs font-semibold text-ink">{currency(p.amount, p.currency || cur)}</span>
                    <StatusBadge status={p.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>

        <Card className="p-0">
          <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
            <h2 className="text-sm font-semibold text-ink">Ledger transactions</h2>
            <Badge tone="violet">Immutable</Badge>
          </div>
          {!data?.transactions?.length ? (
            <EmptyState title="No transactions" description="Captured sales and refunds are written to the ledger." />
          ) : (
            <div className="divide-y divide-line/50">
              {data.transactions.map((t) => (
                <div key={t._id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium capitalize text-ink">{t.type}</p>
                    <p className="truncate text-[11px] text-muted">{t.providerTransactionId}</p>
                  </div>
                  <span className={`shrink-0 text-xs font-semibold ${t.type === 'refund' ? 'text-rose-300' : 'text-ink'}`}>
                    {t.type === 'refund' ? '−' : ''}
                    {currency(t.amount, t.currency || cur)}
                  </span>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      <Card>
        <h2 className="mb-2 text-sm font-semibold text-ink">How verification works</h2>
        <ol className="grid gap-2 text-xs leading-relaxed text-muted sm:grid-cols-2 lg:grid-cols-4">
          {[
            'Order total is priced from database product records — browser amounts are ignored.',
            'Capture is confirmed with PayPal, then the amount and currency are compared to the stored order.',
            'Payment, order status and inventory commit only after verification, guarded by idempotency keys.',
            'Webhooks must pass PayPal signature verification before they can change payment state.',
          ].map((step, i) => (
            <li key={i} className="rounded-xl border border-line bg-surface p-3">
              <span className="mb-1 block text-[11px] font-bold text-accent">STEP {i + 1}</span>
              {step}
            </li>
          ))}
        </ol>
      </Card>
    </div>
  );
}
