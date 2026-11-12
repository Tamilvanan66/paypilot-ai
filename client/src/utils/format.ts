export const currency = (n: number, code = 'USD') =>
  new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: code || 'USD',
    maximumFractionDigits: 2,
  }).format(Number.isFinite(n) ? n : 0);

export const compact = (n: number) =>
  new Intl.NumberFormat('en-US', { notation: 'compact', maximumFractionDigits: 1 }).format(
    Number.isFinite(n) ? n : 0,
  );

export const dateShort = (iso?: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—';

export const dateTime = (iso?: string | null) =>
  iso
    ? new Date(iso).toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      })
    : '—';

export const relative = (iso?: string | null) => {
  if (!iso) return '—';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  return dateShort(iso);
};

export const initials = (name: string) =>
  name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('') || 'U';

export const stockLabel = (stock: number, threshold = 5) =>
  stock <= 0 ? 'Out of stock' : stock <= threshold ? 'Low stock' : 'In stock';

export const titleCase = (s: string) => s.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
