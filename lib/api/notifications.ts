import { apiFetch, functionsCall } from '../apiClient';
import { getAuthFunctionsBaseUrl } from '../apiConfig';

/** Spec: push-register-token { pushToken, platform, deviceId? } */
export async function registerPushToken(pushToken: string, platform: string, deviceId?: string) {
  return functionsCall<unknown>('push-register-token', { pushToken, platform, deviceId });
}

export interface SendPushRequest {
  userId: string;
  userType: 'vendor' | 'customer' | 'admin';
  title: string;
  body: string;
  data?: Record<string, string>;
}

/** 
 * Spec: send-push { userId, userType, title, body, data? }
 * Requires x-send-push-secret header.
 */
export async function sendPush(body: SendPushRequest, secret: string) {
  const url = `${getAuthFunctionsBaseUrl()}/send-push`;
  const response = await apiFetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-send-push-secret': secret,
    },
    body: JSON.stringify(body),
  });
  
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    return { error: { success: false, error: data?.error || data?.message || 'Failed to send push' } };
  }
  return { data };
}
