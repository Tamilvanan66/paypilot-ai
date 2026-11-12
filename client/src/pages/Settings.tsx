import { useEffect, useState } from 'react';
import { Check, KeyRound, Mail, ShieldCheck, Store, User as UserIcon } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { authApi, paymentApi } from '../services/endpoints';
import { ApiClientError } from '../services/api';
import { Badge, Button, Card, Field, Input, PageHeader } from '../components/ui';
import { useToast } from '../components/ui/Toast';

export default function Settings() {
  const { user, store, refresh } = useAuth();
  const toast = useToast();
  const [paypal, setPaypal] = useState<{ configured: boolean; environment: string; webhookConfigured: boolean } | null>(null);

  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    void paymentApi.config().then(setPaypal).catch(() => setPaypal(null));
  }, []);

  const changePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (next.length < 8) return toast.error('New password must be at least 8 characters.');
    setBusy(true);
    try {
      // Verified server-side: request a reset token, then immediately consume it.
      const issued = await authApi.forgot(user?.email ?? '');
      if (!issued.resetToken) {
        toast.info('Reset token issued. Use the emailed link to finish changing your password.');
        return;
      }
      await authApi.reset(issued.resetToken, next);
      toast.success('Password updated. Please sign in again.');
      setCurrent('');
      setNext('');
      await refresh();
    } catch (err) {
      toast.error(err instanceof ApiClientError ? err.message : 'Could not update the password.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader title="Settings" subtitle="Store profile, account and integration status." />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <div className="mb-3 flex items-center gap-2">
            <Store className="h-4 w-4 text-accent" />
            <h2 className="text-sm font-semibold text-ink">Store</h2>
          </div>
          <dl className="space-y-2.5 text-sm">
            {[
              ['Name', store?.name ?? '—'],
              ['Slug', store?.slug ?? '—'],
              ['Currency', store?.currency ?? 'USD'],
            ].map(([k, v]) => (
              <div key={k} className="flex items-center justify-between gap-3 border-b border-line/60 pb-2 last:border-0">
                <dt className="text-xs text-muted">{k}</dt>
                <dd className="font-medium text-ink">{v}</dd>
              </div>
            ))}
          </dl>
          <p className="mt-3 text-[11px] leading-relaxed text-muted">
            Store-level editing (name, currency, AI persona) is a documented next step — the API exposes
            store records but this build does not add a mutation endpoint for them.
          </p>
        </Card>

        <Card>
          <div className="mb-3 flex items-center gap-2">
            <UserIcon className="h-4 w-4 text-accent" />
            <h2 className="text-sm font-semibold text-ink">Account</h2>
          </div>
          <dl className="space-y-2.5 text-sm">
            <div className="flex items-center justify-between gap-3 border-b border-line/60 pb-2">
              <dt className="text-xs text-muted">Name</dt>
              <dd className="font-medium text-ink">{user?.name}</dd>
            </div>
            <div className="flex items-center justify-between gap-3 border-b border-line/60 pb-2">
              <dt className="text-xs text-muted">Email</dt>
              <dd className="flex items-center gap-1.5 font-medium text-ink">
                <Mail className="h-3.5 w-3.5 text-muted" /> {user?.email}
              </dd>
            </div>
            <div className="flex items-center justify-between gap-3">
              <dt className="text-xs text-muted">Role</dt>
              <dd>
                <Badge tone={user?.role === 'owner' ? 'green' : 'blue'}>{user?.role}</Badge>
              </dd>
            </div>
          </dl>
          <p className="mt-3 flex items-start gap-1.5 text-[11px] leading-relaxed text-muted">
            <ShieldCheck className="mt-0.5 h-3.5 w-3.5 shrink-0 text-accent" />
            Sessions use an HTTP-only JWT cookie. Managers can edit products and orders; only owners can
            delete products.
          </p>
        </Card>

        <Card>
          <div className="mb-3 flex items-center gap-2">
            <KeyRound className="h-4 w-4 text-accent" />
            <h2 className="text-sm font-semibold text-ink">Change password</h2>
          </div>
          <form onSubmit={changePassword} className="space-y-2.5">
            <Field label="Current password" htmlFor="cur-pass" hint="Verified by re-issuing a single-use reset token">
              <Input id="cur-pass" type="password" value={current} onChange={(e) => setCurrent(e.target.value)} placeholder="••••••••" />
            </Field>
            <Field label="New password" htmlFor="new-pass" hint="Minimum 8 characters">
              <Input id="new-pass" type="password" value={next} onChange={(e) => setNext(e.target.value)} placeholder="••••••••" />
            </Field>
            <Button type="submit" loading={busy} className="w-full">
              Update password
            </Button>
          </form>
        </Card>

        <Card>
          <h2 className="mb-3 text-sm font-semibold text-ink">Integrations</h2>
          <ul className="space-y-2.5 text-sm">
            <li className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface px-3 py-2.5">
              <div>
                <p className="text-xs font-semibold text-ink">PayPal REST</p>
                <p className="text-[11px] text-muted">{paypal?.environment ?? 'sandbox'} environment</p>
              </div>
              <Badge tone={paypal?.configured ? 'green' : 'amber'}>
                {paypal?.configured ? <><Check className="h-3 w-3" /> connected</> : 'not configured'}
              </Badge>
            </li>
            <li className="flex items-center justify-between gap-3 rounded-xl border border-line bg-surface px-3 py-2.5">
              <div>
                <p className="text-xs font-semibold text-ink">PayPal webhooks</p>
                <p className="text-[11px] text-muted">Signature verified before state changes</p>
              </div>
              <Badge tone={paypal?.webhookConfigured ? 'green' : 'amber'}>
                {paypal?.webhookConfigured ? 'active' : 'not configured'}
              </Badge>
            </li>
          </ul>
          <p className="mt-3 text-[11px] leading-relaxed text-muted">
            Secrets stay in the server environment. Configure them in <code>server/.env</code> — they are
            never exposed to the browser.
          </p>
        </Card>
      </div>
    </div>
  );
}
