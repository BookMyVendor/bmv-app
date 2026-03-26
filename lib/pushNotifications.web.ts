/**
 * Web: skip FCM / Notifee — native modules are unavailable.
 * Metro resolves this file instead of pushNotifications.ts for web bundles.
 */

export async function requestNotificationPermission(): Promise<boolean> {
  return false;
}

export async function checkNotificationPermission(): Promise<boolean> {
  return false;
}

export async function registerPushTokenFromDevice(): Promise<void> {}

export async function registerPushToken(
  _pushToken: string,
  _platform: 'ios' | 'android'
): Promise<void> {}

export function handleNotificationNavigation(
  _remoteMessage: unknown,
  _router: unknown
): void {}

export function setupPushNotifications(_router: unknown): () => void {
  return () => {};
}
