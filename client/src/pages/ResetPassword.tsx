import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { authApi } from '../services/endpoints';
import { ApiClientError } from '../services/api';
import { Button, Field, Input } from '../components/ui';

export default function ResetPassword() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [token, setToken] = useState(params.get('token') ?? '');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 8) return setError('Password must be at least 8 characters.');
    if (password !== confirm) return setError('Passwords do not match.');
    setLoading(true);
    try {
      await authApi.reset(token.trim(), password);
      setDone(true);
      window.setTimeout(() => navigate('/login', { replace: true }), 1800);
    } catch (err) {
      setError(err instanceof ApiClientError ? err.message : 'Reset failed.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-5 py-10">
      <form onSubmit={submit} className="panel w-full max-w-md space-y-4 p-6 sm:p-8" noValidate>
        <div>
          <h1 className="text-xl font-bold text-ink">Choose a new password</h1>
          <p className="mt-1 text-sm text-muted">Reset tokens are single-use and expire in 30 minutes.</p>
        </div>

        {error && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3.5 py-2.5 text-xs text-rose-200" role="alert">
            {error}
          </div>
        )}
        {done && (
          <p className="rounded-xl border border-accent/30 bg-accent/10 px-3.5 py-2.5 text-xs text-ink">
            Password updated. Redirecting to sign in…
          </p>
        )}

        <Field label="Reset token" htmlFor="token">
          <Input id="token" required value={token} onChange={(e) => setToken(e.target.value)} />
        </Field>
        <Field label="New password" htmlFor="new-password" hint="Minimum 8 characters">
          <Input id="new-password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </Field>
        <Field label="Confirm password" htmlFor="confirm-password">
          <Input id="confirm-password" type="password" required value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        </Field>

        <Button type="submit" loading={loading} className="w-full">
          Update password
        </Button>
        <p className="text-center text-xs text-muted">
          <Link to="/login" className="hover:text-ink">
            Back to sign in
          </Link>
        </p>
      </form>
    </div>
  );
}
