import { Platform, PermissionsAndroid } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import { supabaseUrl } from './supabase';
import { apiFetch } from './apiClient';

/**
 * Request notification permissions with platform-specific logic
 */
export async function requestNotificationPermission(): Promise<boolean> {
    if (Platform.OS === 'ios') {
        const authStatus = await messaging().requestPermission();
        return (
            authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
            authStatus === messaging.AuthorizationStatus.PROVISIONAL
        );
    } else if (Platform.OS === 'android') {
        if (Platform.Version >= 33) {
            const granted = await PermissionsAndroid.request(
                PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
            );
            return granted === PermissionsAndroid.RESULTS.GRANTED;
        } else {
            // Android 12 and below: permission is automatically granted
            return true;
        }
    }
    return false;
}

/**
 * Check notification permissions without requesting them
 */
export async function checkNotificationPermission(): Promise<boolean> {
    if (Platform.OS === 'ios') {
        const authStatus = await messaging().hasPermission();
        return (
            authStatus === messaging.AuthorizationStatus.AUTHORIZED ||
            authStatus === messaging.AuthorizationStatus.PROVISIONAL
        );
    } else if (Platform.OS === 'android') {
        if (Platform.Version >= 33) {
            return await PermissionsAndroid.check(
                PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS
            );
        } else {
            // Android 12 and below: permission is automatically granted
            return true;
        }
    }
    return false;
}

/**
 * Register the device's push token with the backend
 */
export async function registerPushTokenFromDevice() {
    try {
        // Request permission
        const hasPermission = await requestNotificationPermission();

        if (!hasPermission) {
            console.log('[PUSH] Notification permission denied');
            return;
        }

        // Get the device token
        const token = await messaging().getToken();
        const platform = Platform.OS === 'ios' ? 'ios' : 'android';

        console.log('--------------------------------------------------');
        console.log('🚀 [FCM TOKEN]:', token);
        console.log('--------------------------------------------------');

        await registerPushToken(token, platform);
    } catch (error) {
        console.error('[PUSH] Failed to register push token:', error);
    }
}

/**
 * API call to register the token
 */
export async function registerPushToken(pushToken: string, platform: 'ios' | 'android') {
    const url = `${supabaseUrl}/functions/v1/push-register-token`;

    console.log(`[PUSH] Registering token for ${platform}...`);
    try {
        const response = await apiFetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                pushToken,
                platform
            })
        });

        if (!response.ok) {
            const text = await response.text();
            console.warn(`[PUSH] Server returned ${response.status}: ${text}`);
            return;
        }

        console.log('[PUSH] ✅ Token registered successfully with backend');
    } catch (err) {
        console.error('[PUSH] ❌ Error in registerPushToken API call:', err);
    }
}

export function handleNotificationNavigation(remoteMessage: any, router: any) {
    if (!remoteMessage) return;

    const title = (remoteMessage.notification?.title || remoteMessage.data?.title || '').toLowerCase();
    const body = (remoteMessage.notification?.body || remoteMessage.data?.body || '').toLowerCase();

    console.log('[PUSH] Notification tapped:', { title, body, data: remoteMessage.data });

    if (title.includes('lead') || body.includes('lead')) {
        console.log('[PUSH] Found "lead" in notification. Navigating to leads screen...');
        router.push('/(tabs)/leads');
    }
}

/**
 * Initialize notification listeners
 */
export function setupPushNotifications(router: any) {
    // Handle background/quit state notification click
    const unsubscribeOnNotificationOpenedApp = messaging().onNotificationOpenedApp(remoteMessage => {
        handleNotificationNavigation(remoteMessage, router);
    });

    // Check if the app was opened from a quit state via a notification
    messaging()
        .getInitialNotification()
        .then(remoteMessage => {
            if (remoteMessage) {
                console.log('[PUSH] App opened from quit state by notification');
                handleNotificationNavigation(remoteMessage, router);
            }
        });

    // Handle foreground messages (optional, showing an alert or just logging)
    const unsubscribeOnMessage = messaging().onMessage(async remoteMessage => {
        console.log('[PUSH] Foreground notification received:', remoteMessage.notification);
    });

    return () => {
        unsubscribeOnNotificationOpenedApp();
        unsubscribeOnMessage();
    };
}

