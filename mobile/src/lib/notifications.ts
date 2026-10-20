import Constants from 'expo-constants';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { Platform } from 'react-native';

import { supabase } from './supabase';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
  }),
});

/**
 * Asks for notification permission once. Needed on every iOS/Android build,
 * simulators included, for local check-in reminders as well as push.
 */
export async function ensureNotificationPermission(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    if (Platform.OS === 'android') {
      // Must match channelId in supabase/functions/_shared/push.ts.
      await Notifications.setNotificationChannelAsync('help-requests', {
        name: 'Help requests',
        importance: Notifications.AndroidImportance.MAX,
        vibrationPattern: [0, 400, 200, 400],
      });
      // The HereO ring on nearby phones. Must match RING_PUSH in supabase/functions/_shared/ring.ts.
      await Notifications.setNotificationChannelAsync('hereo-ring', {
        name: 'HereO ring (someone nearby needs help)',
        importance: Notifications.AndroidImportance.MAX,
        sound: 'hereo-ring.wav',
        vibrationPattern: [0, 600, 300, 600, 300, 600],
        bypassDnd: true,
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      });
    }
    const current = await Notifications.getPermissionsAsync();
    if (current.granted) return true;
    if (!current.canAskAgain) return false;
    return (await Notifications.requestPermissionsAsync()).granted;
  } catch (err) {
    console.warn('notification permission failed', err);
    return false;
  }
}

/** Asks for permission and stores this device's push token on the user's private profile. */
export async function registerForPush(userId: string): Promise<void> {
  if (!(await ensureNotificationPermission())) return;
  // Push tokens need a real device and an EAS project id.
  if (!Device.isDevice) return;
  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  try {
    const { data: token } = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    await supabase.from('private_profiles').update({ push_token: token }).eq('id', userId);
  } catch (err) {
    console.warn('push registration failed', err);
  }
}

/** Opens the ring, incident or walk a notification points to. Returns false if it points nowhere. */
export function openNotificationTarget(data: Record<string, unknown> | null | undefined): boolean {
  if (typeof data?.ring_id === 'string') {
    router.push({ pathname: '/ring/[id]', params: { id: data.ring_id } });
  } else if (typeof data?.incident_id === 'string') {
    router.push({ pathname: '/incident/[id]', params: { id: data.incident_id } });
  } else if (typeof data?.walk_id === 'string') {
    router.push({ pathname: '/walk/[id]', params: { id: data.walk_id } });
  } else {
    return false;
  }
  return true;
}

/** Opens what a tapped notification points to, including the one that launched the app. */
export function routeNotificationTaps(): () => void {
  if (Platform.OS === 'web') return () => {};
  const open = (response: Notifications.NotificationResponse | null) => {
    openNotificationTarget(response?.notification.request.content.data);
  };
  open(Notifications.getLastNotificationResponse());
  const sub = Notifications.addNotificationResponseReceivedListener(open);
  return () => sub.remove();
}
