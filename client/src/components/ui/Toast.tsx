import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { CheckCircle2, Info, X, XCircle } from 'lucide-react';

type ToastKind = 'success' | 'error' | 'info';
interface ToastItem {
  id: number;
  kind: ToastKind;
  message: string;
}

interface ToastApi {
  toast: (message: string, kind?: ToastKind) => void;
  success: (message: string) => void;
  error: (message: string) => void;
  info: (message: string) => void;
}

const ToastContext = createContext<ToastApi | null>(null);

const styles: Record<ToastKind, string> = {
  success: 'border-accent/40 bg-accent/10 text-ink',
  error: 'border-red-500/40 bg-red-500/10 text-ink',
  info: 'border-accent2/40 bg-accent2/10 text-ink',
};

const icons: Record<ToastKind, ReactNode> = {
  success: <CheckCircle2 className="h-4 w-4 text-accent" />,
  error: <XCircle className="h-4 w-4 text-red-400" />,
  info: <Info className="h-4 w-4 text-accent2" />,
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: number) => {
    setItems((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const toast = useCallback(
    (message: string, kind: ToastKind = 'info') => {
      const id = Date.now() + Math.random();
      setItems((prev) => [...prev.slice(-3), { id, kind, message }]);
      window.setTimeout(() => dismiss(id), 4500);
    },
    [dismiss],
  );

  const value = useMemo<ToastApi>(
    () => ({
      toast,
      success: (m: string) => toast(m, 'success'),
      error: (m: string) => toast(m, 'error'),
      info: (m: string) => toast(m, 'info'),
    }),
    [toast],
  );

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        className="pointer-events-none fixed bottom-4 right-4 z-[100] flex w-[min(92vw,360px)] flex-col gap-2"
        aria-live="polite"
        role="status"
      >
        {items.map((t) => (
          <div
            key={t.id}
            className={`pointer-events-auto flex animate-fade-up items-start gap-2.5 rounded-xl border px-3.5 py-3 text-sm shadow-lg backdrop-blur ${styles[t.kind]}`}
          >
            <span className="mt-0.5 shrink-0">{icons[t.kind]}</span>
            <p className="flex-1 leading-snug">{t.message}</p>
            <button
              onClick={() => dismiss(t.id)}
              className="rounded p-0.5 text-muted transition hover:text-ink"
              aria-label="Dismiss notification"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastApi {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used inside ToastProvider');
  return ctx;
}
