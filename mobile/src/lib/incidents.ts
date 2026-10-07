import * as Haptics from 'expo-haptics';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Linking, Platform } from 'react-native';

import { getQuickPosition } from './location';
import { armRing, currentAlarmStyle } from './ring';
import { supabase } from './supabase';
import type { HelpMode, Incident, IncidentEvent, Responder, ResponderStatus } from './types';

const UNIQUE_VIOLATION = '23505';

/**
 * Creates an incident and starts dispatch. Returns the incident id as soon as
 * the row exists so the app can show the live screen immediately; dispatch
 * (circle alerts, AI triage, guardian alerts) continues in the background.
 * The siren starts at once unless she chose silent, and HereO users nearby
 * are rung after a short window in which she can cancel.
 */
export async function raiseAlert(opts: {
  userId: string;
  mode: HelpMode;
  trigger: 'hold' | 'tap';
  note?: string;
}): Promise<string> {
  if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  const alarm = currentAlarmStyle();
  const pos = await getQuickPosition();
  const { data, error } = await supabase
    .from('incidents')
    .insert({
      requester_id: opts.userId,
      mode: opts.mode,
      trigger: opts.trigger,
      alarm,
      note: opts.note?.trim() || null,
      lat: pos?.lat ?? null,
      lng: pos?.lng ?? null,
      location_at: pos ? new Date().toISOString() : null,
    })
    .select('id')
    .single();

  let id = data?.id as string | undefined;
  if (error?.code === UNIQUE_VIOLATION) {
    // Already asking for help: reopen that incident instead of a second one.
    const existing = await supabase
      .from('incidents')
      .select('id')
      .eq('requester_id', opts.userId)
      .eq('status', 'active')
      .single();
    id = existing.data?.id;
  } else if (error) {
    throw error;
  }
  if (!id) throw new Error('Could not start a help request');
  dispatch(id);
  armRing(id, alarm);
  return id;
}

/** Calls the dispatch function, retrying once. Idempotent on the server. */
export async function dispatch(incidentId: string): Promise<void> {
  for (let attempt = 0; attempt < 2; attempt++) {
    const { error } = await supabase.functions.invoke('dispatch', { body: { incident_id: incidentId } });
    if (!error) return;
    console.warn('dispatch failed', error);
    await new Promise((r) => setTimeout(r, 1500));
  }
}

/** Asks the server to refresh the shared AI brief (rate-limited server side). */
export function refreshBrief(incidentId: string): void {
  supabase.functions.invoke('brief', { body: { incident_id: incidentId } }).catch(() => {});
}

export async function sendMessage(incidentId: string, userId: string, body: string) {
  const { error } = await supabase
    .from('incident_events')
    .insert({ incident_id: incidentId, actor_id: userId, kind: 'message', body: body.trim() });
  if (error) throw error;
  refreshBrief(incidentId);
}

export async function setResponderStatus(incidentId: string, userId: string, status: ResponderStatus) {
  const { error } = await supabase
    .from('incident_responders')
    .update({ status })
    .eq('incident_id', incidentId)
    .eq('user_id', userId);
  if (error) throw error;
  refreshBrief(incidentId);
}

export async function closeIncident(incidentId: string, status: 'resolved' | 'cancelled') {
  const { error } = await supabase.from('incidents').update({ status }).eq('id', incidentId);
  if (error) throw error;
}

export async function updateIncidentLocation(incidentId: string, lat: number, lng: number) {
  await supabase
    .from('incidents')
    .update({ lat, lng, location_at: new Date().toISOString() })
    .eq('id', incidentId);
}

/** Opens the phone dialer on 911 and records that it happened. */
export async function call911(incidentId: string | null, userId: string, isRequester: boolean) {
  Linking.openURL('tel:911');
  if (!incidentId) return;
  await supabase
    .from('incident_events')
    .insert({ incident_id: incidentId, actor_id: userId, kind: 'escalated_911', body: 'Called 911' });
  if (isRequester) {
    await supabase.from('incidents').update({ escalated_911_at: new Date().toISOString() }).eq('id', incidentId);
  }
}

export interface IncidentBundle {
  incident: Incident;
  responders: Responder[];
  events: IncidentEvent[];
}

/** Loads an incident and keeps it live via Supabase Realtime. */
export function useIncident(incidentId: string) {
  const [bundle, setBundle] = useState<IncidentBundle | null>(null);
  const [error, setError] = useState<string | null>(null);
  const loading = useRef(false);

  const load = useCallback(async () => {
    if (loading.current) return;
    loading.current = true;
    try {
      const [inc, resp, ev] = await Promise.all([
        supabase.from('incidents').select('*').eq('id', incidentId).maybeSingle<Incident>(),
        supabase
          .from('incident_responders')
          .select('*, profiles:user_id(display_name)')
          .eq('incident_id', incidentId)
          .order('distance_m', { ascending: true, nullsFirst: false }),
        supabase
          .from('incident_events')
          .select('*, profiles:actor_id(display_name)')
          .eq('incident_id', incidentId)
          .order('id', { ascending: true }),
      ]);
      if (inc.error) throw inc.error;
      if (!inc.data) {
        setError('This help request is not available to you.');
        return;
      }
      setBundle({
        incident: inc.data,
        responders: (resp.data ?? []) as Responder[],
        events: (ev.data ?? []) as IncidentEvent[],
      });
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load this request');
    } finally {
      loading.current = false;
    }
  }, [incidentId]);

  useEffect(() => {
    const first = setTimeout(load, 0);
    // Unique per screen; see useWalk.
    const channel = supabase
      .channel(`incident:${incidentId}:${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'incidents', filter: `id=eq.${incidentId}` }, load)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'incident_responders', filter: `incident_id=eq.${incidentId}` },
        load,
      )
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'incident_events', filter: `incident_id=eq.${incidentId}` },
        load,
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') load();
      });
    // Realtime can drop on flaky networks; a slow poll keeps the screen honest.
    const poll = setInterval(load, 15_000);
    return () => {
      clearTimeout(first);
      clearInterval(poll);
      supabase.removeChannel(channel);
    };
  }, [incidentId, load]);

  return { bundle, error, reload: load };
}

export const RESPONDER_STATUS_LABEL: Record<ResponderStatus, string> = {
  notified: 'Alerted',
  en_route: 'On the way',
  on_scene: 'With you',
  declined: "Can't make it",
  released: 'Done',
};
