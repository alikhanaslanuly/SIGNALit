import { afterEach, expect, it, vi } from 'vitest';
import { ApiClient } from './client';
afterEach(() => vi.unstubAllGlobals());
it('binds native browser fetch to the global receiver', async () => {
  vi.stubGlobal('fetch', function(this: unknown) {
    if (this !== globalThis) throw new TypeError('Illegal invocation');
    return Promise.resolve(new Response(JSON.stringify({ ok: true })));
  });
  expect(await new ApiClient({ baseUrl: 'http://local.test' }).get('/health')).toEqual({ ok: true });
});

it('uses the configured API origin and defaults production to the current origin', async () => {
  const { vi } = await import('vitest'); const { defaultApiUrl } = await import('./client');
  vi.stubEnv('DEV', false); vi.stubEnv('VITE_API_URL', ''); vi.stubGlobal('window', { location: { origin: 'https://demo.example' } });
  try {
    expect(defaultApiUrl()).toBe('https://demo.example');
    vi.stubEnv('VITE_API_URL', 'https://api.example/'); expect(defaultApiUrl()).toBe('https://api.example');
  } finally { vi.unstubAllEnvs(); vi.unstubAllGlobals(); }
});
