import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { authApi } from '../services/endpoints';
import { ApiClientError } from '../services/api';
import type { Store, User } from '../types';

interface RegisterInput {
  name: string;
  email: string;
  password: string;
  storeName: string;
}

interface AuthValue {
  user: User | null;
  store: Store | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [store, setStore] = useState<Store | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await authApi.me();
      setUser(data.user);
      setStore(data.store ?? null);
    } catch (err) {
      if (err instanceof ApiClientError && err.status !== 401) {
        // network/server problem: keep the session state as-is
      }
      setUser(null);
      setStore(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = useCallback(async (email: string, password: string) => {
    const data = await authApi.login({ email, password });
    setUser(data.user);
    setStore(data.store ?? null);
  }, []);

  const register = useCallback(async (input: RegisterInput) => {
    const data = await authApi.register(input);
    setUser(data.user);
    setStore(data.store ?? null);
  }, []);

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      setUser(null);
      setStore(null);
    }
  }, []);

  const value = useMemo<AuthValue>(
    () => ({ user, store, loading, login, register, logout, refresh }),
    [user, store, loading, login, register, logout, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
