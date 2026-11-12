const RAW_BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? '';
export const API_BASE = RAW_BASE.replace(/\/$/, '');

export class ApiClientError extends Error {
  status: number;
  code: string;
  details?: unknown;
  constructor(status: number, message: string, code = 'error', details?: unknown) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
  get fieldErrors(): Record<string, string> {
    const out: Record<string, string> = {};
    if (Array.isArray(this.details)) {
      for (const d of this.details as { field?: string; message?: string }[]) {
        if (d?.field) out[d.field] = d.message ?? 'Invalid value';
      }
    }
    return out;
  }
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  signal?: AbortSignal;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, signal } = options;
  let res: Response;
  try {
    res = await fetch(`${API_BASE}/api${path}`, {
      method,
      credentials: 'include',
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined,
      signal,
    });
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err;
    throw new ApiClientError(0, 'Cannot reach the API. Check that the server is running.', 'network_error');
  }

  const text = await res.text();
  let payload: unknown = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = null;
    }
  }

  const envelope = payload as
    | { success?: boolean; data?: T; error?: { code: string; message: string; details?: unknown } }
    | null;

  if (!res.ok || envelope?.success === false) {
    const e = envelope?.error;
    throw new ApiClientError(
      res.status,
      e?.message || `Request failed (${res.status})`,
      e?.code || 'error',
      e?.details,
    );
  }
  return (envelope?.data ?? (payload as T)) as T;
}

export const api = {
  get: <T>(path: string, signal?: AbortSignal) => apiRequest<T>(path, { signal }),
  post: <T>(path: string, body?: unknown) => apiRequest<T>(path, { method: 'POST', body }),
  put: <T>(path: string, body?: unknown) => apiRequest<T>(path, { method: 'PUT', body }),
  del: <T>(path: string) => apiRequest<T>(path, { method: 'DELETE' }),
};

export function qs(params: Record<string, string | number | undefined | null>): string {
  const sp = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== null && v !== '') sp.set(k, String(v));
  }
  const s = sp.toString();
  return s ? `?${s}` : '';
}
