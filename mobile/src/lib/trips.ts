import { supabase } from './supabase';
import type { TripKind } from './types';

/** How each kind of trip reads, and its default check-in. */
export const TRIP_KINDS: Record<TripKind, { label: string; verb: string; noun: string; minutes: number }> = {
  walk: { label: 'Walk', verb: 'Walking', noun: 'walk', minutes: 20 },
  run: { label: 'Run', verb: 'Running', noun: 'run', minutes: 45 },
  ride: { label: 'Ride', verb: 'Riding', noun: 'ride', minutes: 30 },
};

export function isTripKind(value: unknown): value is TripKind {
  return value === 'walk' || value === 'run' || value === 'ride';
}

type TripLike = { kind?: TripKind | null; destination?: string | null };

function isHome(destination: string | null | undefined) {
  return destination?.trim().toLowerCase() === 'home';
}

function where(destination: string | null | undefined) {
  const d = destination?.trim();
  if (!d) return '';
  return isHome(d) ? ' home' : ` to ${d}`;
}

/** "Walking home", "Running to the gym", "Out for a ride". */
export function tripTitle(trip: TripLike): string {
  const k = TRIP_KINDS[trip.kind ?? 'walk'];
  return trip.destination?.trim() ? `${k.verb}${where(trip.destination)}` : `Out for a ${k.noun}`;
}

/** "Sam is walking home", "Sam is out for a run". */
export function followerTitle(name: string, trip: TripLike): string {
  const t = tripTitle(trip);
  return `${name} is ${t.charAt(0).toLowerCase()}${t.slice(1)}`;
}

/** "Home safe" or "Arrived safe". */
export function arrivedLabel(trip: TripLike): string {
  return isHome(trip.destination) ? 'Home safe' : 'Arrived safe';
}

/** "Sam is home safe", "Sam arrived safe". */
export function followerArrivedTitle(name: string, trip: TripLike): string {
  return isHome(trip.destination) ? `${name} is home safe` : `${name} arrived safe`;
}

export type TripSettings = { home: { lat: number; lng: number } | null; alertGuardians: boolean };

export async function loadTripSettings(userId: string): Promise<TripSettings> {
  const { data } = await supabase
    .from('private_profiles')
    .select('home_lat, home_lng, alert_guardians_on_missed')
    .eq('id', userId)
    .maybeSingle();
  return {
    home: data?.home_lat != null && data?.home_lng != null ? { lat: data.home_lat, lng: data.home_lng } : null,
    alertGuardians: !!data?.alert_guardians_on_missed,
  };
}

export async function saveHome(userId: string, home: { lat: number; lng: number } | null) {
  const { error } = await supabase
    .from('private_profiles')
    .update({ home_lat: home?.lat ?? null, home_lng: home?.lng ?? null })
    .eq('id', userId);
  if (error) throw error;
}

export async function setAlertGuardians(userId: string, on: boolean) {
  const { error } = await supabase.from('private_profiles').update({ alert_guardians_on_missed: on }).eq('id', userId);
  if (error) throw error;
}
