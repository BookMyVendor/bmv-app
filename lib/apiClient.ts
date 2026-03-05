import { getAccessToken, isTokenExpiredOrExpiringSoon, clearTokens } from './tokenStorage';
import { refreshAccessToken } from './otpAuthApi';

/**
 * Enhanced fetch with automatic token refresh and retry on 401
 */
export async function apiFetch(
  input: RequestInfo | URL,
  options: RequestInit = {}
): Promise<Response> {
  // Get access token
  let accessToken = await getAccessToken();

  // Check if token needs refresh (expired or expiring soon)
  if (accessToken && (await isTokenExpiredOrExpiringSoon())) {
    console.log('[API] Token expired or expiring soon, refreshing...');
    const refreshResult = await refreshAccessToken();
    if (refreshResult.data) {
      accessToken = refreshResult.data.accessToken;
    } else {
      // Refresh failed, clear tokens
      await clearTokens();
      throw new Error('Token refresh failed. Please login again.');
    }
  }

  // Add Authorization header if we have a token
  const headers = new Headers(options.headers);
  if (accessToken) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  // Make the request using input instead of string url
  let response = await fetch(input, {
    ...options,
    headers,
  });

  // If 401, try to refresh token once and retry
  if (response.status === 401 && accessToken) {
    console.log('[API] Got 401, attempting token refresh...');
    const refreshResult = await refreshAccessToken();

    if (refreshResult.data) {
      // Retry with new token
      headers.set('Authorization', `Bearer ${refreshResult.data.accessToken}`);
      response = await fetch(input, {
        ...options,
        headers,
      });
    } else {
      // Refresh failed, clear tokens
      await clearTokens();
      throw new Error('Authentication failed. Please login again.');
    }
  }

  return response;
}

/**
 * Make authenticated API call with JSON response
 */
export async function apiCall<T>(
  url: string,
  options: RequestInit = {}
): Promise<{ data?: T; error?: { code: string; message: string } }> {
  try {
    const response = await apiFetch(url, {
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    });

    const data = await response.json();

    if (!response.ok) {
      return {
        error: {
          code: data?.code || `HTTP_${response.status}`,
          message: data?.message || data?.error || `HTTP ${response.status}: ${response.statusText}`,
        },
      };
    }

    return { data };
  } catch (error: any) {
    console.error('API call error:', error);
    return {
      error: {
        code: 'NETWORK_ERROR',
        message: error.message || 'Network error. Please check your connection.',
      },
    };
  }
}

