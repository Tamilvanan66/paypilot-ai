import { useState } from 'react';
import { Link } from 'react-router-dom';
import { authApi } from '../services/endpoints';
import { ApiClientError } from '../services/api';
import { Button, Field, Input } from '../components/ui';

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const data = await authApi.forgot(email.trim());
      setMessage(data.message);
      setResetToken(data.resetToken);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Request failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-5 py-10">
      <form onSubmit={submit} className="panel w-full max-w-md space-y-4 p-6 sm:p-8" noValidate>
        <div>
          <h1 className="text-xl font-bold text-ink">Reset your password</h1>
          <p className="mt-1 text-sm text-muted">
            We'll issue a single-use reset token valid for 30 minutes.
          </p>
        </div>

        {error && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3.5 py-2.5 text-xs text-rose-200" role="alert">
            {error}
          </div>
        )}

        {message ? (
          <div className="space-y-3">
            <p className="rounded-xl border border-accent/30 bg-accent/10 px-3.5 py-2.5 text-xs text-ink">{message}</p>
            {resetToken && (
              <div className="rounded-xl border border-line bg-surface p-3">
                <p className="text-[11px] uppercase tracking-wide text-muted">Development reset link</p>
                <Link
                  to={`/reset-password?token=${encodeURIComponent(resetToken)}`}
                  className="mt-1 block break-all text-xs text-accent hover:underline"
                >
                  /reset-password?token={resetToken.slice(0, 24)}…
                </Link>
                <p className="mt-1.5 text-[11px] text-muted">
                  Shown only outside production. Configure an email provider to deliver this link.
                </p>
              </div>
            )}
            <Link to="/login" className="btn-secondary w-full">
              Back to sign in
            </Link>
          </div>
        ) : (
          <>
            <Field label="Account email" htmlFor="forgot-email">
              <Input
                id="forgot-email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@store.com"
              />
            </Field>
            <Button type="submit" loading={loading} className="w-full">
              Send reset link
            </Button>
            <p className="text-center text-xs text-muted">
              <Link to="/login" className="hover:text-ink">
                Back to sign in
              </Link>
            </p>
          </>
        )}
      </form>
    </div>
  );
}
