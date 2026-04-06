import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { fetchWithTimeout } from './fetchWithTimeout';

// Suppress notifications when app is in foreground — user is already reading the chat.
// Push only shows banner/sound when app is backgrounded or killed (iOS default behavior).
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: false,
    shouldShowList: false,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

export async function registerForPushNotifications(): Promise<string | null> {
  // Push notifications only work on physical devices
  if (!Device.isDevice) {
    console.log('Push notifications require a physical device');
    return null;
  }

  // Check existing permissions
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  // Request if not already granted
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('Push notification permission not granted');
    return null;
  }

  // Get Expo push token
  try {
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId: '621af8c4-fdbd-492d-bf22-2db15c196ebe',
    });
    return tokenData.data;
  } catch (error) {
    console.error('Failed to get push token:', error);
    return null;
  }
}

// Push server base URL (same as media upload server)
import { PROVISION_API_URL as PUSH_SERVER_URL } from './constants';

/**
 * Register Expo push token with the push server so it can send
 * true push notifications even when the app is fully closed.
 * Requires a valid gateway token — unprovisioned devices cannot register.
 */
export async function registerTokenWithPushServer(
  token: string,
  deviceId?: string,
  gatewayToken?: string,
): Promise<boolean> {
  if (!gatewayToken) return false; // No auth = no registration
  try {
    const res = await fetchWithTimeout(`${PUSH_SERVER_URL}/push/register`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${gatewayToken}`,
      },
      body: JSON.stringify({
        token,
        platform: 'expo',
        deviceId: deviceId || 'ios-primary',
      }),
    });
    const data = await res.json();
    console.log('Push token registered with server:', data.ok);
    return data.ok === true;
  } catch (error) {
    console.error('Failed to register push token with server:', error);
    return false;
  }
}

/** Clear the app badge count */
export async function clearBadge(): Promise<void> {
  try {
    await Notifications.setBadgeCountAsync(0);
  } catch {}
}

// Listener types for cleanup
export function addNotificationReceivedListener(
  handler: (notification: Notifications.Notification) => void
) {
  return Notifications.addNotificationReceivedListener(handler);
}

export function addNotificationResponseReceivedListener(
  handler: (response: Notifications.NotificationResponse) => void
) {
  return Notifications.addNotificationResponseReceivedListener(handler);
}
