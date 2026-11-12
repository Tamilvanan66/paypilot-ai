import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Eye, Search, ShoppingCart } from 'lucide-react';
import { useOrders } from '../hooks/queries';
import {
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  PageHeader,
  Pagination,
  Select,
  StatusBadge,
  TableSkeleton,
} from '../components/ui';
import { currency, dateShort, relative } from '../utils/format';
import { useAuth } from '../context/AuthContext';

const STATUSES = ['pending', 'paid', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'];

export default function Orders() {
  const { store } = useAuth();
  const cur = store?.currency ?? 'USD';
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [term, setTerm] = useState('');
  const [status, setStatus] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const q = { page, limit: 12, search: term, status, from, to };
  const { data, isLoading, isError, error, refetch } = useOrders(status ? q : { ...q, status: undefined });

  return (
    <div>
      <PageHeader title="Orders" subtitle="Payment status and fulfilment status are tracked separately." />

      <Card className="mb-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
            setTerm(search.trim());
          }}
          className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-5"
        >
          <div className="relative lg:col-span-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <Input
              className="pl-9"
              placeholder="Search order number, customer…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search orders"
            />
          </div>
          <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} aria-label="Filter by status">
            <option value="">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s[0].toUpperCase() + s.slice(1)}
              </option>
            ))}
          </Select>
          <Input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} aria-label="From date" />
          <div className="flex gap-2">
            <Input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} aria-label="To date" />
            <Button type="submit" className="shrink-0 px-3">
              <Search className="h-4 w-4" />
            </Button>
          </div>
        </form>

        {data?.statusCounts && (
          <div className="mt-3 flex flex-wrap gap-1.5 border-t border-line pt-3">
            {STATUSES.map((s) => (
              <button
                key={s}
                onClick={() => { setStatus(s); setPage(1); }}
                className={`chip transition ${status === s ? 'border-accent/50 bg-accent/10 text-accent' : 'border-line bg-white/5 text-muted hover:text-ink'}`}
              >
                {s} <span className="font-bold">{data.statusCounts[s] ?? 0}</span>
              </button>
            ))}
          </div>
        )}
      </Card>

      <Card className="p-0">
        {isError ? (
          <ErrorState message={(error as Error)?.message ?? 'Could not load orders.'} onRetry={() => void refetch()} />
        ) : isLoading ? (
          <TableSkeleton rows={7} cols={5} />
        ) : !data?.items.length ? (
          <EmptyState
            title="No orders yet"
            description="Orders will appear here as soon as your storefront or API creates one."
            icon={<ShoppingCart className="h-5 w-5" />}
          />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px]">
              <thead className="border-b border-line">
                <tr>
                  <th className="table-head">Order</th>
                  <th className="table-head">Customer</th>
                  <th className="table-head">Items</th>
                  <th className="table-head">Payment</th>
                  <th className="table-head">Fulfilment</th>
                  <th className="table-head">Created</th>
                  <th className="table-head text-right">Total</th>
                  <th className="table-head" />
                </tr>
              </thead>
              <tbody>
                {data.items.map((order) => (
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
                    <td className="table-cell text-sm">{order.items.reduce((n, i) => n + i.quantity, 0)}</td>
                    <td className="table-cell"><StatusBadge status={order.paymentStatus} /></td>
                    <td className="table-cell">
                      <div className="flex flex-col gap-1">
                        <StatusBadge status={order.status} />
                        <span className="text-[10px] uppercase tracking-wide text-muted">{order.fulfilmentStatus}</span>
                      </div>
                    </td>
                    <td className="table-cell text-xs text-muted">{dateShort(order.createdAt)}</td>
                    <td className="table-cell text-right font-semibold">{currency(order.total, cur)}</td>
                    <td className="table-cell text-right">
                      <Link to={`/orders/${order._id}`} className="btn-ghost px-2 py-1" aria-label={`View ${order.orderNumber}`}>
                        <Eye className="h-4 w-4" />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {data && <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onPage={setPage} />}
      </Card>
    </div>
  );
}
