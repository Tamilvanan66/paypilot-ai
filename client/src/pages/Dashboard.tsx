import { Link } from 'react-router-dom';
import {
  ArrowUpRight,
  BadgeDollarSign,
  BrainCircuit,
  Boxes,
  Clock,
  CreditCard,
  Package,
  PlusCircle,
  ShoppingCart,
  Sparkles,
  TrendingUp,
  Users,
} from 'lucide-react';
import { useRevenue, useOverview, useInsights } from '../hooks/queries';
import { useAuth } from '../context/AuthContext';
import { RevenueAreaChart } from '../components/charts';
import { Badge, Button, Card, EmptyState, ErrorState, PageHeader, StatCard, StatusBadge, TableSkeleton } from '../components/ui';
import { currency, relative } from '../utils/format';

export default function Dashboard() {
  const { user, store } = useAuth();
  const ov = useOverview();
  const rev = useRevenue(30);
  const insights = useInsights();
  const cur = store?.currency ?? 'USD';

  if (ov.isError) {
    return (
      <Card>
        <ErrorState message={(ov.error as Error)?.message ?? 'Could not load dashboard data.'} onRetry={() => void ov.refetch()} />
      </Card>
    );
  }

  const o = ov.data;

  return (
    <div className="space-y-6">
      <PageHeader
        title={`Welcome back${user?.name ? `, ${user.name.split(' ')[0]}` : ''}`}
        subtitle="Live metrics straight from your database — no placeholder numbers."
        actions={
          <>
            <Link to="/products" className="btn-secondary text-xs">
              <PlusCircle className="h-4 w-4" /> Add product
            </Link>
            <Link to="/assistant" className="btn-primary text-xs">
              <Sparkles className="h-4 w-4" /> Open AI assistant
            </Link>
          </>
        }
      />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Net revenue"
          value={currency(o?.revenue.net ?? 0, cur)}
          hint={`${currency(o?.revenue.last30Days ?? 0, cur)} in the last 30 days`}
          icon={<BadgeDollarSign className="h-4 w-4" />}
          loading={ov.isLoading}
        />
        <StatCard
          label="Total orders"
          value={o?.orders.total ?? 0}
          hint={`${o?.orders.pending ?? 0} pending · ${o?.orders.completed ?? 0} completed`}
          icon={<ShoppingCart className="h-4 w-4" />}
          tone="violet"
          loading={ov.isLoading}
        />
        <StatCard
          label="Awaiting payment"
          value={o?.orders.pendingPayments ?? 0}
          hint={`${currency(o?.orders.pendingPaymentValue ?? 0, cur)} unbilled`}
          icon={<Clock className="h-4 w-4" />}
          tone="amber"
          loading={ov.isLoading}
        />
        <StatCard
          label="Low stock"
          value={o?.products.lowStock ?? 0}
          hint={`${o?.products.outOfStock ?? 0} out of stock · ${o?.products.total ?? 0} products`}
          icon={<Boxes className="h-4 w-4" />}
          tone="rose"
          loading={ov.isLoading}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-ink">Revenue trend</h2>
              <p className="text-xs text-muted">Paid orders, last 30 days</p>
            </div>
            <Badge tone="green">
              <TrendingUp className="h-3 w-3" /> {currency(o?.revenue.last30Days ?? 0, cur)}
            </Badge>
          </div>
          {rev.isLoading ? <div className="h-[260px] animate-pulse rounded-xl bg-white/5" /> : <RevenueAreaChart data={rev.data ?? []} />}
        </Card>

        <Card className="flex flex-col">
          <div className="mb-3 flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-lg border border-accent2/30 bg-accent2/10 text-accent2">
              <BrainCircuit className="h-4 w-4" />
            </span>
            <div>
              <h2 className="text-sm font-semibold text-ink">AI insight</h2>
              <p className="text-[11px] text-muted">
                {insights.data?.source === 'ai' ? 'Model summary of live data' : 'Deterministic summary of live data'}
              </p>
            </div>
          </div>
          {insights.isLoading ? (
            <div className="space-y-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-4 animate-pulse rounded bg-white/5" />
              ))}
            </div>
          ) : insights.isError ? (
            <p className="text-xs text-muted">Insight generation unavailable right now.</p>
          ) : (
            <div className="space-y-3 text-sm">
              <p className="font-medium leading-snug text-ink">{insights.data?.headline}</p>
              <ul className="space-y-1.5">
                {(insights.data?.observations ?? []).slice(0, 4).map((line, i) => (
                  <li key={i} className="flex gap-2 text-xs leading-relaxed text-muted">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-accent" />
                    {line}
                  </li>
                ))}
              </ul>
              <Link to="/analytics" className="inline-flex items-center gap-1 text-xs font-semibold text-accent">
                Full analytics <ArrowUpRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          )}
        </Card>
      </div>

      <div className="grid gap-4 xl:grid-cols-3">
        <Card className="xl:col-span-2 p-0">
          <div className="flex items-center justify-between border-b border-line px-5 py-3.5">
            <h2 className="text-sm font-semibold text-ink">Recent orders</h2>
            <Link to="/orders" className="text-xs font-semibold text-accent">
              View all
            </Link>
          </div>
          {ov.isLoading ? (
            <TableSkeleton rows={4} cols={4} />
          ) : !o?.recentOrders?.length ? (
            <EmptyState
              title="No orders yet"
              description="Orders created through your storefront or API will appear here in real time."
              icon={<ShoppingCart className="h-5 w-5" />}
              action={
                <Link to="/orders" className="btn-secondary text-xs">
                  Open orders
                </Link>
              }
            />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px]">
                <thead className="border-b border-line">
                  <tr>
                    <th className="table-head">Order</th>
                    <th className="table-head">Customer</th>
                    <th className="table-head">Payment</th>
                    <th className="table-head">Status</th>
                    <th className="table-head text-right">Total</th>
                  </tr>
                </thead>
                <tbody>
                  {o.recentOrders.map((order) => (
                    <tr key={order._id} className="border-b border-line/50 last:border-0 hover:bg-white/[0.03]">
                      <td className="table-cell">
                        <Link to={`/orders/${order._id}`} className="font-medium text-accent hover:underline">
                          {order.orderNumber}
                        </Link>
                        <p className="text-[11px] text-muted">{relative(order.createdAt)}</p>
                      </td>
                      <td className="table-cell">
                        <p className="text-sm">{order.customerName}</p>
                        <p className="text-[11px] text-muted">{order.customerEmail}</p>
                      </td>
                      <td className="table-cell">
                        <StatusBadge status={order.paymentStatus} />
                      </td>
                      <td className="table-cell">
                        <StatusBadge status={order.status} />
                      </td>
                      <td className="table-cell text-right font-semibold">{currency(order.total, cur)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <div className="space-y-4">
          <Card>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-ink">Customer activity</h2>
              <Users className="h-4 w-4 text-muted" />
            </div>
            {!o?.activity?.length ? (
              <p className="py-4 text-center text-xs text-muted">No customer activity yet.</p>
            ) : (
              <ul className="space-y-2.5">
                {o.activity.slice(0, 5).map((c) => (
                  <li key={c.email} className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium text-ink">{c.name || c.email}</p>
                      <p className="truncate text-[11px] text-muted">{c.orders} order(s)</p>
                    </div>
                    <span className="shrink-0 text-xs font-semibold text-accent">{currency(c.spend, cur)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>

          <Card>
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-ink">Recent transactions</h2>
              <CreditCard className="h-4 w-4 text-muted" />
            </div>
            {!o?.recentTransactions?.length ? (
              <p className="py-4 text-center text-xs text-muted">No captured payments yet.</p>
            ) : (
              <ul className="space-y-2.5">
                {o.recentTransactions.slice(0, 5).map((t) => (
                  <li key={t._id} className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="truncate text-xs font-medium capitalize text-ink">{t.type}</p>
                      <p className="truncate text-[11px] text-muted">{relative(t.createdAt)}</p>
                    </div>
                    <span className="shrink-0 text-xs font-semibold text-ink">{currency(t.amount, cur)}</span>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>
      </div>

      <Card>
        <div className="mb-3 flex items-center gap-2">
          <Package className="h-4 w-4 text-accent" />
          <h2 className="text-sm font-semibold text-ink">Quick actions</h2>
        </div>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { to: '/products', label: 'Manage products', hint: 'Create, edit, archive' },
            { to: '/orders', label: 'Review orders', hint: 'Payments & fulfilment' },
            { to: '/inventory', label: 'Adjust inventory', hint: 'Movements & alerts' },
            { to: '/analytics', label: 'Business analytics', hint: 'Revenue & best sellers' },
          ].map((a) => (
            <Link
              key={a.to}
              to={a.to}
              className="rounded-xl border border-line bg-surface px-3.5 py-3 transition hover:border-accent/40 hover:bg-card"
            >
              <p className="text-xs font-semibold text-ink">{a.label}</p>
              <p className="mt-0.5 text-[11px] text-muted">{a.hint}</p>
            </Link>
          ))}
        </div>
      </Card>

      {o && (
        <p className="text-[11px] text-muted">
          Snapshot computed {relative(o.computedAt)} from your store database · Average order value{' '}
          {currency(o.orders.averageOrderValue, cur)}
        </p>
      )}
    </div>
  );
}
