/**
 * API base URL for REST backend. Configure via EXPO_PUBLIC_API_URL (e.g. http://localhost:3000 or https://api.example.com).
 */
export function getApiBaseUrl(): string {
  const url = process.env.EXPO_PUBLIC_API_URL;
  if (url) {
    return url.replace(/\/$/, '');
  }
  // Fallback for dev: assume same host with port 3000 if not set
  if (__DEV__ && typeof window !== 'undefined') {
    const origin = window.location?.origin;
    if (origin) {
      try {
        const u = new URL(origin);
        return `${u.protocol}//${u.hostname}:3000`;
      } catch {
        return 'http://localhost:3000';
      }
    }
  }
  return 'http://localhost:3000';
}

/** Base URL for all Edge Functions (auth + vendor-me-get, vendor-businesses-*, etc.). Uses EXPO_PUBLIC_API_URL only (host:port), not Supabase. */
export function getAuthFunctionsBaseUrl(): string {
  return getApiBaseUrl() + '/functions/v1/';
}
