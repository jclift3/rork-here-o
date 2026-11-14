import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import { Platform } from 'react-native';

import { supabase } from './supabase';
import { hideTrip } from './tripActivity';
import { arrivedLabel, tripTitle } from './trips';

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
        notificationTitle: 'HereO can reach you',
        notificationBody: 'So it can ring you if someone nearby needs help.',
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

/**
 * Trip background location. While one of the user's trips is active, the
 * OS keeps sending positions (about every 30 seconds or 40 m) with HereO in
 * the background or locked, so the circle can follow and the trip can end
 * itself on arrival. The task stops itself once no trip is active.
 */
export const TRIP_LOCATION_TASK = 'hereo-trip-location';

if (Platform.OS !== 'web') {
  TaskManager.defineTask<{ locations: Location.LocationObject[] }>(TRIP_LOCATION_TASK, async ({ data, error }) => {
    if (error || !data?.locations?.length) return;
    const latest = data.locations[data.locations.length - 1];
    const { data: auth } = await supabase.auth.getSession();
    const userId = auth.session?.user.id;
    if (!userId) return stopTripBackgroundLocation();
    const { data: updated } = await supabase
      .from('walks')
      .update({
        lat: latest.coords.latitude,
        lng: latest.coords.longitude,
        location_at: new Date(latest.timestamp).toISOString(),
      })
      .eq('user_id', userId)
      .eq('status', 'active')
      .select('id, kind, destination, status, arrived_automatically');
    const trip = updated?.[0];
    if (!trip) return stopTripBackgroundLocation();
    // Reached the destination: the database ended the trip and told the circle.
    if (trip.status === 'arrived') {
      await stopTripBackgroundLocation();
      await Promise.all(
        ['warn', 'due'].map((k) => Notifications.cancelScheduledNotificationAsync(`walk-${trip.id}-${k}`).catch(() => {})),
      );
      await hideTrip({ kind: trip.kind, title: tripTitle(trip), label: arrivedLabel(trip) });
    }
  });
}

/** Keeps sharing the trip's location while HereO is in the background. Never throws. */
export async function startTripBackgroundLocation(): Promise<BackgroundResult> {
  try {
    if (Platform.OS === 'web' || !(await TaskManager.isAvailableAsync())) return 'unsupported';
    const bg = await Location.requestBackgroundPermissionsAsync();
    if (bg.status !== 'granted') return 'denied';
    await Location.startLocationUpdatesAsync(TRIP_LOCATION_TASK, {
      accuracy: Location.Accuracy.High,
      timeInterval: 30_000,
      distanceInterval: 40,
      pausesUpdatesAutomatically: false,
      activityType: Location.ActivityType.Fitness,
      showsBackgroundLocationIndicator: true,
      foregroundService: {
        notificationTitle: 'Your circle is following your trip',
        notificationBody: 'HereO shares your location until you arrive.',
        notificationColor: '#E8338B',
      },
    });
    return 'on';
  } catch {
    // Expo Go or a build without background location.
    return 'unsupported';
  }
}

export async function stopTripBackgroundLocation(): Promise<void> {
  if (Platform.OS === 'web') return;
  try {
    if (await Location.hasStartedLocationUpdatesAsync(TRIP_LOCATION_TASK)) {
      await Location.stopLocationUpdatesAsync(TRIP_LOCATION_TASK);
    }
  } catch {
    // Not started or not supported in this build.
  }
}
