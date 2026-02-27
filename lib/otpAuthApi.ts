import { supabaseUrl } from './supabaseConfig';
import { getDeviceInfo } from './deviceInfo';
import { storeTokens, getRefreshToken, clearTokens } from './tokenStorage';

export interface SendOTPRequest {
  phone: string;
  deviceInfo: {
    deviceType: string;
    os: string;
    appVersion: string;
  };
}

export interface SendOTPResponse {
  success: boolean;
  expiresIn: number; // seconds
  retryAfter?: number; // seconds (for rate limiting)
}

export interface ResendOTPResponse {
  success: boolean;
  expiresIn: number; // seconds
  retryAfter?: number; // seconds (for rate limiting)
}

export interface VerifyOTPRequest {
  phone: string;
  otp: string;
  deviceInfo: {
    deviceType: string;
    os: string;
    appVersion: string;
  };
}

export interface VerifyOTPResponse {
  success: boolean;
  newUser: boolean;
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // seconds
  user: {
    id: string;
    phone: string;
    created_at?: string;
    email?: string | null;
    email_confirmed_at?: string;
    phone_confirmed_at?: string;
    app_metadata?: any;
    user_metadata?: any;
    // NOTE: Detailed profile data (first_name, last_name, image_file_id, etc.)
    // should be fetched by dashboard/profile pages, not during auth
    // This keeps authentication focused and simple
  };
}

export interface RefreshTokenRequest {
  refreshToken: string;
}

export interface RefreshTokenResponse {
  success: boolean;
  accessToken: string;
  expiresIn: number; // seconds
  refreshToken?: string; // New refresh token (if rotated)
}

export interface AuthError {
  code: string;
  message: string;
  retryAfter?: number; // seconds
}

/**
 * Extract project reference from Supabase URL
 */
function getProjectRef(): string {
  try {
    const url = new URL(supabaseUrl);
    // URL format: https://{project-ref}.supabase.co
    const hostname = url.hostname;
    const parts = hostname.split('.');
    if (parts.length >= 2 && parts[1] === 'supabase') {
      return parts[0];
    }
    throw new Error('Invalid Supabase URL format');
  } catch (error) {
    console.error('Error extracting project ref:', error);
    throw new Error('Failed to extract project reference from Supabase URL');
  }
}

/**
 * Ensure phone number is in +91XXXXXXXXXX format
 */
function ensureFullPhone(phone: string): string {
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) {
    return `+91${digits}`;
  }
  if (digits.length === 12 && digits.startsWith('91')) {
    return `+${digits}`;
  }
  if (phone.startsWith('+')) {
    return phone;
  }
  return phone;
}

/**
 * Parse error response from API
 */
function parseErrorResponse(response: Response, data: any): AuthError {
  const errorCode = data?.code || data?.error?.code || 'UNKNOWN_ERROR';
  const errorMessage = data?.message || data?.error?.message || data?.error || 'An error occurred';
  const retryAfter = data?.retryAfter || data?.error?.retryAfter;

  // Map common error codes
  const errorMap: Record<string, string> = {
    RATE_LIMIT: 'RATE_LIMIT',
    OTP_EXPIRED: 'OTP_EXPIRED',
    OTP_NOT_FOUND: 'OTP_NOT_FOUND',
    MAX_ATTEMPTS_EXCEEDED: 'MAX_ATTEMPTS_EXCEEDED',
    INVALID_OTP: 'INVALID_OTP',
    NETWORK_ERROR: 'NETWORK_ERROR',
  };

  return {
    code: errorMap[errorCode] || errorCode,
    message: errorMessage,
    retryAfter,
  };
}

/**
 * Send OTP to phone number
 */
export async function sendOTP(phone: string): Promise<{ data?: SendOTPResponse; error?: AuthError }> {
  try {
    const projectRef = getProjectRef();
    const url = `https://${projectRef}.supabase.co/functions/v1/auth-vendor-send-otp`;
    const deviceInfo = getDeviceInfo();

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        phone: ensureFullPhone(phone),
        deviceInfo,
      } as SendOTPRequest),
    });

    const data = await response.json();

    if (!response.ok) {
      return { error: parseErrorResponse(response, data) };
    }

    return { data: data as SendOTPResponse };
  } catch (error: any) {
    console.error('Error sending OTP:', error);
    return {
      error: {
        code: 'NETWORK_ERROR',
        message: error.message || 'Network error. Please check your connection.',
      },
    };
  }
}

/**
 * Resend OTP to phone number
 */
export async function resendOTP(phone: string): Promise<{ data?: ResendOTPResponse; error?: AuthError }> {
  try {
    const projectRef = getProjectRef();
    const url = `https://${projectRef}.supabase.co/functions/v1/auth-vendor-resend-otp`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        phone: ensureFullPhone(phone),
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return { error: parseErrorResponse(response, data) };
    }

    return { data: data as ResendOTPResponse };
  } catch (error: any) {
    console.error('Error resending OTP:', error);
    return {
      error: {
        code: 'NETWORK_ERROR',
        message: error.message || 'Network error. Please check your connection.',
      },
    };
  }
}

/**
 * Verify OTP code
 */
export async function verifyOTP(
  phone: string,
  otp: string
): Promise<{ data?: VerifyOTPResponse; error?: AuthError }> {
  try {
    const projectRef = getProjectRef();
    const url = `https://${projectRef}.supabase.co/functions/v1/auth-vendor-verify-otp`;
    const deviceInfo = getDeviceInfo();

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        phone: ensureFullPhone(phone),
        otp,
        deviceInfo,
      } as VerifyOTPRequest),
    });

    const data = await response.json();

    if (!response.ok) {
      return { error: parseErrorResponse(response, data) };
    }

    const responseData = data as VerifyOTPResponse;

    // Store tokens securely
    await storeTokens({
      accessToken: responseData.accessToken,
      refreshToken: responseData.refreshToken,
      expiresIn: responseData.expiresIn,
    });

    return { data: responseData };
  } catch (error: any) {
    console.error('Error verifying OTP:', error);
    return {
      error: {
        code: 'NETWORK_ERROR',
        message: error.message || 'Network error. Please check your connection.',
      },
    };
  }
}

let isRefreshing = false;
let refreshPromise: Promise<{ data?: RefreshTokenResponse; error?: AuthError }> | null = null;

/**
 * Refresh access token using refresh token
 */
export async function refreshAccessToken(): Promise<{ data?: RefreshTokenResponse; error?: AuthError }> {
  // Concurrency lock to prevent multiple API calls triggering simultaneous refreshes
  if (isRefreshing && refreshPromise) {
    console.log('[AUTH] Token refresh already in progress. Waiting for result...');
    return refreshPromise;
  }

  isRefreshing = true;
  refreshPromise = (async () => {
    try {
      const refreshToken = await getRefreshToken();
    if (!refreshToken) {
      return {
        error: {
          code: 'NO_REFRESH_TOKEN',
          message: 'No refresh token available',
        },
      };
    }

    const projectRef = getProjectRef();
    const url = `https://${projectRef}.supabase.co/functions/v1/auth-refresh-token`;

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        refreshToken,
      } as RefreshTokenRequest),
    });

    const data = await response.json();

    if (!response.ok) {
      // Only clear tokens for client errors (4xx), meaning the token is invalid
      // For server errors (5xx), keep tokens to retry later
      if (response.status >= 400 && response.status < 500) {
        console.log('[AUTH] Refresh token rejected (4xx), clearing tokens');
        await clearTokens();
      }
      return { error: parseErrorResponse(response, data) };
    }

    const responseData = data as RefreshTokenResponse;

    // Update stored tokens
    // IMPORTANT: If the server returns a new refresh token (Token Rotation), we MUST store it
    // effectively replacing the old one. If not returned, we keep the old one.
    const newRefreshToken = responseData.refreshToken || refreshToken;

    await storeTokens({
      accessToken: responseData.accessToken,
      refreshToken: newRefreshToken,
      expiresIn: responseData.expiresIn,
    });

    return { data: responseData };
  } catch (error: any) {
    console.error('Error refreshing token:', error);
    return {
      error: {
        code: 'NETWORK_ERROR',
        message: error.message || 'Network error. Please check your connection.',
      },
    };
  } finally {
    isRefreshing = false;
    refreshPromise = null;
  }
  })();

  return refreshPromise;
}

