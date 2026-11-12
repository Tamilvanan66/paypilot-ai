import type { ButtonHTMLAttributes, InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { AlertTriangle, Inbox, Loader2 } from 'lucide-react';

const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(' ');

export function Card({
  children,
  className,
  as: Tag = 'div',
}: {
  children: ReactNode;
  className?: string;
  as?: 'div' | 'section' | 'article';
}) {
  return <Tag className={cx('panel p-5', className)}>{children}</Tag>;
}

export function PageHeader({
  title,
  subtitle,
  actions,
}: {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-xl font-bold tracking-tight text-ink sm:text-2xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger';

export function Button({
  variant = 'primary',
  loading = false,
  className,
  children,
  ...rest
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: ButtonVariant; loading?: boolean }) {
  const map: Record<ButtonVariant, string> = {
    primary: 'btn-primary',
    secondary: 'btn-secondary',
    ghost: 'btn-ghost',
    danger: 'btn-danger',
  };
  return (
    <button className={cx(map[variant], className)} disabled={rest.disabled || loading} {...rest}>
      {loading && <Loader2 className="h-4 w-4 animate-spin" />}
      {children}
    </button>
  );
}

export function StatCard({
  label,
  value,
  hint,
  icon,
  tone = 'accent',
  loading = false,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: ReactNode;
  tone?: 'accent' | 'violet' | 'amber' | 'rose' | 'sky';
  loading?: boolean;
}) {
  const tones: Record<string, string> = {
    accent: 'bg-accent/12 text-accent border-accent/25',
    violet: 'bg-accent2/12 text-accent2 border-accent2/25',
    amber: 'bg-amber-400/12 text-amber-300 border-amber-400/25',
    rose: 'bg-rose-500/12 text-rose-300 border-rose-500/25',
    sky: 'bg-sky-400/12 text-sky-300 border-sky-400/25',
  };
  return (
    <div className="panel animate-fade-up p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
        <span className={cx('grid h-8 w-8 shrink-0 place-items-center rounded-lg border', tones[tone])}>
          {icon}
        </span>
      </div>
      {loading ? (
        <Skeleton className="mt-3 h-7 w-24" />
      ) : (
        <p className="mt-2.5 text-2xl font-bold tracking-tight text-ink">{value}</p>
      )}
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

const badgeTones: Record<string, string> = {
  green: 'border-accent/30 bg-accent/10 text-accent',
  teal: 'border-accent/30 bg-accent/10 text-accent',
  violet: 'border-accent2/30 bg-accent2/10 text-accent2',
  amber: 'border-amber-400/30 bg-amber-400/10 text-amber-300',
  red: 'border-rose-500/30 bg-rose-500/10 text-rose-300',
  slate: 'border-line bg-white/5 text-muted',
  blue: 'border-sky-400/30 bg-sky-400/10 text-sky-300',
};

export function Badge({ children, tone = 'slate' }: { children: ReactNode; tone?: keyof typeof badgeTones | string }) {
  return <span className={cx('chip', badgeTones[tone] ?? badgeTones.slate)}>{children}</span>;
}

const statusTone: Record<string, string> = {
  pending: 'amber',
  unpaid: 'amber',
  paid: 'green',
  processing: 'blue',
  shipped: 'violet',
  delivered: 'green',
  completed: 'green',
  cancelled: 'red',
  failed: 'red',
  refunded: 'slate',
  active: 'green',
  archived: 'slate',
  created: 'amber',
  captured: 'green',
  approved: 'blue',
};

export function StatusBadge({ status }: { status: string }) {
  return <Badge tone={statusTone[status] ?? 'slate'}>{status.replace(/_/g, ' ')}</Badge>;
}

export function Skeleton({ className }: { className?: string }) {
  return (
    <div className={cx('relative overflow-hidden rounded-md bg-white/[0.06]', className)}>
      <div className="absolute inset-0 -translate-x-full animate-shimmer bg-gradient-to-r from-transparent via-white/10 to-transparent" />
    </div>
  );
}

export function TableSkeleton({ rows = 5, cols = 4 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-2.5 p-4">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="grid gap-3" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0,1fr))` }}>
          {Array.from({ length: cols }).map((__, c) => (
            <Skeleton key={c} className="h-4" />
          ))}
        </div>
      ))}
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
  icon,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 px-6 py-14 text-center">
      <div className="grid h-12 w-12 place-items-center rounded-2xl border border-line bg-surface text-muted">
        {icon ?? <Inbox className="h-5 w-5" />}
      </div>
      <h3 className="text-sm font-semibold text-ink">{title}</h3>
      {description && <p className="max-w-sm text-sm text-muted">{description}</p>}
      {action}
    </div>
  );
}

export function ErrorState({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-12 text-center">
      <div className="grid h-12 w-12 place-items-center rounded-2xl border border-rose-500/30 bg-rose-500/10 text-rose-300">
        <AlertTriangle className="h-5 w-5" />
      </div>
      <p className="max-w-md text-sm text-ink">{message}</p>
      {onRetry && (
        <Button variant="secondary" onClick={onRetry}>
          Try again
        </Button>
      )}
    </div>
  );
}

export function Spinner({ label }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-10 text-sm text-muted">
      <Loader2 className="h-4 w-4 animate-spin text-accent" />
      {label ?? 'Loading…'}
    </div>
  );
}

export function Field({
  label,
  error,
  hint,
  htmlFor,
  children,
}: {
  label: string;
  error?: string;
  hint?: string;
  htmlFor?: string;
  children: ReactNode;
}) {
  return (
    <div>
      <label className="label" htmlFor={htmlFor}>
        {label}
      </label>
      {children}
      {error ? (
        <p className="mt-1 text-xs text-rose-400" role="alert">
          {error}
        </p>
      ) : (
        hint && <p className="mt-1 text-xs text-muted">{hint}</p>
      )}
    </div>
  );
}

export function Input({ className, invalid, ...rest }: InputHTMLAttributes<HTMLInputElement> & { invalid?: boolean }) {
  return <input className={cx('field', invalid && 'field-error', className)} {...rest} />;
}

export function Select({
  className,
  invalid,
  children,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement> & { invalid?: boolean }) {
  return (
    <select className={cx('field', invalid && 'field-error', className)} {...rest}>
      {children}
    </select>
  );
}

export function Textarea({
  className,
  invalid,
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { invalid?: boolean }) {
  return <textarea className={cx('field min-h-[96px] resize-y', invalid && 'field-error', className)} {...rest} />;
}

export function Modal({
  open,
  onClose,
  title,
  description,
  children,
  footer,
  wide = false,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  wide?: boolean;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 backdrop-blur-sm sm:items-center">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className={cx('panel my-8 w-full animate-fade-up p-0', wide ? 'max-w-3xl' : 'max-w-lg')}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line px-5 py-4">
          <div>
            <h2 className="text-base font-semibold text-ink">{title}</h2>
            {description && <p className="mt-0.5 text-xs text-muted">{description}</p>}
          </div>
          <button onClick={onClose} className="btn-ghost -mr-1 px-2 py-1 text-lg leading-none" aria-label="Close dialog">
            ×
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer && <div className="flex justify-end gap-2 border-t border-line px-5 py-3.5">{footer}</div>}
      </div>
    </div>
  );
}

export function Pagination({
  page,
  totalPages,
  total,
  onPage,
}: {
  page: number;
  totalPages: number;
  total?: number;
  onPage: (p: number) => void;
}) {
  if (totalPages <= 1) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line px-4 py-3 text-sm">
      <p className="text-xs text-muted">
        Page {page} of {totalPages}
        {typeof total === 'number' ? ` · ${total} total` : ''}
      </p>
      <div className="flex gap-2">
        <Button variant="secondary" className="px-3 py-1.5 text-xs" disabled={page <= 1} onClick={() => onPage(page - 1)}>
          Previous
        </Button>
        <Button
          variant="secondary"
          className="px-3 py-1.5 text-xs"
          disabled={page >= totalPages}
          onClick={() => onPage(page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}

export function Progress({ value, max = 100, tone = 'accent' }: { value: number; max?: number; tone?: 'accent' | 'amber' | 'rose' }) {
  const pct = Math.max(0, Math.min(100, (value / (max || 1)) * 100));
  const tones = { accent: 'bg-accent', amber: 'bg-amber-400', rose: 'bg-rose-500' };
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-white/10">
      <div className={cx('h-full rounded-full transition-all', tones[tone])} style={{ width: `${pct}%` }} />
    </div>
  );
}

export { cx };
