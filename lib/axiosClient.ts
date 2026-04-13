import axios, { 
  AxiosInstance, 
  AxiosRequestConfig, 
  AxiosResponse, 
  AxiosError,
  InternalAxiosRequestConfig 
} from 'axios';
import { getAccessToken, isTokenExpiredOrExpiringSoon, clearTokens } from './tokenStorage';
import { refreshAccessToken } from './refreshToken';
import { getApiBaseUrl, getAuthFunctionsBaseUrl } from './apiConfig';
import { triggerAuthFailure } from './authFailure';

export interface ApiError {
  success: false;
  error: string;
  code?: string;
  retryAfter?: number;
}

/**
 * Logging configuration - can be disabled in production if needed
 */
const API_LOGGING_ENABLED = __DEV__;

/**
 * Format bytes to human readable string
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Calculate size of an object (approximate)
 */
function approximateSize(obj: any): number {
  if (!obj) return 0;
  try {
    const json = typeof obj === 'string' ? obj : JSON.stringify(obj);
    return new TextEncoder().encode(json).length;
  } catch {
    return 0;
  }
}

/**
 * Log request details
 */
function logRequest(config: InternalAxiosRequestConfig | { method: string; url: string; headers: any; data?: any }): void {
  if (!API_LOGGING_ENABLED) return;

  const timestamp = new Date().toISOString();
  const method = config.method?.toUpperCase() || 'GET';
  const url = 'url' in config ? config.url : (config as InternalAxiosRequestConfig).url || '';
  const baseURL = 'baseURL' in config ? (config as any).baseURL : (config as InternalAxiosRequestConfig).baseURL || '';
  
  // Robust URL joining for logs
  let fullUrl = url;
  if (baseURL && !url.startsWith('http')) {
    const base = baseURL.endsWith('/') ? baseURL : `${baseURL}/`;
    const path = url.startsWith('/') ? url.slice(1) : url;
    fullUrl = `${base}${path}`;
  }
  
  const data = 'data' in config ? config.data : (config as InternalAxiosRequestConfig).data;
  const dataSize = data ? formatBytes(approximateSize(data)) : '0 B';

  console.groupCollapsed(`📡 [API Request] ${method} ${url}`);
  console.info(`Full URL: ${fullUrl}`);
  console.info(`Timestamp: ${timestamp}`);
  console.log('Headers:', config.headers);
  if (data) {
    console.log('Payload:', data);
    console.log(`Payload Size: ${dataSize}`);
  }
  console.groupEnd();
}

/**
 * Log response details
 */
function logResponse(response: AxiosResponse): void {
  if (!API_LOGGING_ENABLED) return;

  const timestamp = new Date().toISOString();
  const status = response.status;
  const statusText = response.statusText;
  const method = response.config.method?.toUpperCase() || 'GET';
  const url = response.config.url || '';
  const baseURL = response.config.baseURL || '';
  
  // Robust URL joining for logs
  let fullUrl = url;
  if (baseURL && !url.startsWith('http')) {
    const base = baseURL.endsWith('/') ? baseURL : `${baseURL}/`;
    const path = url.startsWith('/') ? url.slice(1) : url;
    fullUrl = `${base}${path}`;
  }
  
  const duration = response.headers['x-response-time'] || 'N/A';
  const dataSize = response.data ? formatBytes(approximateSize(response.data)) : '0 B';

  const isSuccess = status >= 200 && status < 300;
  const emoji = isSuccess ? '✅' : '⚠️';
  const logFn = isSuccess ? console.info : console.warn;

  console.groupCollapsed(`${emoji} [API Response] ${status} ${method} ${url}`);
  logFn(`Full URL: ${fullUrl}`);
  logFn(`Status: ${status} ${statusText}`);
  if (duration !== 'N/A') {
    console.log(`Duration: ${duration}ms`);
  }
  console.log('Response Data:', response.data);
  console.log(`Response Size: ${dataSize}`);
  console.groupEnd();
}

/**
 * Log error details
 */
function logError(error: AxiosError | any, config?: any): void {
  if (!API_LOGGING_ENABLED) return;

  const timestamp = new Date().toISOString();
  const axiosConfig = config || error.config;
  const method = axiosConfig?.method?.toUpperCase() || 'UNKNOWN';
  const url = axiosConfig?.url || 'UNKNOWN';
  const baseURL = axiosConfig?.baseURL || '';
  
  // Robust URL joining for logs
  let fullUrl = url;
  if (baseURL && url !== 'UNKNOWN' && !url.startsWith('http')) {
    const base = baseURL.endsWith('/') ? baseURL : `${baseURL}/`;
    const path = url.startsWith('/') ? url.slice(1) : url;
    fullUrl = `${base}${path}`;
  }

  console.group(`❌ [API Error] ${method} ${url}`);
  console.error(`Timestamp: ${timestamp}`);
  console.error(`Full URL: ${fullUrl}`);

  if (error.response) {
    // Server responded with error status
    console.error('Status:', error.response.status, error.response.statusText);
    console.error('Response Data:', error.response.data);
  } else if (error.request) {
    // Request was made but no response
    console.error('No response received (Network Error / Timeout)');
  } else {
    // Something happened in setting up the request
    console.error('Error Message:', error.message || error);
  }

  // Log the request that caused the error for easier debugging
  if (axiosConfig) {
    console.groupCollapsed('Request Details');
    console.log('Headers:', axiosConfig.headers);
    if (axiosConfig.data) {
      console.log('Payload:', axiosConfig.data);
    }
    console.groupEnd();
  }

  console.groupEnd();
}

/**
 * Create Axios instance with logging interceptors
 */
function createAxiosInstance(baseURL?: string): AxiosInstance {
  const instance = axios.create({
    baseURL: baseURL || getApiBaseUrl(),
    timeout: 30000, // 30 seconds timeout
    headers: {
      'Content-Type': 'application/json',
    },
  });

  // Request interceptor for logging and adding auth token
  instance.interceptors.request.use(
    async (config: InternalAxiosRequestConfig) => {
      // Log the request
      logRequest(config);

      // Add authorization token if available
      let accessToken = await getAccessToken();

      // Check if token is expired or expiring soon and refresh if needed
      if (accessToken && (await isTokenExpiredOrExpiringSoon())) {
        const refreshResult = await refreshAccessToken();
        if (refreshResult.data) {
          accessToken = refreshResult.data.accessToken;
        } else {
          await clearTokens();
          triggerAuthFailure();
          throw new Error('Token refresh failed. Please login again.');
        }
      }

      if (accessToken) {
        config.headers.Authorization = `Bearer ${accessToken}`;
      }

      return config;
    },
    (error: AxiosError) => {
      logError(error);
      return Promise.reject(error);
    }
  );

  // Response interceptor for logging
  instance.interceptors.response.use(
    (response: AxiosResponse) => {
      logResponse(response);
      return response;
    },
    async (error: AxiosError) => {
      logError(error);

      // Handle 401 - Unauthorized (token might be invalid)
      if (error.response?.status === 401) {
        const originalRequest = error.config;

        // Prevent infinite retry loop
        if (originalRequest && !(originalRequest as any)._retry) {
          (originalRequest as any)._retry = true;

          try {
            const refreshResult = await refreshAccessToken();
            if (refreshResult.data) {
              const newAccessToken = refreshResult.data.accessToken;
              if (originalRequest?.headers) {
                originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
              }
              return axios(originalRequest);
            }
          } catch (refreshError) {
            await clearTokens();
            triggerAuthFailure();
            return Promise.reject(refreshError);
          }
        } else {
          // Already retried or no original request - clear tokens and trigger auth failure
          await clearTokens();
          triggerAuthFailure();
        }
      }

      return Promise.reject(error);
    }
  );

  return instance;
}

// Create default instances
export const apiAxios = createAxiosInstance(getApiBaseUrl());
export const functionsAxios = createAxiosInstance(getAuthFunctionsBaseUrl());

/**
 * Enhanced Axios-based API call with JSON response.
 * Returns errors in contract: { success: false, error: string, code?: string, retryAfter?: number }.
 */
export async function axiosApiCall<T>(
  url: string,
  options: AxiosRequestConfig = {}
): Promise<{ data?: T; error?: ApiError }> {
  try {
    const response = await apiAxios.request({
      url,
      ...options,
      headers: {
        'Content-Type': 'application/json',
        ...(options.headers as Record<string, string>),
      },
    });

    return { data: response.data as T };
  } catch (err: any) {
    if (err.response?.status === 404) {
      console.warn(`[API] 404 Not Found (non-blocking): axiosApiCall ${url}`, url);
      return { data: undefined, error: undefined };
    }

    const error: ApiError = {
      success: false,
      error: err?.response?.data?.error || err?.response?.data?.message || err?.message || 'Network error. Please check your connection.',
      code: err?.response?.data?.code || err?.response?.data?.error?.code || `HTTP_${err?.response?.status || 'NETWORK_ERROR'}`,
      retryAfter: err?.response?.data?.retryAfter || err?.response?.data?.error?.retryAfter,
    };

    return { error };
  }
}

/**
 * Call Edge Function using Axios with logging.
 * Spec success responses are { success: true, [key]: value }. Use responseKey to unwrap.
 */
export async function axiosFunctionsCall<T = any>(
  functionName: string,
  body: Record<string, unknown>,
  responseKey?: string
): Promise<{ data?: T; error?: ApiError }> {
  try {
    const response = await functionsAxios.post(functionName, body);
    const payload = response.data;

    console.log(`[axiosFunctionsCall][${functionName}] DEBUG - Raw response:`, {
      responseKey,
      payloadType: typeof payload,
      isArray: Array.isArray(payload),
      payloadKeys: payload && typeof payload === 'object' ? Object.keys(payload) : null,
      payload,
    });

    let unwrapped = payload;
    if (responseKey && payload && typeof payload === 'object' && !Array.isArray(payload)) {
      if ((payload as any)[responseKey] !== undefined) {
        unwrapped = (payload as any)[responseKey];
      } else if ((payload as any).data !== undefined) {
        unwrapped = (payload as any).data;
      } else if ((payload as any).items !== undefined) {
        unwrapped = (payload as any).items;
      } else if ((payload as any).success !== undefined) {
        // Fallback: look for ANY array in the payload if the primary key is missing
        const firstArray = Object.values(payload).find(v => Array.isArray(v));
        if (firstArray !== undefined) {
          unwrapped = firstArray;
        } else {
          unwrapped = undefined;
        }
      }
    }

    console.log(`[axiosFunctionsCall][${functionName}] DEBUG - Unwrapped data:`, {
      unwrappedType: typeof unwrapped,
      isArray: Array.isArray(unwrapped),
      length: Array.isArray(unwrapped) ? unwrapped.length : null,
    });

    return { data: unwrapped as T };
  } catch (err: any) {
    if (err.response?.status === 404) {
      console.warn(`[API] 404 Not Found (non-blocking): functions/${functionName}`);
      return { data: undefined, error: undefined };
    }

    const error: ApiError = {
      success: false,
      error: err?.response?.data?.error || err?.response?.data?.message || err?.message || 'Network error. Please check your connection.',
      code: err?.response?.data?.code || err?.response?.data?.error?.code || `HTTP_${err?.response?.status || 'NETWORK_ERROR'}`,
      retryAfter: err?.response?.data?.retryAfter || err?.response?.data?.error?.retryAfter,
    };

    return { error };
  }
}

/**
 * Upload files using multipart/form-data to an edge function.
 * Returns errors in contract: { success: false, error: string, code?: string }.
 */
export async function axiosMultipartUpload<T = any>(
  functionName: string,
  formData: FormData,
  responseKey?: string
): Promise<{ data?: T; error?: ApiError }> {
  try {
    // Build the full URL for the function
    const baseUrl = getAuthFunctionsBaseUrl();
    const url = baseUrl.endsWith('/') && functionName.startsWith('/') 
      ? `${baseUrl}${functionName.slice(1)}` 
      : (!baseUrl.endsWith('/') && !functionName.startsWith('/') 
        ? `${baseUrl}/${functionName}` 
        : `${baseUrl}${functionName}`);
    
    const accessToken = await getAccessToken();

    // Build headers - don't set Content-Type manually, let axios/browser set it with boundary
    const headers: Record<string, string> = {};
    if (accessToken) {
      headers.Authorization = `Bearer ${accessToken}`;
    }

    // Log the request manually since we're using fetch
    logRequest({
      method: 'POST',
      url: functionName,
      baseURL: getAuthFunctionsBaseUrl(),
      headers,
      data: '[FormData Content]',
    });

    const startTime = Date.now();
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: formData,
    });

    const payload = await response.json();
    const duration = Date.now() - startTime;

    if (!response.ok) {
      logError(payload, {
        method: 'POST',
        url: functionName,
        baseURL: getAuthFunctionsBaseUrl(),
        headers,
        data: '[FormData Content]',
      });

      const error: ApiError = {
        success: false,
        error: payload?.error || payload?.message || 'Upload failed',
        code: payload?.code || `HTTP_${response.status}`,
      };
      return { error };
    }

    // Log success response
    if (API_LOGGING_ENABLED) {
      const timestamp = new Date().toISOString();
      console.group(`✅ [API Response] ${timestamp}`);
      console.info(`POST ${url} - ${response.status} ${response.statusText}`);
      console.log(`Duration: ${duration}ms`);
      console.log('Response Data:', payload);
      console.groupEnd();
    }

    let unwrapped = payload;
    if (responseKey && payload && typeof payload === 'object' && !Array.isArray(payload)) {
      if ((payload as any)[responseKey] !== undefined) {
        unwrapped = (payload as any)[responseKey];
      } else if ((payload as any).data !== undefined) {
        unwrapped = (payload as any).data;
      } else if ((payload as any).items !== undefined) {
        unwrapped = (payload as any).items;
      }
    }

    return { data: unwrapped as T };
  } catch (err: any) {
    const error: ApiError = {
      success: false,
      error: err?.message || 'Network error. Please check your connection.',
      code: 'NETWORK_ERROR',
    };
    return { error };
  }
}

/**
 * Export the Axios instances for direct use if needed
 */
export { createAxiosInstance };
