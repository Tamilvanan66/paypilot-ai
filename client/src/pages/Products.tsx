import { useState } from 'react';
import {
  Archive,
  ImageIcon,
  Package,
  Pencil,
  Plus,
  Search,
  Trash2,
} from 'lucide-react';
import { useCategories, useDeleteProduct, useProducts } from '../hooks/queries';
import ProductFormModal from '../components/ProductFormModal';
import {
  Badge,
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
import { useToast } from '../components/ui/Toast';
import { ApiClientError } from '../services/api';
import { currency, stockLabel } from '../utils/format';
import { useAuth } from '../context/AuthContext';
import type { Product } from '../types';

export default function Products() {
  const { store, user } = useAuth();
  const cur = store?.currency ?? 'USD';
  const toast = useToast();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [term, setTerm] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [status, setStatus] = useState('active');
  const [stock, setStock] = useState('');
  const [sort, setSort] = useState('newest');
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Product | null>(null);

  const query = { page, limit: 9, search: term, categoryId, status, stock, sort };
  const { data, isLoading, isError, error, refetch, isFetching } = useProducts(query);
  const { data: categories } = useCategories();
  const del = useDeleteProduct();

  const onDelete = async (product: Product) => {
    if (!window.confirm(`Delete "${product.name}"? Products with order history are archived instead.`)) return;
    try {
      const res = await del.mutateAsync(product._id);
      toast.success(res.archived ? 'Product archived (it has order history).' : 'Product deleted.');
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : 'Delete failed.');
    }
  };

  const archive = async (product: Product) => {
    try {
      await del.mutateAsync(product._id);
      toast.success('Product archived.');
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : 'Archive failed.');
    }
  };

  return (
    <div>
      <PageHeader
        title="Products"
        subtitle="Catalogue, pricing and stock status for your store."
        actions={
          <Button
            onClick={() => {
              setEditing(null);
              setModalOpen(true);
            }}
          >
            <Plus className="h-4 w-4" /> New product
          </Button>
        }
      />

      <Card className="mb-4">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            setPage(1);
            setTerm(search.trim());
          }}
          className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-6"
        >
          <div className="relative lg:col-span-2">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
            <Input
              className="pl-9"
              placeholder="Search name, SKU, description…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              aria-label="Search products"
            />
          </div>
          <Select value={categoryId} onChange={(e) => { setCategoryId(e.target.value); setPage(1); }} aria-label="Filter by category">
            <option value="">All categories</option>
            {(categories ?? []).map((c) => (
              <option key={c._id} value={c._id}>
                {c.name}
              </option>
            ))}
          </Select>
          <Select value={status} onChange={(e) => { setStatus(e.target.value); setPage(1); }} aria-label="Filter by status">
            <option value="active">Active</option>
            <option value="archived">Archived</option>
            <option value="all">All statuses</option>
          </Select>
          <Select value={stock} onChange={(e) => { setStock(e.target.value); setPage(1); }} aria-label="Filter by stock">
            <option value="">Any stock level</option>
            <option value="in">In stock</option>
            <option value="low">Low stock</option>
            <option value="out">Out of stock</option>
          </Select>
          <div className="flex gap-2">
            <Select value={sort} onChange={(e) => setSort(e.target.value)} aria-label="Sort products">
              <option value="newest">Newest</option>
              <option value="oldest">Oldest</option>
              <option value="price_desc">Price ↓</option>
              <option value="price_asc">Price ↑</option>
              <option value="name">Name A–Z</option>
            </Select>
            <Button type="submit" loading={isFetching} className="shrink-0 px-3">
              <Search className="h-4 w-4" />
            </Button>
          </div>
        </form>
      </Card>

      {isError ? (
        <Card>
          <ErrorState message={(error as Error)?.message ?? 'Could not load products.'} onRetry={() => void refetch()} />
        </Card>
      ) : isLoading ? (
        <Card className="p-0">
          <TableSkeleton rows={6} cols={4} />
        </Card>
      ) : !data?.items.length ? (
        <Card>
          <EmptyState
            title="No products found"
            description="Create your first product to start selling, or clear the filters."
            icon={<Package className="h-5 w-5" />}
            action={
              <Button
                onClick={() => {
                  setEditing(null);
                  setModalOpen(true);
                }}
              >
                <Plus className="h-4 w-4" /> New product
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {data.items.map((p) => {
            const threshold = p.lowStockThreshold ?? 5;
            const tone = p.stock <= 0 ? 'red' : p.stock <= threshold ? 'amber' : 'green';
            return (
              <Card key={p._id} className="flex flex-col gap-3 p-4">
                <div className="flex gap-3">
                  <div className="grid h-16 w-16 shrink-0 place-items-center overflow-hidden rounded-xl border border-line bg-surface">
                    {p.imageUrl ? (
                      <img src={p.imageUrl} alt={p.name} className="h-full w-full object-cover" loading="lazy" />
                    ) : (
                      <ImageIcon className="h-5 w-5 text-muted" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <p className="truncate text-sm font-semibold text-ink">{p.name}</p>
                      <Badge tone={tone}>{stockLabel(p.stock, threshold)}</Badge>
                    </div>
                    <p className="mt-0.5 truncate text-[11px] text-muted">SKU {p.sku}</p>
                    <p className="mt-1 text-sm font-bold text-ink">{currency(p.price, cur)}</p>
                  </div>
                </div>

                <p className="line-clamp-2 min-h-[32px] text-xs leading-relaxed text-muted">
                  {p.shortDescription || p.description || 'No description yet.'}
                </p>

                <div className="flex items-center justify-between gap-2 text-[11px] text-muted">
                  <span>{p.stock} in stock</span>
                  <StatusBadge status={p.status} />
                </div>

                <div className="mt-auto flex items-center gap-1.5 border-t border-line pt-3">
                  <Button
                    variant="secondary"
                    className="flex-1 px-2.5 py-1.5 text-xs"
                    onClick={() => {
                      setEditing(p);
                      setModalOpen(true);
                    }}
                  >
                    <Pencil className="h-3.5 w-3.5" /> Edit
                  </Button>
                  {p.status === 'active' ? (
                    <Button variant="ghost" className="px-2 py-1.5 text-xs" onClick={() => void archive(p)} aria-label="Archive product">
                      <Archive className="h-3.5 w-3.5" />
                    </Button>
                  ) : null}
                  {user?.role === 'owner' && (
                    <Button
                      variant="ghost"
                      className="px-2 py-1.5 text-xs text-rose-300 hover:text-rose-200"
                      onClick={() => void onDelete(p)}
                      aria-label="Delete product"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {data && <Card className="mt-4 p-0"><Pagination page={data.page} totalPages={data.totalPages} total={data.total} onPage={setPage} /></Card>}

      <ProductFormModal open={modalOpen} onClose={() => setModalOpen(false)} product={editing} />
    </div>
  );
}
