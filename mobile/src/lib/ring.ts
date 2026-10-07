import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';

import { updateIncidentLocation } from './incidents';
import { watchPosition } from './location';
import { startSiren, stopSiren } from './siren';
import { supabase } from './supabase';
import type { ResponderStatus } from './types';

/**
 * The HereO ring, from the app's side. A help request now sounds the siren at
 * once (unless she chose silent), and after a 3 second window in which she can
 * cancel, rings opted-in HereO users nearby. Ending it can need her PIN; her
 * duress PIN looks the same on her screen but keeps help coming.
 */

export const RING_WINDOW_S = 3;

// ---------------------------------------------------------------------------
// Settings
// ---------------------------------------------------------------------------

export type Travel = 'foot' | 'drive';
export type AlarmStyle = 'loud' | 'silent';
export interface RingSettings {
  optIn: boolean;
  travel: Travel;
  alarmStyle: AlarmStyle;
}

let settings: RingSettings | null = null;
const settingsListeners = new Set<() => void>();
const emitSettings = () => settingsListeners.forEach((l) => l());

export async function refreshRingSettings(userId: string): Promise<RingSettings | null> {
  if (!userId) {
    settings = null;
    emitSettings();
    return null;
  }
  const { data } = await supabase
    .from('private_profiles')
    .select('ring_opt_in, ring_travel, alarm_style')
    .eq('id', userId)
    .maybeSingle();
  if (data) {
    settings = {
      optIn: !!data.ring_opt_in,
      travel: data.ring_travel === 'drive' ? 'drive' : 'foot',
      alarmStyle: data.alarm_style === 'silent' ? 'silent' : 'loud',
    };
    emitSettings();
  }
  return settings;
}

export async function saveRingSettings(userId: string, patch: Partial<RingSettings>) {
  const row: Record<string, unknown> = {};
  if (patch.optIn !== undefined) row.ring_opt_in = patch.optIn;
  if (patch.travel !== undefined) row.ring_travel = patch.travel;
  if (patch.alarmStyle !== undefined) row.alarm_style = patch.alarmStyle;
  const { error } = await supabase.from('private_profiles').update(row).eq('id', userId);
  if (error) throw error;
  await refreshRingSettings(userId);
}

/** The signed-in user's ring settings, or null until loaded. */
export function useRingSettings(): RingSettings | null {
  return useSyncExternalStore(
    (l) => {
      settingsListeners.add(l);
      return () => settingsListeners.delete(l);
    },
    () => settings,
  );
}

export function currentAlarmStyle(): AlarmStyle {
  return settings?.alarmStyle ?? 'loud';
}

// ---------------------------------------------------------------------------
// Her side: siren, cancel window, ring
// ---------------------------------------------------------------------------

export type RingPhase = 'idle' | 'countdown' | 'rung';
export interface RingFlow {
  incidentId: string | null;
  phase: RingPhase;
  secondsLeft: number;
  siren: boolean;
}

let flow: RingFlow = { incidentId: null, phase: 'idle', secondsLeft: 0, siren: false };
const flowListeners = new Set<() => void>();
let countdown: ReturnType<typeof setInterval> | null = null;
const setFlow = (patch: Partial<RingFlow>) => {
  flow = { ...flow, ...patch };
  flowListeners.forEach((l) => l());
};

export function useRingFlow(): RingFlow {
  return useSyncExternalStore(
    (l) => {
      flowListeners.add(l);
      return () => flowListeners.delete(l);
    },
    () => flow,
  );
}

/** Starts the siren (if loud) and the cancel window for a new request. */
export function armRing(incidentId: string, alarm: AlarmStyle) {
  if (flow.incidentId === incidentId && flow.phase !== 'idle') return;
  if (countdown) clearInterval(countdown);
  const loud = alarm === 'loud';
  if (loud) startSiren();
  setFlow({ incidentId, phase: 'countdown', secondsLeft: RING_WINDOW_S, siren: loud });
  countdown = setInterval(() => {
    const left = flow.secondsLeft - 1;
    if (left > 0) return setFlow({ secondsLeft: left });
    if (countdown) clearInterval(countdown);
    countdown = null;
    setFlow({ phase: 'rung', secondsLeft: 0 });
    ringNearby(incidentId);
  }, 1000);
}

/** Ends the local alarm: siren off, window closed. */
export function disarmRing() {
  if (countdown) clearInterval(countdown);
  countdown = null;
  stopSiren();
  setFlow({ incidentId: null, phase: 'idle', secondsLeft: 0, siren: false });
}

export function silenceSiren() {
  stopSiren();
  setFlow({ siren: false });
}

async function ringNearby(incidentId: string) {
  for (let attempt = 0; attempt < 2; attempt++) {
    const { error } = await supabase.functions.invoke('ring', { body: { incident_id: incidentId, action: 'send' } });
    if (!error) return;
    console.warn('ring failed', error);
    await new Promise((r) => setTimeout(r, 1500));
  }
}

export function notifyRingEnded(incidentId: string) {
  supabase.functions.invoke('ring', { body: { incident_id: incidentId, action: 'ended' } }).catch(() => {});
}

// ---------------------------------------------------------------------------
// PIN and duress
// ---------------------------------------------------------------------------

export interface PinStatus {
  has_pin: boolean;
  has_duress: boolean;
  strikes: number;
  limited: boolean;
  banned: boolean;
}

export async function loadPinStatus(): Promise<PinStatus | null> {
  const { data } = await supabase.rpc('ring_pin_status');
  return (Array.isArray(data) ? data[0] : data) ?? null;
}

export async function setRingPin(kind: 'cancel' | 'duress', pin: string | null, current?: string) {
  const { error } = await supabase.rpc('set_ring_pin', { p_kind: kind, p_pin: pin, p_current: current || null });
  if (error) throw error;
}

/**
 * Ends her request. Returns 'closed', or 'duress' when she used her duress PIN:
 * her phone then looks exactly as if it closed, while the request stays open
 * and her location keeps going to the people helping.
 */
export async function endHelpRequest(
  incidentId: string,
  status: 'resolved' | 'cancelled',
  pin: string | null,
): Promise<'closed' | 'duress'> {
  const { data, error } = await supabase.rpc('end_help_request', {
    p_incident: incidentId,
    p_status: status,
    p_pin: pin,
  });
  if (error) throw error;
  disarmRing();
  if (data === 'duress') await markDuress(incidentId);
  notifyRingEnded(incidentId);
  return data === 'duress' ? 'duress' : 'closed';
}

const DURESS_KEY = 'hereo.duress';
let duress = new Set<string>();
const duressListeners = new Set<() => void>();
let duressLoaded = false;

async function loadDuress() {
  if (duressLoaded) return;
  duressLoaded = true;
  try {
    const raw = await AsyncStorage.getItem(DURESS_KEY);
    duress = new Set(raw ? (JSON.parse(raw) as string[]) : []);
    duressListeners.forEach((l) => l());
  } catch {
    // Nothing stored.
  }
}

async function markDuress(incidentId: string) {
  duress = new Set([...duress, incidentId]);
  duressListeners.forEach((l) => l());
  await AsyncStorage.setItem(DURESS_KEY, JSON.stringify([...duress])).catch(() => {});
  shareLocationQuietly(incidentId);
}

export function useDuress(incidentId: string | null): boolean {
  const ids = useSyncExternalStore(
    (l) => {
      duressListeners.add(l);
      loadDuress();
      return () => duressListeners.delete(l);
    },
    () => duress,
  );
  return !!incidentId && ids.has(incidentId);
}

/** Keeps her location going to the request while the app runs, until it is closed for real. */
let quietStop: (() => void) | null = null;
async function shareLocationQuietly(incidentId: string) {
  quietStop?.();
  let last = 0;
  let checked = Date.now();
  const stop = await watchPosition(async (c) => {
    if (Date.now() - last < 10_000) return;
    last = Date.now();
    updateIncidentLocation(incidentId, c.lat, c.lng);
    if (Date.now() - checked > 60_000) {
      checked = Date.now();
      const { data } = await supabase.from('incidents').select('status').eq('id', incidentId).maybeSingle();
      if (data && data.status !== 'active') quietStop?.();
    }
  });
  quietStop = () => {
    stop();
    quietStop = null;
  };
}

// ---------------------------------------------------------------------------
// Neighbour side
// ---------------------------------------------------------------------------

export interface RingCard {
  incident_id: string;
  active: boolean;
  lat: number | null;
  lng: number | null;
  location_at: string | null;
  created_at: string;
  her_o: boolean;
  travel: Travel;
  distance_m: number | null;
  my_status: ResponderStatus;
  false_alarm_reported: boolean;
  going: number;
  rung: number;
}

export interface ActiveRing {
  incident_id: string;
  distance_m: number | null;
  travel: Travel;
  my_status: ResponderStatus;
  created_at: string;
}

export async function loadActiveRings(): Promise<ActiveRing[]> {
  const { data } = await supabase.rpc('my_active_rings');
  return (data ?? []) as ActiveRing[];
}

/** Loads a ring card and keeps it live. */
export function useRingCard(incidentId: string, userId: string) {
  const [card, setCard] = useState<RingCard | null>(null);
  const [missing, setMissing] = useState(false);

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc('ring_card', { p_incident: incidentId });
    const row = (Array.isArray(data) ? data[0] : data) as RingCard | undefined;
    if (error || !row) {
      setMissing(true);
      return;
    }
    setCard(row);
    setMissing(false);
  }, [incidentId]);

  useEffect(() => {
    const first = setTimeout(load, 0);
    const channel = supabase
      .channel(`ring:${incidentId}:${Math.random().toString(36).slice(2)}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'ring_responders', filter: `user_id=eq.${userId}` },
        load,
      )
      .subscribe();
    // Her position and the going count change on rows this user can't subscribe to.
    const poll = setInterval(load, 10_000);
    return () => {
      clearTimeout(first);
      clearInterval(poll);
      supabase.removeChannel(channel);
    };
  }, [incidentId, userId, load]);

  return { card, missing, reload: load };
}

export async function respondToRing(incidentId: string, status: 'en_route' | 'on_scene' | 'declined') {
  const { error } = await supabase.rpc('respond_to_ring', { p_incident: incidentId, p_status: status });
  if (error) throw error;
}

export async function reportFalseRing(incidentId: string) {
  const { error } = await supabase.rpc('report_false_ring', { p_incident: incidentId });
  if (error) throw error;
}

export function describeRingDistance(m: number | null | undefined): string {
  if (m == null) return 'Nearby';
  if (m < 1000) return `${Math.max(10, Math.round(m / 10) * 10)} m away`;
  return `${(m / 1000).toFixed(1)} km away`;
}

/** Compass direction from one point to another, e.g. "north-east". */
export function compassDirection(from: { lat: number; lng: number }, to: { lat: number; lng: number }): string {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const y = Math.sin(toRad(to.lng - from.lng)) * Math.cos(toRad(to.lat));
  const x =
    Math.cos(toRad(from.lat)) * Math.sin(toRad(to.lat)) -
    Math.sin(toRad(from.lat)) * Math.cos(toRad(to.lat)) * Math.cos(toRad(to.lng - from.lng));
  const bearing = ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
  const names = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
  return names[Math.round(bearing / 45) % 8];
}
