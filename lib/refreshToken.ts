import { getAuthFunctionsBaseUrl } from './apiConfig';
import { storeTokens, getRefreshToken, clearTokens } from './tokenStorage';

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface RefreshTokenResponse {
  success: boolean;
  accessToken: string;
  expiresIn: number;
  refreshToken?: string;
}

export interface AuthError {
  code: string;
  message: string;
  retryAfter?: number;
}

function parseErrorResponse(data: any): AuthError {
  const message =
    (typeof data?.error === 'string' ? data.error : null) ||
    data?.message ||
    data?.error?.message ||
    'An error occurred';
  const code = data?.code ?? data?.error?.code ?? 'UNKNOWN_ERROR';
  const retryAfter = data?.retryAfter ?? data?.error?.retryAfter;
  return { code, message, retryAfter };
}

let isRefreshing = false;
let refreshPromise: Promise<{ data?: RefreshTokenResponse; error?: AuthError }> | null = null;

/**
 * Low-level token refresh logic to avoid circular dependencies with apiClient.
 */
export async function refreshAccessToken(): Promise<{ data?: RefreshTokenResponse; error?: AuthError }> {
  if (isRefreshing && refreshPromise) return refreshPromise;
  
  isRefreshing = true;
  refreshPromise = (async () => {
    try {
      const refreshToken = await getRefreshToken();
      if (!refreshToken) {
        return { error: { code: 'NO_REFRESH_TOKEN', message: 'No refresh token available' } };
      }

      const url = `${getAuthFunctionsBaseUrl()}auth-refresh-token`;
      
      console.log('[REFRESH] 🔄 Refreshing access token...');
      console.log('[REFRESH] URL:', url);
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken } as RefreshTokenRequest),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        console.error('[REFRESH] ❌ Refresh failed:', data);
        // If it's a 4xx error (except 429), it means the refresh token is likely invalid/expired
        if (response.status >= 400 && response.status < 500 && response.status !== 429) {
          await clearTokens();
        }
        return { error: parseErrorResponse(data) };
      }

      const responseData = data as RefreshTokenResponse;
      const newRefreshToken = responseData.refreshToken || refreshToken;

      await storeTokens({
        accessToken: responseData.accessToken,
        refreshToken: newRefreshToken,
        expiresIn: responseData.expiresIn,
      });

      console.log('[REFRESH] ✅ Token refreshed successfully');
      return { data: responseData };
    } catch (err: any) {
      console.error('[REFRESH] ❌ Network error during refresh:', err);
      return {
        error: {
          code: 'NETWORK_ERROR',
          message: err?.message || 'Network error. Please check your connection.',
        },
      };
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();

  return refreshPromise;
}
