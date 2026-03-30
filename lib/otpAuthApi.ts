import { getAuthFunctionsBaseUrl, getApiBaseUrl } from './apiConfig';
import { getDeviceInfo } from './deviceInfo';
import { storeTokens, getRefreshToken, clearTokens } from './tokenStorage';

export interface SendOTPRequest {
  phone: string;
  deviceInfo: { deviceType: string; os: string; appVersion: string };
}

export interface SendOTPResponse {
  success: boolean;
  expiresIn: number;
  retryAfter?: number;
}

export interface ResendOTPResponse {
  success: boolean;
  expiresIn: number;
  retryAfter?: number;
}

export interface VerifyOTPRequest {
  phone: string;
  otp: string;
  deviceInfo: { deviceType: string; os: string; appVersion: string };
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
    email_confirmed_at?: string;
    phone_confirmed_at?: string;
    app_metadata?: any;
    user_metadata?: any;
  };
}

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

export async function sendOTP(phone: string): Promise<{ data?: SendOTPResponse; error?: AuthError }> {
  try {
    const url = `${getAuthFunctionsBaseUrl()}/auth-vendor-send-otp`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: ensureFullPhone(phone),
        deviceInfo: getDeviceInfo(),
      } as SendOTPRequest),
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

export async function resendOTP(phone: string): Promise<{ data?: ResendOTPResponse; error?: AuthError }> {
  try {
    const url = `${getAuthFunctionsBaseUrl()}/auth-vendor-resend-otp`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: ensureFullPhone(phone) }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return { error: parseErrorResponse(data) };
    return { data: data as ResendOTPResponse };
  } catch (err: any) {
    return {
      error: {
        code: 'NETWORK_ERROR',
        message: err?.message || 'Network error. Please check your connection.',
      },
    };
  }
}

export async function verifyOTP(
  phone: string,
  otp: string
): Promise<{ data?: VerifyOTPResponse; error?: AuthError }> {
  try {
    const url = `${getAuthFunctionsBaseUrl()}/auth-vendor-verify-otp`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        phone: ensureFullPhone(phone),
        otp,
        deviceInfo: getDeviceInfo(),
      } as VerifyOTPRequest),
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

let isRefreshing = false;
let refreshPromise: Promise<{ data?: RefreshTokenResponse; error?: AuthError }> | null = null;

export async function refreshAccessToken(): Promise<{ data?: RefreshTokenResponse; error?: AuthError }> {
  if (isRefreshing && refreshPromise) return refreshPromise;
  isRefreshing = true;
  refreshPromise = (async () => {
    try {
      const refreshToken = await getRefreshToken();
      if (!refreshToken) {
        return { error: { code: 'NO_REFRESH_TOKEN', message: 'No refresh token available' } };
      }
      const url = `${getAuthFunctionsBaseUrl()}/auth-refresh-token`;
      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken } as RefreshTokenRequest),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) {
        if (response.status >= 400 && response.status < 500) await clearTokens();
        return { error: parseErrorResponse(data) };
      }
      const responseData = data as RefreshTokenResponse;
      const newRefreshToken = responseData.refreshToken || refreshToken;
      await storeTokens({
        accessToken: responseData.accessToken,
        refreshToken: newRefreshToken,
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
    } finally {
      isRefreshing = false;
      refreshPromise = null;
    }
  })();
  return refreshPromise;
}

export interface DevSignInResponse {
  success: boolean;
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  user: VerifyOTPResponse['user'];
}

/** Dev-only: not in API spec; uses backend route if available. */
export async function devSignIn(phone: string): Promise<{ data?: DevSignInResponse; error?: AuthError }> {
  try {
    const url = `${getApiBaseUrl()}/auth/dev-sign-in`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone: ensureFullPhone(phone) }),
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) return { error: parseErrorResponse(data) };
    const responseData = data as DevSignInResponse;
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
