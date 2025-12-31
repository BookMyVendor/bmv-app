import { Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';

/**
 * Storage keys
 */
const ACCESS_TOKEN_KEY = 'auth_access_token';
const REFRESH_TOKEN_KEY = 'auth_refresh_token';
const TOKEN_EXPIRY_KEY = 'auth_token_expiry';

/**
 * Token interface
 */
export interface TokenData {
  accessToken: string;
  refreshToken: string;
  expiresIn: number; // seconds
}

/**
 * Platform-safe storage helpers
 */
const isWeb = Platform.OS === 'web';

async function setItem(key: string, value: string): Promise<void> {
  if (isWeb) {
    localStorage.setItem(key, value);
  } else {
    await SecureStore.setItemAsync(key, value);
  }
}

async function getItem(key: string): Promise<string | null> {
  if (isWeb) {
    return localStorage.getItem(key);
  }
  return await SecureStore.getItemAsync(key);
}

async function deleteItem(key: string): Promise<void> {
  if (isWeb) {
    localStorage.removeItem(key);
  } else {
    await SecureStore.deleteItemAsync(key);
  }
}

/**
 * Store tokens securely
 */
export async function storeTokens(data: TokenData): Promise<void> {
  try {
    const expiryTimestamp = Date.now() + data.expiresIn * 1000;

    await Promise.all([
      setItem(ACCESS_TOKEN_KEY, data.accessToken),
      setItem(REFRESH_TOKEN_KEY, data.refreshToken),
      setItem(TOKEN_EXPIRY_KEY, expiryTimestamp.toString()),
    ]);
  } catch (error) {
    console.error('Error storing tokens:', error);
    throw error;
  }
}

/**
 * Get access token
 */
export async function getAccessToken(): Promise<string | null> {
  try {
    return await getItem(ACCESS_TOKEN_KEY);
  } catch {
    return null;
  }
}

/**
 * Get refresh token
 */
export async function getRefreshToken(): Promise<string | null> {
  try {
    return await getItem(REFRESH_TOKEN_KEY);
  } catch {
    return null;
  }
}

/**
 * Get token expiry timestamp
 */
export async function getTokenExpiry(): Promise<number | null> {
  try {
    const expiry = await getItem(TOKEN_EXPIRY_KEY);
    return expiry ? parseInt(expiry, 10) : null;
  } catch {
    return null;
  }
}

/**
 * Check if token is expired or expiring soon (within 5 minutes)
 */
export async function isTokenExpiredOrExpiringSoon(): Promise<boolean> {
  try {
    const expiry = await getTokenExpiry();
    if (!expiry) return true;

    const now = Date.now();
    const buffer = 5 * 60 * 1000; // 5 mins

    return expiry <= now + buffer;
  } catch {
    return true;
  }
}

/**
 * Clear all stored tokens
 */
export async function clearTokens(): Promise<void> {
  try {
    await Promise.all([
      deleteItem(ACCESS_TOKEN_KEY),
      deleteItem(REFRESH_TOKEN_KEY),
      deleteItem(TOKEN_EXPIRY_KEY),
    ]);
  } catch (error) {
    console.error('Error clearing tokens:', error);
  }
}

/**
 * Check if any token exists
 */
export async function hasTokens(): Promise<boolean> {
  try {
    const token = await getAccessToken();
    return !!token;
  } catch {
    return false;
  }
}

/**
 * Debug helper (optional)
 */
export function isWebPlatform(): boolean {
  return isWeb;
}
