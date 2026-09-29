export interface ApiClientOptions {
  baseUrl: string;
  fetchImpl?: typeof fetch;
}

export class ApiError extends Error {
  constructor(public readonly status: number, public readonly code: string, message: string) {
    super(message);
    this.name = 'ApiError';
  }
}

export class ApiClient {
  private readonly fetchImpl: typeof fetch;
  private readonly baseUrl: string;

  constructor(options: ApiClientOptions) {
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
    this.baseUrl = options.baseUrl.replace(/\/$/, '');
  }

  async request<T>(path: string, init: RequestInit = {}): Promise<T> {
    const response = await this.fetchImpl(`${this.baseUrl}${path}`, {
      ...init,
      signal: init.signal ?? AbortSignal.timeout(10000),
      headers: { 'Content-Type': 'application/json', ...(init.headers ?? {}) },
    });
    const body = await response.json().catch(() => null) as T | { error?: { code?: string; message?: string } } | null;
    if (!response.ok) {
      const error = body && typeof body === 'object' && 'error' in body ? body.error : undefined;
      throw new ApiError(response.status, error?.code ?? 'API_ERROR', error?.message ?? 'Request failed');
    }
    return body as T;
  }

  get<T>(path: string): Promise<T> { return this.request<T>(path); }
  post<T>(path: string, body: unknown): Promise<T> {
    return this.request<T>(path, { method: 'POST', body: JSON.stringify(body) });
  }
}

export const defaultApiUrl = (): string => import.meta.env.VITE_API_URL?.trim().replace(/\/$/, '') || (typeof window !== 'undefined' ? window.location.origin : '');
