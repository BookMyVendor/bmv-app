/**
 * Supabase client has been removed. App uses REST API (lib/api/*) and AuthContext with token-based auth.
 * Supabase Edge Functions (supabase/functions) still use Supabase server-side.
 */

// Stub exports so any stray imports fail explicitly instead of at runtime.
export const supabaseCore = null as never;
export const supabaseCms = null as never;
export const supabaseCrm = null as never;
export const supabaseBackoffice = null as never;
export const supabase = null as never;

export async function setAuthorizationToken(_token: string) {
  // No-op: auth is handled by AuthContext + apiClient (Bearer token).
}
