import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';

import { supabaseUrl, supabaseAnonKey } from './supabaseConfig';
import { apiFetch } from './apiClient';

// Use a single shared storage key for all clients to ensure they share the same auth session
// This reduces the "Multiple GoTrueClient instances" warning
const SHARED_STORAGE_KEY = 'supabase.auth.token';

const sharedAuthConfig = {
  storage: AsyncStorage,
  storageKey: SHARED_STORAGE_KEY,
  autoRefreshToken: false, // We manage token refresh manually in AuthContext
  persistSession: true,
  detectSessionInUrl: false,
};

const shouldLogSupabase =
  // Dev builds (Expo / RN) always log
  __DEV__ ||
  // Optionally force logging in other builds via env
  process.env.EXPO_PUBLIC_ENABLE_SUPABASE_LOGS === 'true';

const redactUrl = (target: string): string => {
  try {
    const url = new URL(target);
    if (url.searchParams.has('apikey')) {
      url.searchParams.set('apikey', '[REDACTED]');
    }
    return url.toString();
  } catch {
    return target;
  }
};

const normalizeHeaders = (headers?: HeadersInit) => {
  if (!headers) return {};

  if (headers instanceof Headers) {
    return Array.from(headers.entries()).reduce<Record<string, string>>((acc, [key, value]) => {
      acc[key.toLowerCase()] = value;
      return acc;
    }, {});
  }

  if (Array.isArray(headers)) {
    return headers.reduce<Record<string, string>>((acc, [key, value]) => {
      acc[key.toLowerCase()] = value;
      return acc;
    }, {});
  }

  return Object.entries(headers).reduce<Record<string, string>>((acc, [key, value]) => {
    acc[key.toLowerCase()] = String(value);
    return acc;
  }, {});
};

const redactHeaders = (headers?: HeadersInit) => {
  const normalized = normalizeHeaders(headers);
  const sensitiveKeys = ['apikey', 'api-key', 'authorization', 'supabase-key'];

  return Object.fromEntries(
    Object.entries(normalized).map(([key, value]) => [
      key,
      sensitiveKeys.includes(key) ? '[REDACTED]' : value,
    ])
  );
};

const getRequestUrl = (input: RequestInfo | URL) => {
  if (typeof input === 'string') return input;
  if (input instanceof URL) return input.toString();
  if (input instanceof Request) return input.url;
  return String(input);
};

const getRequestMethod = (input: RequestInfo | URL, init?: RequestInit) => {
  if (init?.method) return init.method.toUpperCase();
  if (input instanceof Request) return input.method;
  return 'GET';
};

const getRequestBodyPreview = (body?: BodyInit | null) => {
  if (!body) return undefined;

  if (typeof body === 'string') {
    return body.slice(0, 500);
  }

  if (body instanceof FormData) {
    const entries: Record<string, string> = {};
    body.forEach((value, key) => {
      entries[key] = typeof value === 'string' ? value : '[BINARY]';
    });
    return JSON.stringify(entries).slice(0, 500);
  }

  return '[NON-STRING BODY]';
};

const getResponsePreview = async (response: Response) => {
  try {
    // Check if response body can be cloned
    // Clone can fail if body is already consumed or response is a redirect
    if (response.bodyUsed || response.type === 'opaque' || response.type === 'opaqueredirect') {
      return undefined;
    }

    // Try to clone - this can throw if body is already consumed
    let cloned: Response;
    try {
      cloned = response.clone();
    } catch (cloneError) {
      // Body is already consumed or can't be cloned
      return undefined;
    }

    const text = await cloned.text();

    if (!text) return undefined;
    return text.slice(0, 1000);
  } catch (error) {
    // Silently fail - logging is optional and shouldn't break the app
    return undefined;
  }
};

const loggingFetch: typeof fetch = async (input, init) => {
  if (!shouldLogSupabase) {
    return fetch(input as RequestInfo, init);
  }

  const method = getRequestMethod(input, init);
  const url = redactUrl(getRequestUrl(input));
  const headers = init?.headers ?? (input instanceof Request ? input.headers : undefined);
  const bodyPreview = getRequestBodyPreview(init?.body ?? null);

  console.log('[SUPABASE][Request]', {
    method,
    url,
    headers: redactHeaders(headers),
    bodyPreview,
  });

  try {
    // Instead of raw fetch, we use our enhanced apiFetch that handles token expiry and 401s automatically
    const response = await apiFetch(input, init);
    const preview = await getResponsePreview(response);

    const payload = {
      method,
      url,
      status: response.status,
      ok: response.ok,
      bodyPreview: preview,
    };

    if (response.ok) {
      console.log('[SUPABASE][Response]', payload);
    } else {
      console.error('[SUPABASE][ErrorResponse]', payload);
    }

    return response;
  } catch (error) {
    console.error('[SUPABASE][NetworkError]', { method, url, error });
    throw error;
  }
};

// Helper to manually set authorization header with custom JWT
// This ensures the token is used for database queries
export async function setAuthorizationToken(token: string) {
  try {
    // Create a session object with the custom token
    const session = {
      access_token: token,
      refresh_token: '',
      expires_at: Math.floor(Date.now() / 1000) + 3600,
      expires_in: 3600,
      token_type: 'bearer',
      user: { id: '', aud: 'authenticated', role: 'authenticated' }
    };

    // Set session on all clients
    await Promise.all([
      supabaseCore.auth.setSession(session as any),
      supabaseCms.auth.setSession(session as any),
      supabaseCrm.auth.setSession(session as any),
    ]);

    console.log('[SUPABASE] Authorization token set on all clients');
  } catch (error) {
    console.error('[SUPABASE] Failed to set authorization token:', error);
  }
}

const clientConfig = {
  auth: sharedAuthConfig,
  global: {
    headers: {
      'x-client-info': 'bmv-app',
    },
    fetch: loggingFetch,
  },
};

// Client for core schema (vendors, vendor_businesses, document_types, categories)
export const supabaseCore = createClient(supabaseUrl, supabaseAnonKey, {
  ...clientConfig,
  db: {
    schema: 'core',
  },
});

// Client for cms schema (file_storage, vendor_verification_documents, vendor_business_documents)
export const supabaseCms = createClient(supabaseUrl, supabaseAnonKey, {
  ...clientConfig,
  auth: {
    ...sharedAuthConfig,
    persistSession: false,
  },
  db: {
    schema: 'cms',
  },
});

// Client for crm schema (customer_leads, customer_reviews)
export const supabaseCrm = createClient(supabaseUrl, supabaseAnonKey, {
  ...clientConfig,
  auth: {
    ...sharedAuthConfig,
    persistSession: false,
  },
  db: {
    schema: 'crm',
  },
});

// Client for backoffice schema (if needed)
export const supabaseBackoffice = createClient(supabaseUrl, supabaseAnonKey, {
  ...clientConfig,
  auth: {
    ...sharedAuthConfig,
    persistSession: false,
  },
  db: {
    schema: 'backoffice',
  },
});

// Default export for backward compatibility (uses core schema)
export const supabase = supabaseCore;
