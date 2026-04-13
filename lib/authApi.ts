import { getAuthFunctionsBaseUrl, getApiBaseUrl } from './apiConfig';
import { getDeviceInfo } from './deviceInfo';
import { storeTokens, clearTokens } from './tokenStorage';
import { apiFetch } from './apiClient';
import { refreshAccessToken as coreRefreshAccessToken } from './refreshToken';
import type { RefreshTokenResponse, AuthError } from './refreshToken';

// RE-EXPORT TYPES FOR CONVENIENCE
export type { RefreshTokenResponse, AuthError };

// INTERNAL HELPERS
function ensureFullPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) return `+91${digits}`;
  if (digits.length === 12 && digits.startsWith('91')) return `+${digits}`;
  if (phone.startsWith('+')) return phone;
  return phone;
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

// ENDPOINTS

/**
 * 1. Refresh Access Token
 * Proxies to the low-level refresh logic in refreshToken.ts.
 * Requirement: { refreshToken: string } -> { accessToken: string; refreshToken?: string; expiresIn: number }
 */
export const refreshAccessToken = coreRefreshAccessToken;

export interface SendOTPResponse {
  success: boolean;
  expiresIn: number;
  retryAfter?: number;
}

/** Sends OTP to the provided phone number. */
export async function sendOTP(phone: string): Promise<{ data?: SendOTPResponse; error?: AuthError }> {
  try {
    const url = `${getAuthFunctionsBaseUrl()}auth-vendor-send-otp`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: ensureFullPhone(phone),
        deviceInfo: getDeviceInfo(),
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return { error: parseErrorResponse(data) };
    return { data: data as SendOTPResponse };
  } catch (err: any) {
    return {
      error: {
        code: 'NETWORK_ERROR',
        message: err?.message || 'Network error. Please check your connection.',
      },
    };
  }
}

/** Resends OTP to the provided phone number. */
export async function resendOTP(phone: string): Promise<{ data?: SendOTPResponse; error?: AuthError }> {
  try {
    const url = `${getAuthFunctionsBaseUrl()}auth-vendor-resend-otp`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: ensureFullPhone(phone) }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return { error: parseErrorResponse(data) };
    return { data: data as SendOTPResponse };
  } catch (err: any) {
    return {
      error: {
        code: 'NETWORK_ERROR',
        message: err?.message || 'Network error. Please check your connection.',
      },
    };
  }
}

export interface VerifyOTPResponse {
  success: boolean;
  newUser: boolean;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: {
    id: string;
    phone: string;
    created_at?: string;
    email?: string | null;
    first_name?: string | null;
    last_name?: string | null;
    app_metadata?: any;
    user_metadata?: any;
  };
}

/** Verifies OTP and stores tokens on success. */
export async function verifyOTP(
  phone: string,
  otp: string
): Promise<{ data?: VerifyOTPResponse; error?: AuthError }> {
  try {
    const url = `${getAuthFunctionsBaseUrl()}auth-vendor-verify-otp`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: ensureFullPhone(phone),
        otp,
        deviceInfo: getDeviceInfo(),
      }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return { error: parseErrorResponse(data) };
    const responseData = data as VerifyOTPResponse;
    await storeTokens({
      accessToken: responseData.accessToken,
      refreshToken: responseData.refreshToken,
      expiresIn: responseData.expiresIn,
    });
    return { data: responseData };
  } catch (err: any) {
    return {
      error: {
        code: 'NETWORK_ERROR',
        message: err?.message || 'Network error. Please check your connection.',
      },
    };
  }
}

/** 
 * 2. Sign Out
 * Requirement: auth-sign-out | Bearer (optional) | {} | 204 or 200
 */
export async function signOut(): Promise<{ success: boolean; error?: AuthError }> {
  try {
    // We use apiFetch so it automatically includes the Bearer token if available
    const response = await apiFetch(`${getAuthFunctionsBaseUrl()}auth-sign-out`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    });
    
    // Always clear tokens locally regardless of server response
    await clearTokens();
    
    if (!response.ok && response.status !== 401) {
       const data = await response.json().catch(() => ({}));
       return { success: false, error: parseErrorResponse(data) };
    }
    
    return { success: true };
  } catch (err: any) {
    // If sign-out fails due to network, we still clear local session
    await clearTokens();
    return { success: true }; 
  }
}

export interface AccountDeletionResponse {
  success: boolean;
  message?: string;
}

/** 
 * 3. Delete Account
 * Requirement: auth-vendor-delete-account | Bearer (vendor) | {} | { success: true, message?: string }
 */
export async function deleteAccount(): Promise<{ data?: AccountDeletionResponse; error?: AuthError }> {
  try {
    const url = `${getAuthFunctionsBaseUrl()}auth-vendor-delete-account`;
    const payload = {};

    console.log('[deleteAccount] Request URL:', url);
    console.log('[deleteAccount] Request Payload:', JSON.stringify(payload, null, 2));

    const response = await apiFetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data = await response.json().catch(() => ({}));

    console.log('[deleteAccount] Response Status:', response.status);
    console.log('[deleteAccount] Response Data:', JSON.stringify(data, null, 2));

    if (!response.ok) {
      return { error: parseErrorResponse(data) };
    }

    // Clear tokens after successful deletion
    await clearTokens();

    return { data: data as AccountDeletionResponse };
  } catch (err: any) {
    console.error('[deleteAccount] Error:', err);
    return {
      error: {
        code: 'NETWORK_ERROR',
        message: err?.message || 'Network error. Please try again.',
      },
    };
  }
}

/** Dev-only sign in helper (not for production). */
export async function devSignIn(phone: string): Promise<{ data?: VerifyOTPResponse; error?: AuthError }> {
  try {
    const url = `${getApiBaseUrl()}/auth/dev-sign-in`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: ensureFullPhone(phone) }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return { error: parseErrorResponse(data) };
    const responseData = data as VerifyOTPResponse;
    await storeTokens({
      accessToken: responseData.accessToken,
      refreshToken: responseData.refreshToken,
      expiresIn: responseData.expiresIn,
    });
    return { data: responseData };
  } catch (err: any) {
    return {
      error: {
        code: 'NETWORK_ERROR',
        message: err?.message || 'Network error. Please check your connection.',
      },
    };
  }
}
