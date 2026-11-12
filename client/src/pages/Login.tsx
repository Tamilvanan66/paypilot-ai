import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { ArrowRight, Lock, Mail, ShieldCheck, Sparkles } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ApiClientError } from '../services/api';
import { Button, Field, Input } from '../components/ui';

export default function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const from = (location.state as { from?: string } | null)?.from ?? '/dashboard';

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email.trim(), password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Sign in failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="grid min-h-screen items-center gap-10 px-5 py-10 lg:grid-cols-2 lg:px-16">
      <div className="hidden lg:block">
        <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-line bg-surface px-3 py-1.5 text-xs text-muted">
          <Sparkles className="h-3.5 w-3.5 text-accent" />
          AI commerce & payments
        </div>
        <h1 className="text-4xl font-extrabold leading-tight tracking-tight text-ink">
          Build Smarter.<br />Sell Better.<br />
          <span className="bg-gradient-to-r from-accent to-accent2 bg-clip-text text-transparent">Grow Faster.</span>
        </h1>
        <p className="mt-4 max-w-md text-sm leading-relaxed text-muted">
          One operations console for your store: AI product guidance, verified PayPal payments,
          real-time inventory and analytics that come straight from your database.
        </p>
        <ul className="mt-8 space-y-3 text-sm text-muted">
          {[
            'Server-side payment verification with idempotent captures',
            'Store-scoped data with role-based access control',
            'AI recommendations grounded in live catalogue data',
          ].map((item) => (
            <li key={item} className="flex items-start gap-2.5">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-accent" />
              {item}
            </li>
          ))}
        </ul>
      </div>

      <div className="mx-auto w-full max-w-md">
        <form onSubmit={submit} className="panel space-y-4 p-6 sm:p-8" noValidate>
          <div>
            <h2 className="text-xl font-bold text-ink">Sign in</h2>
            <p className="mt-1 text-sm text-muted">Access your PayPilot workspace.</p>
          </div>

          {error && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3.5 py-2.5 text-xs text-rose-200" role="alert">
              {error}
            </div>
          )}

          <Field label="Work email" htmlFor="email">
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <Input
                id="email"
                type="email"
                autoComplete="email"
                required
                className="pl-9"
                placeholder="you@store.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
          </Field>

          <Field label="Password" htmlFor="password">
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
              <Input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                className="pl-9"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </div>
          </Field>

          <div className="flex items-center justify-between text-xs">
            <Link to="/forgot-password" className="text-accent hover:underline">
              Forgot password?
            </Link>
            <Link to="/register" className="text-muted hover:text-ink">
              Create a store
            </Link>
          </div>

          <Button type="submit" loading={loading} className="w-full">
            Sign in <ArrowRight className="h-4 w-4" />
          </Button>

          <p className="rounded-xl border border-line bg-surface px-3 py-2.5 text-[11px] leading-relaxed text-muted">
            Demo account: <span className="text-ink">demo@paypilot.ai</span> /{' '}
            <span className="text-ink">DemoPass123!</span> (available after running{' '}
            <code className="text-accent">npm run seed</code>).
          </p>
        </form>
      </div>
    </div>
  );
}
