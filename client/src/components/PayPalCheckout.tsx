import { useEffect, useRef, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { paymentApi } from '../services/endpoints';
import { ApiClientError } from '../services/api';
import { usePayPalConfig } from '../hooks/queries';
import { useToast } from './ui/Toast';
import { Spinner } from './ui';

declare global {
  interface Window {
    paypal?: {
      Buttons: (options: Record<string, unknown>) => {
        render: (target: HTMLElement) => Promise<void>;
        close?: () => void;
      };
    };
  }
}

let sdkPromise: Promise<void> | null = null;

function loadSdk(clientId: string, currency: string): Promise<void> {
  if (window.paypal) return Promise.resolve();
  if (sdkPromise) return sdkPromise;
  sdkPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>('script[data-paypal-sdk]');
    if (existing) {
      existing.addEventListener('load', () => resolve());
      existing.addEventListener('error', () => reject(new Error('PayPal SDK failed to load')));
      return;
    }
    const s = document.createElement('script');
    s.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&currency=${encodeURIComponent(
      currency,
    )}&intent=capture&components=buttons`;
    s.async = true;
    s.dataset.paypalSdk = 'true';
    s.onload = () => resolve();
    s.onerror = () => reject(new Error('PayPal SDK failed to load'));
    document.body.appendChild(s);
  });
  return sdkPromise;
}

export default function PayPalCheckout({
  orderId,
  orderNumber,
  disabled = false,
  onPaid,
}: {
  orderId: string;
  orderNumber: string;
  disabled?: boolean;
  onPaid: () => void;
}) {
  const container = useRef<HTMLDivElement>(null);
  const { data: config, isLoading } = usePayPalConfig();
  const toast = useToast();
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    if (!config?.configured || !config.clientId || disabled) return;

    const mount = async () => {
      try {
        await loadSdk(config.clientId as string, config.currency || 'USD');
        if (cancelled || !container.current || !window.paypal) return;
        container.current.innerHTML = '';
        const buttons = window.paypal.Buttons({
          style: { layout: 'vertical', color: 'black', shape: 'pill', label: 'paypal', height: 44 },
          // The amount is created and priced on the server from database records.
          createOrder: async () => {
            const created = await paymentApi.createOrder(orderId, orderNumber);
            return created.paypalOrderId;
          },
          onApprove: async (data: { orderID: string }) => {
            try {
              const result = await paymentApi.captureOrder(data.orderID);
              if (result.verified) {
                toast.success(
                  result.alreadyProcessed
                    ? 'This payment was already captured — no duplicate charge.'
                    : 'Payment captured and verified against the order total.',
                );
                onPaid();
              } else {
                toast.error('PayPal capture returned but verification failed.');
              }
            } catch (err) {
              toast.error(err instanceof ApiClientError ? err.message : 'Capture failed.');
            }
          },
          onCancel: () => {
            toast.info('Checkout cancelled — no payment was taken.');
          },
          onError: (err: unknown) => {
            toast.error(err instanceof Error ? err.message : 'PayPal checkout error.');
          },
        });
        await buttons.render(container.current);
        if (!cancelled) setReady(true);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : 'Could not load PayPal.');
      }
    };

    void mount();
    return () => {
      cancelled = true;
    };
  }, [config, orderId, orderNumber, disabled, onPaid, toast]);

  if (isLoading) return <Spinner label="Checking PayPal configuration…" />;

  if (!config?.configured) {
    return (
      <div className="rounded-xl border border-amber-400/30 bg-amber-400/10 px-3.5 py-3 text-xs leading-relaxed text-amber-200">
        <p className="font-semibold">PayPal Sandbox is not configured on the server.</p>
        <p className="mt-1 text-amber-200/80">
          Set <code>PAYPAL_CLIENT_ID</code> and <code>PAYPAL_CLIENT_SECRET</code> in{' '}
          <code>server/.env</code>, then restart the API. The order stays unpaid until a
          server-verified capture succeeds.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div ref={container} className="min-h-[44px]" />
      {error && <p className="text-xs text-rose-300">{error}</p>}
      {!ready && !error && <Spinner label="Loading PayPal checkout…" />}
      <p className="flex items-center gap-1.5 text-[11px] text-muted">
        <ShieldCheck className="h-3.5 w-3.5 text-accent" />
        Amount comes from the server-side order total · {config.environment} mode
      </p>
    </div>
  );
}
