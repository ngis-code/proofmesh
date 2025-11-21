import { useAuth } from './AuthContext';

const API_BASE = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:3000';

export interface ApiError {
  error: string;
  message?: string;
  details?: unknown;
}

async function rawFetch<T>(
  path: string,
  options: RequestInit = {},
  jwt?: string | null,
): Promise<T> {
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...(options.headers ?? {}),
  };
  if (jwt) {
    headers.Authorization = `Bearer ${jwt}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  let body: any = null;
  const text = await res.text();
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      body = text;
    }
  }

  if (!res.ok) {
    const err: ApiError = typeof body === 'object' && body && 'error' in body ? body : { error: 'request_failed' };
    throw new Error(err.error);
  }

  return body as T;
}

export function useApi() {
  const { jwt, refreshJwt, logout } = useAuth();

  return {
    get: async <T,>(path: string) => {
      try {
        return await rawFetch<T>(path, { method: 'GET' }, jwt);
      } catch (err: any) {
        if (err instanceof Error && err.message === 'invalid_token') {
          try {
            const newJwt = await refreshJwt();
            return await rawFetch<T>(path, { method: 'GET' }, newJwt);
          } catch {
            await logout();
            throw err;
          }
        }
        throw err;
      }
    },
    post: async <T,>(path: string, body?: unknown) => {
      const options: RequestInit = {
        method: 'POST',
        body: body !== undefined ? JSON.stringify(body) : undefined,
      };
      try {
        return await rawFetch<T>(path, options, jwt);
      } catch (err: any) {
        if (err instanceof Error && err.message === 'invalid_token') {
          try {
            const newJwt = await refreshJwt();
            return await rawFetch<T>(path, options, newJwt);
          } catch {
            await logout();
            throw err;
          }
        }
        throw err;
      }
    },
    // For public endpoints like /api/verify that don't need auth:
    postPublic: <T,>(path: string, body?: unknown) =>
      rawFetch<T>(
        path,
        {
          method: 'POST',
          body: body !== undefined ? JSON.stringify(body) : undefined,
        },
        null,
      ),
  };
}


