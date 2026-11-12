import { useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CheckCircle2, CreditCard, Package, Truck, XCircle } from 'lucide-react';
import { useOrder, useSetOrderStatus } from '../hooks/queries';
import { Badge, Button, Card, ErrorState, Select, Spinner, StatusBadge } from '../components/ui';
import { useToast } from '../components/ui/Toast';
import { ApiClientError } from '../services/api';
import { currency, dateTime } from '../utils/format';
import { useAuth } from '../context/AuthContext';
import PayPalCheckout from '../components/PayPalCheckout';

const TRANSITIONS: Record<string, string[]> = {
  pending: ['paid', 'cancelled'],
  paid: ['processing', 'refunded'],
  processing: ['shipped', 'cancelled'],
  shipped: ['delivered'],
  delivered: ['refunded'],
  cancelled: [],
  refunded: [],
};

export default function OrderDetail() {
  const { id } = useParams<{ id: string }>();
  const { data, isLoading, isError, error, refetch } = useOrder(id ?? null);
  const setStatus = useSetOrderStatus();
  const toast = useToast();
  const { store } = useAuth();
  const cur = store?.currency ?? 'USD';
  const [next, setNext] = useState('');
  const [note, setNote] = useState('');

  if (isLoading) return <Card><Spinner label="Loading order…" /></Card>;
  if (isError || !data) {
    return (
      <Card>
        <ErrorState message={(error as Error)?.message ?? 'Order not found.'} onRetry={() => void refetch()} />
      </Card>
    );
  }

  const { order, customer } = data;
  const options = TRANSITIONS[order.status] ?? [];
  const canPay = order.paymentStatus !== 'paid' && order.paymentStatus !== 'refunded' && order.status !== 'cancelled';

  const apply = async (target: string) => {
    if (!target) return;
    if (target === 'cancelled' && !window.confirm('Cancel this order? Stock is restored for paid orders.')) return;
    try {
      await setStatus.mutateAsync({ id: order._id, status: target, note: note.trim() || undefined });
      toast.success(`Order moved to ${target}.`);
      setNext('');
      setNote('');
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : 'Status update failed.');
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link to="/orders" className="btn-ghost px-2 py-1.5" aria-label="Back to orders">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-lg font-bold text-ink">{order.orderNumber}</h1>
            <p className="text-xs text-muted">Created {dateTime(order.createdAt)}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex items-center gap-1.5 text-[11px] text-muted">
            <CreditCard className="h-3.5 w-3.5" /> Payment
          </div>
          <StatusBadge status={order.paymentStatus} />
          <div className="ml-2 flex items-center gap-1.5 text-[11px] text-muted">
            <Truck className="h-3.5 w-3.5" /> Fulfilment
          </div>
          <StatusBadge status={order.status} />
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card className="p-0">
            <div className="border-b border-line px-5 py-3.5">
              <h2 className="text-sm font-semibold text-ink">Items</h2>
            </div>
            <div className="divide-y divide-line/50">
              {order.items.map((item) => (
                <div key={`${item.productId}-${item.sku}`} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-ink">{item.name}</p>
                    <p className="text-[11px] text-muted">
                      SKU {item.sku} · {item.quantity} × {currency(item.price, cur)}
                    </p>
                  </div>
                  <p className="shrink-0 text-sm font-semibold text-ink">{currency(item.lineTotal, cur)}</p>
                </div>
              ))}
            </div>
            <div className="space-y-1.5 border-t border-line px-5 py-4 text-sm">
              <div className="flex justify-between text-muted">
                <span>Subtotal</span>
                <span>{currency(order.subtotal, cur)}</span>
              </div>
              <div className="flex justify-between text-muted">
                <span>Tax</span>
                <span>{currency(order.tax, cur)}</span>
              </div>
              <div className="flex justify-between text-muted">
                <span>Shipping</span>
                <span>{order.shipping === 0 ? 'Free' : currency(order.shipping, cur)}</span>
              </div>
              <div className="flex justify-between border-t border-line pt-2 text-base font-bold text-ink">
                <span>Total</span>
                <span>{currency(order.total, cur)}</span>
              </div>
            </div>
          </Card>

          <Card>
            <h2 className="mb-2 text-sm font-semibold text-ink">Customer</h2>
            <div className="grid gap-1 text-sm text-ink sm:grid-cols-2">
              <p className="font-medium">{order.customerName}</p>
              <p className="text-muted">{order.customerEmail}</p>
              {customer?.phone && <p className="text-muted">{customer.phone}</p>}
              {customer?.address?.line1 && (
                <p className="text-muted">
                  {[customer.address.line1, customer.address.city, customer.address.country].filter(Boolean).join(', ')}
                </p>
              )}
            </div>
            {order.notes && <p className="mt-3 rounded-xl border border-line bg-surface p-3 text-xs text-muted">{order.notes}</p>}
          </Card>
        </div>

        <div className="space-y-4">
          {canPay && (
            <Card>
              <h2 className="mb-3 text-sm font-semibold text-ink">Collect payment</h2>
              <PayPalCheckout orderId={order._id} orderNumber={order.orderNumber} onPaid={() => void refetch()} />
            </Card>
          )}

          {order.paymentStatus === 'paid' && (
            <Card>
              <div className="flex items-start gap-2.5">
                <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
                <div>
                  <p className="text-sm font-semibold text-ink">Payment verified</p>
                  <p className="mt-0.5 text-xs text-muted">
                    Captured {order.paidAt ? dateTime(order.paidAt) : ''} · amount matched against the stored order total.
                  </p>
                </div>
              </div>
            </Card>
          )}

          <Card>
            <h2 className="mb-3 text-sm font-semibold text-ink">Fulfilment</h2>
            {options.length === 0 ? (
              <p className="flex items-center gap-2 text-xs text-muted">
                <Package className="h-4 w-4" /> This order is in a terminal state.
              </p>
            ) : (
              <div className="space-y-2.5">
                <Select value={next} onChange={(e) => setNext(e.target.value)} aria-label="Next status">
                  <option value="">Select next status…</option>
                  {options.map((s) => (
                    <option key={s} value={s}>
                      {s[0].toUpperCase() + s.slice(1)}
                    </option>
                  ))}
                </Select>
                <textarea
                  className="field min-h-[64px]"
                  placeholder="Optional note for the order history"
                  value={note}
                  maxLength={500}
                  onChange={(e) => setNote(e.target.value)}
                />
                <Button className="w-full" disabled={!next} loading={setStatus.isPending} onClick={() => void apply(next)}>
                  Update status
                </Button>
                {options.includes('cancelled') && (
                  <Button
                    variant="ghost"
                    className="w-full text-xs text-rose-300"
                    onClick={() => void apply('cancelled')}
                    loading={setStatus.isPending}
                  >
                    <XCircle className="h-3.5 w-3.5" /> Cancel order
                  </Button>
                )}
              </div>
            )}
            <p className="mt-3 flex items-center gap-1.5 text-[11px] text-muted">
              <Badge tone="slate">Rule</Badge>
              Orders must be paid before processing, shipping or delivery.
            </p>
          </Card>
        </div>
      </div>
    </div>
  );
}
