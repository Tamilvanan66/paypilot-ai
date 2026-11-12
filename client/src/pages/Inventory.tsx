import { useState } from 'react';
import { ArrowDownUp, Boxes, PackageX, Search } from 'lucide-react';
import { useAdjustStock, useInventory, useMovements } from '../hooks/queries';
import {
  Badge,
  Button,
  Card,
  EmptyState,
  ErrorState,
  Input,
  Modal,
  PageHeader,
  Pagination,
  Select,
  TableSkeleton,
} from '../components/ui';
import { useToast } from '../components/ui/Toast';
import { ApiClientError } from '../services/api';
import { currency, dateTime, titleCase } from '../utils/format';
import { useAuth } from '../context/AuthContext';
import type { Product } from '../types';

export default function Inventory() {
  const { store } = useAuth();
  const cur = store?.currency ?? 'USD';
  const toast = useToast();
  const [filter, setFilter] = useState('');
  const [search, setSearch] = useState('');
  const [term, setTerm] = useState('');
  const [page, setPage] = useState(1);
  const [target, setTarget] = useState<Product | null>(null);
  const [newStock, setNewStock] = useState('');
  const [reason, setReason] = useState('');
  const adjust = useAdjustStock();

  const { data, isLoading, isError, error, refetch } = useInventory({ page, limit: 10, filter, search: term });
  const movements = useMovements({ limit: 12 });

  const submit = async () => {
    if (!target) return;
    const value = Number(newStock);
    if (!Number.isInteger(value) || value < 0) return toast.error('Stock must be a whole number ≥ 0.');
    if (reason.trim().length < 3) return toast.error('Add a reason (at least 3 characters).');
    try {
      await adjust.mutateAsync({ id: target._id, newStock: value, reason: reason.trim() });
      toast.success(`Stock for ${target.name} set to ${value}.`);
      setTarget(null);
      setReason('');
      setNewStock('');
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : 'Adjustment failed.');
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Inventory" subtitle="Every stock change writes an auditable movement record." />

      <div className="grid gap-3 sm:grid-cols-4">
        {[
          { label: 'Units on hand', value: data?.summary.units ?? 0 },
          { label: 'Inventory value', value: currency(data?.summary.value ?? 0, cur) },
          { label: 'Low stock', value: data?.summary.low ?? 0 },
          { label: 'Out of stock', value: data?.summary.out ?? 0 },
        ].map((s) => (
          <Card key={s.label}>
            <p className="text-xs text-muted">{s.label}</p>
            <p className="mt-1 text-xl font-bold text-ink">{s.value}</p>
          </Card>
        ))}
      </div>

      <Card className="p-0">
        <div className="flex flex-wrap items-center gap-2 border-b border-line p-3.5">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              setPage(1);
              setTerm(search.trim());
            }}
            className="flex flex-1 gap-2"
          >
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <Input className="pl-9" placeholder="Search products…" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search inventory" />
            </div>
            <Select value={filter} onChange={(e) => { setFilter(e.target.value); setPage(1); }} className="w-auto" aria-label="Stock filter">
              <option value="">All stock</option>
              <option value="low">Low stock</option>
              <option value="out">Out of stock</option>
            </Select>
            <Button type="submit" className="px-3">
              <Search className="h-4 w-4" />
            </Button>
          </form>
        </div>

        {isError ? (
          <ErrorState message={(error as Error)?.message ?? 'Could not load inventory.'} onRetry={() => void refetch()} />
        ) : isLoading ? (
          <TableSkeleton rows={6} cols={4} />
        ) : !data?.items.length ? (
          <EmptyState title="No products in this view" description="Adjust the filters or add products first." icon={<Boxes className="h-5 w-5" />} />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[620px]">
              <thead className="border-b border-line">
                <tr>
                  <th className="table-head">Product</th>
                  <th className="table-head text-right">Stock</th>
                  <th className="table-head text-right">Threshold</th>
                  <th className="table-head">Status</th>
                  <th className="table-head text-right">Action</th>
                </tr>
              </thead>
              <tbody>
                {data.items.map((p) => {
                  const threshold = p.lowStockThreshold ?? 5;
                  return (
                    <tr key={p._id} className="border-b border-line/50 last:border-0">
                      <td className="table-cell">
                        <p className="font-medium">{p.name}</p>
                        <p className="text-[11px] text-muted">SKU {p.sku}</p>
                      </td>
                      <td className="table-cell text-right font-semibold">{p.stock}</td>
                      <td className="table-cell text-right text-muted">{threshold}</td>
                      <td className="table-cell">
                        <Badge tone={p.stock <= 0 ? 'red' : p.stock <= threshold ? 'amber' : 'green'}>
                          {p.stock <= 0 ? 'Out of stock' : p.stock <= threshold ? 'Low stock' : 'In stock'}
                        </Badge>
                      </td>
                      <td className="table-cell text-right">
                        <Button
                          variant="secondary"
                          className="px-2.5 py-1.5 text-xs"
                          onClick={() => {
                            setTarget(p);
                            setNewStock(String(p.stock));
                          }}
                        >
                          <ArrowDownUp className="h-3.5 w-3.5" /> Adjust
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {data && <Pagination page={data.page} totalPages={data.totalPages} total={data.total} onPage={setPage} />}
      </Card>

      <Card className="p-0">
        <div className="border-b border-line px-5 py-3.5">
          <h2 className="text-sm font-semibold text-ink">Recent movements</h2>
          <p className="text-[11px] text-muted">Initial stock, sales, restores and manual adjustments</p>
        </div>
        {movements.isLoading ? (
          <TableSkeleton rows={5} cols={3} />
        ) : !movements.data?.items.length ? (
          <EmptyState title="No movements yet" description="Stock changes will be recorded here." icon={<PackageX className="h-5 w-5" />} />
        ) : (
          <div className="divide-y divide-line/50">
            {movements.data.items.map((m) => {
              const product = typeof m.productId === 'object' ? m.productId : null;
              return (
                <div key={m._id} className="flex items-center justify-between gap-3 px-5 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-ink">{product?.name ?? 'Product'}</p>
                    <p className="truncate text-[11px] text-muted">
                      {titleCase(m.type)} · {m.reason} · {dateTime(m.createdAt)}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2 text-xs">
                    <span className={m.quantityChange >= 0 ? 'font-semibold text-accent' : 'font-semibold text-rose-300'}>
                      {m.quantityChange >= 0 ? '+' : ''}
                      {m.quantityChange}
                    </span>
                    <span className="text-muted">{m.previousStock} → {m.newStock}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      <Modal
        open={Boolean(target)}
        onClose={() => setTarget(null)}
        title={`Adjust stock — ${target?.name ?? ''}`}
        description="The delta and an audit record are written automatically."
        footer={
          <>
            <Button variant="ghost" onClick={() => setTarget(null)}>
              Cancel
            </Button>
            <Button loading={adjust.isPending} onClick={() => void submit()}>
              Save adjustment
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="rounded-xl border border-line bg-surface p-3 text-xs text-muted">
            Current stock: <span className="font-semibold text-ink">{target?.stock ?? 0}</span>
          </div>
          <div>
            <label className="label" htmlFor="new-stock">New stock quantity</label>
            <Input id="new-stock" type="number" min="0" step="1" value={newStock} onChange={(e) => setNewStock(e.target.value)} />
          </div>
          <div>
            <label className="label" htmlFor="reason">Reason</label>
            <Input id="reason" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Stocktake correction, damaged goods…" maxLength={300} />
          </div>
        </div>
      </Modal>
    </div>
  );
}
