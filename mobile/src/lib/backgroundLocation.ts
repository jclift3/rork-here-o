import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';

import { supabase } from './supabase';

/**
 * Guardian background location. While a guardian is available, the OS wakes
 * the app on significant movement (about every 2 minutes or 150 m) and we
 * store a position that only the dispatch function can read. This keeps them
 * findable with HereO closed; nearby_guardians() ignores positions older than
 * 15 minutes.
 *
 * Needs a development or store build: Expo Go can't run background tasks.
 */
export const GUARDIAN_LOCATION_TASK = 'hereo-guardian-location';

// Must be defined at module scope so the OS can start it without the UI.
if (Platform.OS !== 'web') {
  TaskManager.defineTask<{ locations: Location.LocationObject[] }>(GUARDIAN_LOCATION_TASK, async ({ data, error }) => {
    if (error || !data?.locations?.length) return;
    const latest = data.locations[data.locations.length - 1];
    const { data: auth } = await supabase.auth.getSession();
    const userId = auth.session?.user.id;
    if (!userId) return;
    await supabase
      .from('private_profiles')
      .update({
        last_lat: latest.coords.latitude,
        last_lng: latest.coords.longitude,
        last_seen_at: new Date(latest.timestamp).toISOString(),
      })
      .eq('id', userId);
  });
}

export type BackgroundResult = 'on' | 'denied' | 'unsupported';

/** Asks for "Always" location if needed and starts updates. */
export async function startGuardianBackgroundLocation(): Promise<BackgroundResult> {
  if (Platform.OS === 'web' || !(await TaskManager.isAvailableAsync())) return 'unsupported';
  const fg = await Location.requestForegroundPermissionsAsync();
  if (fg.status !== 'granted') return 'denied';
  const bg = await Location.requestBackgroundPermissionsAsync();
  if (bg.status !== 'granted') return 'denied';
  if (!(await Location.hasStartedLocationUpdatesAsync(GUARDIAN_LOCATION_TASK))) {
    await Location.startLocationUpdatesAsync(GUARDIAN_LOCATION_TASK, {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: 2 * 60_000,
      distanceInterval: 150,
      deferredUpdatesInterval: 2 * 60_000,
      pausesUpdatesAutomatically: false,
      activityType: Location.ActivityType.Other,
      showsBackgroundLocationIndicator: false,
      foregroundService: {
        notificationTitle: 'You’re available as a guardian',
        notificationBody: 'HereO can send you to someone nearby who needs help.',
        notificationColor: '#E8338B',
      },
    });
  }
  return 'on';
}

export async function stopGuardianBackgroundLocation(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    if (await Location.hasStartedLocationUpdatesAsync(GUARDIAN_LOCATION_TASK)) {
      await Location.stopLocationUpdatesAsync(GUARDIAN_LOCATION_TASK);
    }
  } catch {
    // Not started or not supported in this build.
  }
}

export async function isGuardianBackgroundLocationOn(): Promise<boolean> {
  if (Platform.OS === 'web') return false;
  try {
    return await Location.hasStartedLocationUpdatesAsync(GUARDIAN_LOCATION_TASK);
  } catch {
    return false;
  }
}
