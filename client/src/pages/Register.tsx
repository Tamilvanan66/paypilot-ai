import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { ApiClientError } from '../services/api';
import { Button, Field, Input } from '../components/ui';

export default function Register() {
  const { register } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', email: '', password: '', storeName: '' });
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const set = (key: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm((f) => ({ ...f, [key]: e.target.value }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    const next: Record<string, string> = {};
    if (form.name.trim().length < 2) next.name = 'Enter your full name';
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(form.email)) next.email = 'Enter a valid email address';
    if (form.password.length < 8) next.password = 'Password must be at least 8 characters';
    if (form.storeName.trim().length < 2) next.storeName = 'Enter your store name';
    setErrors(next);
    if (Object.keys(next).length) return;

    setLoading(true);
    try {
      await register({
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        storeName: form.storeName.trim(),
      });
      navigate('/dashboard', { replace: true });
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.message);
        setErrors(err.fieldErrors);
      } else {
        setError('Registration failed. Please try again.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center px-5 py-10">
      <form onSubmit={submit} className="panel w-full max-w-md space-y-4 p-6 sm:p-8" noValidate>
        <div>
          <h1 className="text-xl font-bold text-ink">Create your store</h1>
          <p className="mt-1 text-sm text-muted">You'll be the business owner of this workspace.</p>
        </div>

        {error && (
          <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 px-3.5 py-2.5 text-xs text-rose-200" role="alert">
            {error}
          </div>
        )}

        <Field label="Your name" error={errors.name} htmlFor="name">
          <Input id="name" value={form.name} onChange={set('name')} placeholder="Ada Lovelace" invalid={!!errors.name} />
        </Field>
        <Field label="Store name" error={errors.storeName} htmlFor="storeName">
          <Input id="storeName" value={form.storeName} onChange={set('storeName')} placeholder="Lovelace Supply Co." invalid={!!errors.storeName} />
        </Field>
        <Field label="Work email" error={errors.email} htmlFor="reg-email">
          <Input id="reg-email" type="email" value={form.email} onChange={set('email')} placeholder="you@store.com" invalid={!!errors.email} />
        </Field>
        <Field label="Password" error={errors.password} hint="Minimum 8 characters" htmlFor="reg-password">
          <Input id="reg-password" type="password" value={form.password} onChange={set('password')} placeholder="••••••••" invalid={!!errors.password} />
        </Field>

        <Button type="submit" loading={loading} className="w-full">
          Create account <ArrowRight className="h-4 w-4" />
        </Button>

        <p className="text-center text-xs text-muted">
          Already have an account?{' '}
          <Link to="/login" className="font-semibold text-accent hover:underline">
            Sign in
          </Link>
        </p>
      </form>
    </div>
  );
}
