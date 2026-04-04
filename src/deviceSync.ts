import * as Calendar from 'expo-calendar';
import * as Location from 'expo-location';
import { fetchWithTimeout } from './fetchWithTimeout';

export interface DeviceContext {
  location?: {
    city?: string;
    region?: string;
    latitude: number;
    longitude: number;
    timestamp: number;
  };
  calendars?: {
    id: string;
    title: string;
    source: string;
    events: {
      title: string;
      startDate: string;
      endDate: string;
      allDay: boolean;
      location?: string;
      notes?: string;
    }[];
  }[];
  reminders?: {
    id: string;
    title: string;
    dueDate?: string;
    completed: boolean;
    notes?: string;
  }[];
  syncedAt: string;
}

/**
 * Gather device context (location, calendar events, reminders) and send to server.
 * Best-effort — failures are silent.
 */
export async function syncDeviceContext(
  serverUrl: string,
  gatewayToken: string,
): Promise<void> {
  try {
    const context: DeviceContext = { syncedAt: new Date().toISOString() };

    // Location
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
        const [geo] = await Location.reverseGeocodeAsync({
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
        }).catch(() => [undefined]);
        context.location = {
          city: geo?.city || undefined,
          region: geo?.region || undefined,
          latitude: loc.coords.latitude,
          longitude: loc.coords.longitude,
          timestamp: loc.timestamp,
        };
      }
    } catch {}

    // Calendar events (next 7 days)
    try {
      const { status } = await Calendar.getCalendarPermissionsAsync();
      if (status === 'granted') {
        const calendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.EVENT);
        const now = new Date();
        const weekLater = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
        const calendarIds = calendars.map(c => c.id);
        
        if (calendarIds.length > 0) {
          const events = await Calendar.getEventsAsync(calendarIds, now, weekLater);
          
          // Group events by calendar
          const calMap = new Map<string, typeof context.calendars extends (infer T)[] | undefined ? T : never>();
          for (const cal of calendars) {
            calMap.set(cal.id, {
              id: cal.id,
              title: cal.title,
              source: cal.source?.name || 'Unknown',
              events: [],
            });
          }
          
          for (const evt of events) {
            const cal = calMap.get(evt.calendarId);
            if (cal) {
              cal.events.push({
                title: evt.title,
                startDate: typeof evt.startDate === 'string' ? evt.startDate : new Date(evt.startDate).toISOString(),
                endDate: typeof evt.endDate === 'string' ? evt.endDate : new Date(evt.endDate).toISOString(),
                allDay: evt.allDay,
                location: evt.location || undefined,
                notes: evt.notes || undefined,
              });
            }
          }
          
          context.calendars = Array.from(calMap.values()).filter(c => c.events.length > 0);
        }
      }
    } catch {}

    // Reminders (iOS only)
    try {
      const { status } = await Calendar.getRemindersPermissionsAsync();
      if (status === 'granted') {
        const reminderCalendars = await Calendar.getCalendarsAsync(Calendar.EntityTypes.REMINDER);
        const calIds = reminderCalendars.map(c => c.id);
        
        if (calIds.length > 0) {
          const now = new Date();
          const monthLater = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000);
          const reminders = await Calendar.getRemindersAsync(
            calIds,
            null, // all statuses
            now,
            monthLater,
          );
          
          context.reminders = reminders.map(r => ({
            id: r.id || '',
            title: r.title || 'Untitled',
            dueDate: r.dueDate ? (typeof r.dueDate === 'string' ? r.dueDate : new Date(r.dueDate).toISOString()) : undefined,
            completed: r.completed || false,
            notes: r.notes || undefined,
          }));
        }
      }
    } catch {}

    // Send to server
    await fetchWithTimeout(`${serverUrl}/api/device-sync`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${gatewayToken}`,
      },
      body: JSON.stringify(context),
    });
  } catch {
    // Silent failure — sync is best-effort
  }
}
