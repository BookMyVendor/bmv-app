import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';
import 'react-native-url-polyfill/auto';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

const clientConfig = {
  auth: {
    storage: AsyncStorage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
  },
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
