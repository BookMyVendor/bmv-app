import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';

export const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

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
