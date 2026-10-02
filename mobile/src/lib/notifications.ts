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

/** Asks for permission and stores this device's push token on the user's private profile. */
export async function registerForPush(userId: string): Promise<void> {
  if (!Device.isDevice || Platform.OS === 'web') return;
  if (Platform.OS === 'android') {
    // Must match channelId in supabase/functions/_shared/push.ts.
    await Notifications.setNotificationChannelAsync('help-requests', {
      name: 'Help requests',
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 400, 200, 400],
    });
  }
  const current = await Notifications.getPermissionsAsync();
  const status = current.granted ? 'granted' : (await Notifications.requestPermissionsAsync()).status;
  if (status !== 'granted') return;
  const projectId = Constants.expoConfig?.extra?.eas?.projectId ?? Constants.easConfig?.projectId;
  try {
    const { data: token } = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
    await supabase.from('private_profiles').update({ push_token: token }).eq('id', userId);
  } catch (err) {
    console.warn('push registration failed', err);
  }
}

/** Opens the incident or walk a tapped notification points to, including the one that launched the app. */
export function routeNotificationTaps(): () => void {
  if (Platform.OS === 'web') return () => {};
  const open = (response: Notifications.NotificationResponse | null) => {
    const data = response?.notification.request.content.data;
    if (typeof data?.incident_id === 'string') {
      router.push({ pathname: '/incident/[id]', params: { id: data.incident_id } });
    } else if (typeof data?.walk_id === 'string') {
      router.push({ pathname: '/walk/[id]', params: { id: data.walk_id } });
    }
  };
  open(Notifications.getLastNotificationResponse());
  const sub = Notifications.addNotificationResponseReceivedListener(open);
  return () => sub.remove();
}
