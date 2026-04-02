import * as Notifications from 'expo-notifications';

// Module-level notification capture.
// Must run at import time (before React mounts) — iOS consumes the
// notification response immediately on launch, and component-level listeners miss it.

let _pendingNotifText: string | null = null;

/** Get and clear any message captured from a notification tap at launch */
export function consumePendingNotifMessage(): string | null {
  const text = _pendingNotifText;
  _pendingNotifText = null;
  return text;
}

function captureNotifText(response: Notifications.NotificationResponse) {
  const fullText = (response.notification?.request?.content?.data as any)?.fullText;
  if (fullText && typeof fullText === 'string') {
    const trimmed = fullText.trim();
    if (trimmed && trimmed !== 'NO_REPLY' && trimmed !== 'HEARTBEAT_OK') {
      _pendingNotifText = trimmed;
    }
  }
}

// Fire immediately at module load — catches cold-launch taps
Notifications.getLastNotificationResponseAsync().then((response) => {
  if (response) captureNotifText(response);
});

// Also listen for taps while the app is running (background → foreground)
Notifications.addNotificationResponseReceivedListener(captureNotifText);
