import { Platform, PermissionsAndroid } from 'react-native';
import messaging from '@react-native-firebase/messaging';
import notifee, { AndroidImportance, EventType } from '@notifee/react-native';
import { supabaseUrl } from './supabaseConfig';
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

import { registerPushToken } from './api/notifications';

/**
 * Register the device's push token with the backend
 */
export async function registerPushTokenFromDevice() {
    if (Platform.OS === 'web') return;
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

        const { error } = await registerPushToken(token, platform);
        if (error) {
            console.warn(`[PUSH] Server failed to register token: ${error.error}`);
        } else {
            console.log('[PUSH] ✅ Token registered successfully with backend');
        }
    } catch (error) {
        console.error('[PUSH] Failed to register push token:', error);
    }
}

export function handleNotificationNavigation(remoteMessage: any, router: any) {
    if (!remoteMessage) return;

    // Normalize data between FCM and Notifee
    const data = remoteMessage.data || remoteMessage.remoteMessage?.data || {};
    const notification = remoteMessage.notification || {};

    const title = (typeof notification.title === 'string' ? notification.title : typeof data.title === 'string' ? data.title : '').toLowerCase();
    const body = (typeof notification.body === 'string' ? notification.body : typeof data.body === 'string' ? data.body : '').toLowerCase();
    const leadId = data.leadId;
    const reviewId = data.reviewId;
    const screen = data.screen;

    console.log('[PUSH] Notification tapped:', { title, body, leadId, reviewId, screen, data });

    if (reviewId || screen === 'ReviewDetail' || title.includes('review') || body.includes('reviewed')) {
        console.log('[PUSH] Review notification. Navigating to reviews screen...');
        router.push('/(tabs)/reviews');
    } else if (leadId) {
        console.log('[PUSH] Lead ID found. Navigating to lead details...');
        router.push(`/lead-detail?id=${leadId}`);
    } else if (title.includes('lead') || body.includes('lead')) {
        console.log('[PUSH] Found "lead" in text. Navigating to leads screen...');
        router.push('/(tabs)/leads');
    } else if (title.includes('review') || body.includes('review')) {
        console.log('[PUSH] Found "review" in text. Navigating to reviews screen...');
        router.push('/(tabs)/reviews');
    } else {
        console.log('[PUSH] No specific route found. Navigating to dashboard...');
        router.push('/(tabs)');
    }
}

/**
 * Initialize notification listeners
 */
export function setupPushNotifications(router: any) {
    if (Platform.OS === 'web') {
        return () => {};
    }

    // Create Android Channel (Required for foreground notifications on Android)
    const createChannel = async () => {
        if (Platform.OS === 'android') {
            await notifee.createChannel({
                id: 'default',
                name: 'Default Channel',
                importance: AndroidImportance.HIGH,
                sound: 'default',
            });
        }
    };

    createChannel();

    // Handle background/quit state notification click (FCM)
    const unsubscribeOnNotificationOpenedApp = messaging().onNotificationOpenedApp(remoteMessage => {
        handleNotificationNavigation(remoteMessage, router);
    });

    // Check if the app was opened from a quit state or background via a notification (FCM).
    // We defer navigation with a timeout so the auth flow and navigation guards
    // fully settle first — without this, notifications clicked after a long time
    // can trigger a T&C redirect before the notification handler fires.
    messaging()
        .getInitialNotification()
        .then(remoteMessage => {
            if (remoteMessage) {
                console.log('[PUSH] App opened from quit/background state by notification — deferring navigation...');
                // Delay to allow _layout auth guards to finish redirecting first
                setTimeout(() => {
                    handleNotificationNavigation(remoteMessage, router);
                }, 1500);
            }
        });

    // Handle foreground messages (FCM)
    const unsubscribeOnMessage = messaging().onMessage(async remoteMessage => {
        console.log('[PUSH] Foreground message received, displaying via Notifee');

        // Display a system notification even though the app is in foreground
        await notifee.displayNotification({
            title: remoteMessage.notification?.title || (typeof remoteMessage.data?.title === 'string' ? remoteMessage.data.title : undefined),
            body: remoteMessage.notification?.body || (typeof remoteMessage.data?.body === 'string' ? remoteMessage.data.body : undefined),
            data: remoteMessage.data, // Pass through original data for navigation
            android: {
                channelId: 'default',
                importance: AndroidImportance.HIGH,
                smallIcon: 'ic_notification_logo',
                pressAction: {
                    id: 'default',
                },
            },
        });
    });

    // Handle Notifee notification taps (Foreground events)
    const unsubscribeNotifee = notifee.onForegroundEvent(({ type, detail }: { type: EventType, detail: any }) => {
        if (type === EventType.PRESS) {
            console.log('[PUSH] Notifee foreground press event');
            handleNotificationNavigation(detail.notification, router);
        }
    });

    return () => {
        unsubscribeOnNotificationOpenedApp();
        unsubscribeOnMessage();
        unsubscribeNotifee();
    };
}

