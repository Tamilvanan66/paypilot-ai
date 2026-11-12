import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiClientError, apiRequest, qs } from '../services/api';

const jsonResponse = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

describe('api client', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('unwraps the success envelope', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => jsonResponse({ success: true, data: { ok: 1 } })));
    await expect(apiRequest<{ ok: number }>('/health')).resolves.toEqual({ ok: 1 });
  });

  it('throws typed errors with field details', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        jsonResponse(
          {
            success: false,
            error: { code: 'bad_request', message: 'Validation failed', details: [{ field: 'email', message: 'Invalid' }] },
          },
          400,
        ),
      ),
    );
    const err = (await apiRequest('/x').catch((e: unknown) => e)) as ApiClientError;
    expect(err).toBeInstanceOf(ApiClientError);
    expect(err.status).toBe(400);
    expect(err.code).toBe('bad_request');
    expect(err.fieldErrors).toEqual({ email: 'Invalid' });
  });

  it('reports network failures clearly', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('down'); }));
    const err = (await apiRequest('/x').catch((e: unknown) => e)) as ApiClientError;
    expect(err.status).toBe(0);
    expect(err.code).toBe('network_error');
    expect(err.message).toMatch(/Cannot reach the API/);
  });

  it('builds query strings without empty values', () => {
    expect(qs({ page: 1, search: '', limit: undefined, status: 'active' })).toBe('?page=1&status=active');
    expect(qs({})).toBe('');
  });
});
