import { useState } from 'react';
import { ArrowDownRight, ArrowUpRight, BrainCircuit, Package, ShoppingCart, TrendingUp, Users } from 'lucide-react';
import { useInsights, useOrderStats, useOverview, useProductStats, useRevenue } from '../hooks/queries';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  PageHeader,
  Select,
  Skeleton,
  StatCard,
  StatusBadge,
  TableSkeleton,
} from '../components/ui';
import { CategoryBarChart, OrdersBarChart, RevenueAreaChart, StatusPieChart } from '../components/charts';
import { currency, titleCase } from '../utils/format';
import { useAuth } from '../context/AuthContext';

export default function Analytics() {
  const { store } = useAuth();
  const cur = store?.currency ?? 'USD';
  const [days, setDays] = useState(30);
  const ov = useOverview();
  const rev = useRevenue(days);
  const stats = useProductStats();
  const orders = useOrderStats();
  const insights = useInsights();

  const o = ov.data;

  return (
    <div className="space-y-4">
      <PageHeader
        title="Analytics"
        subtitle="Historical figures from your database. Predictions are never presented as facts."
        actions={
          <Select value={days} onChange={(e) => setDays(Number(e.target.value))} className="w-auto" aria-label="Range">
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
            <option value={365}>Last 12 months</option>
          </Select>
        }
      />

      {ov.isError ? (
        <Card>
          <ErrorState message={(ov.error as Error)?.message ?? 'Could not load analytics.'} onRetry={() => void ov.refetch()} />
        </Card>
      ) : (
        <>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard label="Gross revenue" value={currency(o?.revenue.gross ?? 0, cur)} hint={`Net ${currency(o?.revenue.net ?? 0, cur)} after refunds`} icon={<TrendingUp className="h-4 w-4" />} loading={ov.isLoading} />
            <StatCard label="Average order value" value={currency(o?.orders.averageOrderValue ?? 0, cur)} hint={`${o?.orders.total ?? 0} orders total`} icon={<ShoppingCart className="h-4 w-4" />} tone="violet" loading={ov.isLoading} />
            <StatCard label="Customers" value={o?.customers.total ?? 0} hint="Unique buyers with orders" icon={<Users className="h-4 w-4" />} tone="sky" loading={ov.isLoading} />
            <StatCard label="Inventory value" value={currency(o?.products.inventoryValue ?? 0, cur)} hint={`${o?.products.inventoryUnits ?? 0} units on hand`} icon={<Package className="h-4 w-4" />} tone="amber" loading={ov.isLoading} />
          </div>

          <Card>
            <div className="mb-3 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold text-ink">Revenue & orders</h2>
                <p className="text-[11px] text-muted">Last {days} days · paid orders only</p>
              </div>
              <Badge tone="violet">
                <ArrowUpRight className="h-3 w-3" /> {currency(rev.data?.reduce((n, p) => n + p.revenue, 0) ?? 0, cur)}
              </Badge>
            </div>
            {rev.isLoading ? <div className="h-[260px] animate-pulse rounded-xl bg-white/5" /> : <RevenueAreaChart data={rev.data ?? []} />}
            {!rev.isLoading && (rev.data ?? []).every((p) => p.revenue === 0) && (
              <p className="mt-2 text-center text-[11px] text-muted">
                No paid orders in this range yet — the chart reflects real zeros, not sample data.
              </p>
            )}
          </Card>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card>
              <h2 className="mb-2 text-sm font-semibold text-ink">Orders per day</h2>
              {rev.isLoading ? <Skeleton className="h-[240px] w-full" /> : <OrdersBarChart data={rev.data ?? []} />}
            </Card>
            <Card>
              <h2 className="mb-2 text-sm font-semibold text-ink">Order status mix</h2>
              {orders.isLoading ? (
                <Skeleton className="h-[240px] w-full" />
              ) : !orders.data?.statuses.length ? (
                <EmptyState title="No orders yet" description="Status distribution appears once orders exist." />
              ) : (
                <StatusPieChart
                  data={orders.data.statuses.map((s) => ({ name: titleCase(s.status), value: s.count }))}
                />
              )}
            </Card>
            <Card>
              <h2 className="mb-2 text-sm font-semibold text-ink">Sales by category</h2>
              {stats.isLoading ? (
                <Skeleton className="h-[260px] w-full" />
              ) : !stats.data?.categories.length ? (
                <EmptyState title="No category sales" description="Paid orders will populate this chart." />
              ) : (
                <CategoryBarChart data={stats.data.categories.slice(0, 6)} />
              )}
            </Card>
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            <Card className="p-0 lg:col-span-2">
              <div className="border-b border-line px-5 py-3.5">
                <h2 className="text-sm font-semibold text-ink">Best-selling products</h2>
              </div>
              {stats.isLoading ? (
                <TableSkeleton rows={5} cols={3} />
              ) : !stats.data?.performance.length ? (
                <EmptyState title="No product performance yet" description="Revenue by product appears after paid orders." />
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[480px]">
                    <thead className="border-b border-line">
                      <tr>
                        <th className="table-head">Product</th>
                        <th className="table-head text-right">Units</th>
                        <th className="table-head text-right">Revenue</th>
                        <th className="table-head text-right">Stock</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stats.data.performance.map((p) => (
                        <tr key={p.productId} className="border-b border-line/50 last:border-0">
                          <td className="table-cell">{p.name}</td>
                          <td className="table-cell text-right">{p.unitsSold}</td>
                          <td className="table-cell text-right font-semibold">{currency(p.revenue, cur)}</td>
                          <td className="table-cell text-right">
                            <span className={p.stock <= 0 ? 'text-rose-300' : p.stock <= 5 ? 'text-amber-300' : 'text-muted'}>
                              {p.stock}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>

            <Card>
              <div className="mb-2 flex items-center gap-2">
                <span className="grid h-7 w-7 place-items-center rounded-lg border border-accent2/30 bg-accent2/10 text-accent2">
                  <BrainCircuit className="h-4 w-4" />
                </span>
                <div>
                  <h2 className="text-sm font-semibold text-ink">AI insights</h2>
                  <p className="text-[11px] text-muted">
                    {insights.data?.source === 'ai' ? 'Model summary' : 'Deterministic summary'}
                  </p>
                </div>
              </div>
              {insights.isLoading ? (
                <div className="space-y-2">
                  <Skeleton className="h-4 w-full" />
                  <Skeleton className="h-4 w-4/5" />
                  <Skeleton className="h-4 w-3/4" />
                </div>
              ) : insights.isError ? (
                <ErrorState message="Insights unavailable." onRetry={() => void insights.refetch()} />
              ) : (
                <div className="space-y-3">
                  <p className="text-sm font-medium leading-snug text-ink">{insights.data?.headline}</p>
                  <div>
                    <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted">Observations</p>
                    <ul className="space-y-1.5">
                      {(insights.data?.observations ?? []).map((line, i) => (
                        <li key={i} className="flex gap-2 text-[11px] leading-relaxed text-muted">
                          <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-accent" />
                          {line}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <p className="mb-1 text-[10px] font-bold uppercase tracking-wider text-muted">Suggested actions</p>
                    <ul className="space-y-1.5">
                      {(insights.data?.actions ?? []).map((line, i) => (
                        <li key={i} className="flex gap-2 text-[11px] leading-relaxed text-muted">
                          <ArrowDownRight className="mt-0.5 h-3 w-3 shrink-0 text-accent2" />
                          {line}
                        </li>
                      ))}
                    </ul>
                  </div>
                  <Button variant="secondary" className="w-full text-xs" onClick={() => void insights.refetch()} loading={insights.isFetching}>
                    Regenerate
                  </Button>
                </div>
              )}
            </Card>
          </div>

          <Card>
            <h2 className="mb-2 text-sm font-semibold text-ink">Pending payments</h2>
            {ov.isLoading ? (
              <Skeleton className="h-10 w-full" />
            ) : (
              <div className="flex flex-wrap items-center gap-4 text-sm">
                <div>
                  <p className="text-xs text-muted">Orders awaiting payment</p>
                  <p className="text-lg font-bold text-ink">{o?.orders.pendingPayments ?? 0}</p>
                </div>
                <div>
                  <p className="text-xs text-muted">Uncollected value</p>
                  <p className="text-lg font-bold text-amber-300">{currency(o?.orders.pendingPaymentValue ?? 0, cur)}</p>
                </div>
                <div>
                  <p className="text-xs text-muted">Refunded</p>
                  <p className="text-lg font-bold text-rose-300">{currency(o?.revenue.refunds ?? 0, cur)}</p>
                </div>
              </div>
            )}
            {orders.data?.statuses && (
              <div className="mt-3 flex flex-wrap gap-1.5 border-t border-line pt-3">
                {orders.data.statuses.map((s) => (
                  <span key={s.status} className="chip border-line bg-white/5 text-[11px] text-muted">
                    {titleCase(s.status)} <span className="font-bold text-ink">{s.count}</span>
                  </span>
                ))}
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}
