import { getAccessToken, isTokenExpiredOrExpiringSoon, clearTokens } from './tokenStorage';
import { refreshAccessToken } from './refreshToken';
import { getApiBaseUrl, getAuthFunctionsBaseUrl } from './apiConfig';
import { triggerAuthFailure } from './authFailure';

export interface ApiError {
  success: false;
  error: string;
  code?: string;
  retryAfter?: number;
}

function resolveUrl(input: RequestInfo | URL): string {
  if (typeof input === 'string' && !input.startsWith('http')) {
    const base = getApiBaseUrl();
    return input.startsWith('/') ? `${base}${input}` : `${base}/${input}`;
  }
  if (input instanceof URL) return input.toString();
  if (input instanceof Request) return input.url;
  return String(input);
}

/**
 * Enhanced fetch with automatic token refresh and retry on 401.
 * Uses EXPO_PUBLIC_API_URL for relative paths. On 401 after failed refresh, clears tokens and calls triggerAuthFailure().
 */
export async function apiFetch(
  input: RequestInfo | URL,
  options: RequestInit = {}
): Promise<Response> {
  const url = resolveUrl(input);
  let accessToken = await getAccessToken();

  if (accessToken && (await isTokenExpiredOrExpiringSoon())) {
    const refreshResult = await refreshAccessToken();
    if (refreshResult.data) {
      accessToken = refreshResult.data.accessToken;
    } else {
      await clearTokens();
      triggerAuthFailure();
      throw new Error('Token refresh failed. Please login again.');
    }
  }

  const headers = new Headers(options.headers);
  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  let response = await fetch(url, { ...options, headers });

  if (response.status === 401 && accessToken) {
    const refreshResult = await refreshAccessToken();
    if (refreshResult.data) {
      headers.set('Authorization', `Bearer ${refreshResult.data.accessToken}`);
      response = await fetch(url, { ...options, headers });
    } else {
      await clearTokens();
      triggerAuthFailure();
      throw new Error('Authentication failed. Please login again.');
    }
  }

  return response;
}

function parseApiError(response: Response, data: any): ApiError {
  const success = false;
  const error =
    (typeof data?.error === 'string' ? data.error : null) ||
    data?.message ||
    data?.error?.message ||
    `HTTP ${response.status}: ${response.statusText}`;
  const code = data?.code ?? data?.error?.code ?? `HTTP_${response.status}`;
  const retryAfter = data?.retryAfter ?? data?.error?.retryAfter;
  return { success, error, code, retryAfter };
}

/** Backend may not expose all Edge Functions yet — log and let the app continue. */
function log404NonBlocking(label: string, url: string) {
  console.warn(`[API] 404 Not Found (non-blocking): ${label}`, url);
}

/**
 * Authenticated API call with JSON response. Resolves relative URLs against API base.
 * Returns errors in contract: { success: false, error: string, code?: string, retryAfter?: number }.
 */
export async function apiCall<T>(
  url: string,
  options: RequestInit = {}
): Promise<{ data?: T; error?: ApiError }> {
  try {
    const resolved = resolveUrl(url);
    const response = await apiFetch(resolved, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string>),
      },
    });

    let data: any;
    const text = await response.text();
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { error: text || response.statusText };
    }

    if (!response.ok) {
      if (response.status === 404) {
        log404NonBlocking(`apiCall ${resolved}`, resolved);
        return { data: undefined, error: undefined };
      }
      return { error: parseApiError(response, data) };
    }

    return { data: (text ? data : undefined) as T };
  } catch (err: any) {
    return {
      error: {
        success: false,
        error: err?.message || 'Network error. Please check your connection.',
        code: 'NETWORK_ERROR',
      },
    };
  }
}

/** Spec success responses are { success: true, [key]: value }. Use responseKey to unwrap. */
export async function functionsCall<T = any>(
  functionName: string,
  body: Record<string, unknown>,
  responseKey?: string
): Promise<{ data?: T; error?: ApiError }> {
  try {
    const url = `${getAuthFunctionsBaseUrl()}/${functionName}`;
    const response = await apiFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    const text = await response.text();
    let data: any;
    try {
      data = text ? JSON.parse(text) : {};
    } catch {
      data = { error: text || response.statusText };
    }

    if (!response.ok) {
      if (response.status === 404) {
        log404NonBlocking(`functions/${functionName}`, url);
        return { data: undefined, error: undefined };
      }
      return { error: parseApiError(response, data) };
    }

    const payload = text ? data : undefined;
    let unwrapped = payload;
    if (responseKey && payload && typeof payload === 'object' && !Array.isArray(payload)) {
      if ((payload as any)[responseKey] !== undefined) {
        unwrapped = (payload as any)[responseKey];
      } else if ((payload as any).data !== undefined) {
        unwrapped = (payload as any).data;
      } else if ((payload as any).items !== undefined) {
        unwrapped = (payload as any).items;
      } else if ((payload as any).success !== undefined) {
        // Fallback: look for ANY array in the payload if the primary key is missing
        const firstArray = Object.values(payload).find(v => Array.isArray(v));
        if (firstArray !== undefined) {
          unwrapped = firstArray;
        } else {
          unwrapped = undefined;
        }
      }
    }
    return { data: unwrapped as T };
  } catch (err: any) {
    return {
      error: {
        success: false,
        error: err?.message || 'Network error. Please check your connection.',
        code: 'NETWORK_ERROR',
      },
    };
  }
}
