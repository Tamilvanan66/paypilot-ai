import { describe, expect, it, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { AuthProvider, useAuth } from '../context/AuthContext';
import ProtectedRoute from '../components/ProtectedRoute';

function Probe() {
  const { user, loading, store } = useAuth();
  return (
    <div>
      <p data-testid="loading">{String(loading)}</p>
      <p data-testid="user">{user?.email ?? 'none'}</p>
      <p data-testid="store">{store?.name ?? 'none'}</p>
    </div>
  );
}

describe('AuthProvider + ProtectedRoute', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('restores a session from GET /api/auth/me', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(
          JSON.stringify({
            success: true,
            data: {
              user: { id: 'u1', name: 'Ada', email: 'ada@store.com', role: 'owner', storeId: 's1' },
              store: { id: 's1', name: 'Lovelace Supply', slug: 'lovelace', currency: 'USD' },
            },
          }),
          { status: 200, headers: { 'Content-Type': 'application/json' } },
        ),
      ),
    );

    render(
      <AuthProvider>
        <Probe />
      </AuthProvider>,
    );

    await waitFor(() => expect(screen.getByTestId('loading')).toHaveTextContent('false'));
    expect(screen.getByTestId('user')).toHaveTextContent('ada@store.com');
    expect(screen.getByTestId('store')).toHaveTextContent('Lovelace Supply');
  });

  it('redirects unauthenticated visitors to /login', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify({ success: false, error: { code: 'unauthorized', message: 'Not signed in' } }), {
          status: 401,
          headers: { 'Content-Type': 'application/json' },
        }),
      ),
    );

    render(
      <MemoryRouter initialEntries={['/dashboard']}>
        <AuthProvider>
          <ProtectedRoute>
            <p>Secret dashboard</p>
          </ProtectedRoute>
        </AuthProvider>
      </MemoryRouter>,
    );

    await waitFor(() => expect(screen.queryByText('Secret dashboard')).not.toBeInTheDocument());
  });
});
