import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import Constants from 'expo-constants';
import 'react-native-url-polyfill/auto';

const expoExtra = Constants?.expoConfig?.extra ?? (Constants as any)?.manifest?.extra ?? {};

const supabaseUrl =
  process.env.EXPO_PUBLIC_SUPABASE_URL ?? (expoExtra?.supabaseUrl as string | undefined);
const supabaseAnonKey =
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY ??
  (expoExtra?.supabaseAnonKey as string | undefined);

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase configuration. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY env vars or populate expo.extra.supabase* in app config.'
  );
}

const redactUrl = (target: string): string => {
  try {
    const parsed = new URL(target);
    if (parsed.searchParams.has('apikey')) {
      parsed.searchParams.set('apikey', '[REDACTED]');
    }
    return parsed.toString();
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
    acc[key.toLowerCase()] = value as string;
    return acc;
  }, {});
};

const redactHeaders = (headers?: HeadersInit) => {
  const normalized = normalizeHeaders(headers);
  const sensitiveKeys = ['apikey', 'api-key', 'authorization', 'supabase-key'];
  const redacted: Record<string, string> = {};

  Object.entries(normalized).forEach(([key, value]) => {
    redacted[key] = sensitiveKeys.includes(key) ? '[REDACTED]' : value;
  });

  return redacted;
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
  if (typeof body === 'string') return body.slice(0, 500);
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
    const cloned = response.clone();
    const text = await cloned.text();
    if (!text) return undefined;
    return text.slice(0, 1000);
  } catch {
    return undefined;
  }
};

const loggingFetch: typeof fetch = async (input, init) => {
  const method = getRequestMethod(input, init);
  const url = redactUrl(getRequestUrl(input));
  const headers = init?.headers ?? (input instanceof Request ? input.headers : undefined);
  const bodyPreview = getRequestBodyPreview(init?.body);

  console.log('[Supabase][Request]', { method, url, headers: redactHeaders(headers), bodyPreview });

  try {
    const response = await fetch(input as RequestInfo, init);
    const preview = await getResponsePreview(response);

    const logPayload = {
      method,
      url,
      status: response.status,
      ok: response.ok,
      bodyPreview: preview,
    };

    if (response.ok) {
      console.log('[Supabase][Response]', logPayload);
    } else {
      console.error('[Supabase][ErrorResponse]', logPayload);
    }

    return response;
  } catch (error) {
    console.error('[Supabase][NetworkError]', { method, url, error });
    throw error;
  }
};

// Use a single shared storage key for all clients to ensure they share the same auth session
// This reduces the "Multiple GoTrueClient instances" warning
const SHARED_STORAGE_KEY = 'supabase.auth.token';

const sharedAuthConfig = {
  storage: AsyncStorage,
  storageKey: SHARED_STORAGE_KEY,
  autoRefreshToken: true,
  persistSession: true,
  detectSessionInUrl: false,
};

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
  db: {
    schema: 'cms',
  },
});

// Client for crm schema (customer_leads, customer_reviews)
export const supabaseCrm = createClient(supabaseUrl, supabaseAnonKey, {
  ...clientConfig,
  db: {
    schema: 'crm',
  },
});

// Client for backoffice schema (if needed)
export const supabaseBackoffice = createClient(supabaseUrl, supabaseAnonKey, {
  ...clientConfig,
  db: {
    schema: 'backoffice',
  },
});

// Default export for backward compatibility (uses core schema)
export const supabase = supabaseCore;
