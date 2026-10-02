import * as Notifications from 'expo-notifications';
import { useCallback, useEffect, useState } from 'react';
import { Platform } from 'react-native';

import { getQuickPosition } from './location';
import { supabase } from './supabase';
import type { HelpMode, Walk } from './types';

/** Minutes the server waits past due_at before it alerts the circle. Matches escalate_overdue_walks(). */
export const GRACE_MINUTES = 2;
export const DURATIONS = [10, 15, 20, 30, 45, 60] as const;
export const EXTEND_MINUTES = 10;

const WALK_SELECT = '*, profiles:user_id(display_name)';

export async function startWalk(opts: {
  userId: string;
  mode: HelpMode;
  minutes: number;
  destination?: string;
}): Promise<string> {
  const pos = await getQuickPosition();
  const dueAt = new Date(Date.now() + opts.minutes * 60_000);
  const { data, error } = await supabase
    .from('walks')
    .insert({
      user_id: opts.userId,
      mode: opts.mode,
      destination: opts.destination?.trim() || null,
      due_at: dueAt.toISOString(),
      lat: pos?.lat ?? null,
      lng: pos?.lng ?? null,
      location_at: pos ? new Date().toISOString() : null,
    })
    .select('id')
    .single();
  if (error) throw error;
  await scheduleReminders(data.id, dueAt);
  return data.id;
}

export async function endWalk(walkId: string, status: 'arrived' | 'cancelled') {
  const { error } = await supabase.from('walks').update({ status }).eq('id', walkId).eq('status', 'active');
  if (error) throw error;
  await cancelReminders(walkId);
}

export async function extendWalk(walk: Walk, minutes = EXTEND_MINUTES) {
  // Extend from whichever is later: now or the current deadline.
  const base = Math.max(Date.now(), new Date(walk.due_at).getTime());
  const dueAt = new Date(base + minutes * 60_000);
  const { error } = await supabase.from('walks').update({ due_at: dueAt.toISOString() }).eq('id', walk.id);
  if (error) throw error;
  await scheduleReminders(walk.id, dueAt);
}

export async function shareWalkLocation(walkId: string, lat: number, lng: number) {
  await supabase
    .from('walks')
    .update({ lat, lng, location_at: new Date().toISOString() })
    .eq('id', walkId)
    .eq('status', 'active');
}

// Local reminders, so the walker hears about the deadline even with the app
// closed: one a few minutes before, one at the deadline itself.
async function scheduleReminders(walkId: string, dueAt: Date) {
  if (Platform.OS === 'web') return;
  await cancelReminders(walkId);
  const data = { walk_id: walkId, url: `hereo://walk/${walkId}` };
  const warnAt = new Date(dueAt.getTime() - 3 * 60_000);
  try {
    if (warnAt.getTime() > Date.now() + 30_000) {
      await Notifications.scheduleNotificationAsync({
        identifier: `walk-${walkId}-warn`,
        content: { title: 'Check in soon', body: 'Your HereO check-in is in 3 minutes. Tap if you need more time.', data },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: warnAt },
      });
    }
    await Notifications.scheduleNotificationAsync({
      identifier: `walk-${walkId}-due`,
      content: {
        title: 'Time to check in',
        body: `Tap I've arrived. If we don't hear from you in ${GRACE_MINUTES} minutes, your circle is alerted.`,
        data,
        sound: 'default',
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: dueAt },
    });
  } catch (err) {
    console.warn('could not schedule check-in reminder', err);
  }
}

async function cancelReminders(walkId: string) {
  if (Platform.OS === 'web') return;
  await Promise.all(
    ['warn', 'due'].map((k) => Notifications.cancelScheduledNotificationAsync(`walk-${walkId}-${k}`).catch(() => {})),
  );
}

/** One walk, kept live for the walker and the people following along. */
export function useWalk(walkId: string) {
  const [walk, setWalk] = useState<Walk | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data, error } = await supabase.from('walks').select(WALK_SELECT).eq('id', walkId).maybeSingle<Walk>();
    if (error) setError(error.message);
    else if (!data) setError('This walk is not available to you.');
    else {
      setWalk(data);
      setError(null);
    }
  }, [walkId]);

  useEffect(() => {
    const first = setTimeout(load, 0);
    const channel = supabase
      .channel(`walk:${walkId}`)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'walks', filter: `id=eq.${walkId}` }, load)
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') load();
      });
    const poll = setInterval(load, 30_000);
    return () => {
      clearTimeout(first);
      clearInterval(poll);
      supabase.removeChannel(channel);
    };
  }, [walkId, load]);

  return { walk, error, reload: load };
}

/** Active walks the user can see: their own and their circle's. */
export async function loadActiveWalks(): Promise<Walk[]> {
  const { data } = await supabase
    .from('walks')
    .select(WALK_SELECT)
    .eq('status', 'active')
    .order('due_at', { ascending: true });
  return (data ?? []) as Walk[];
}

/** "12 min left", "Due now", "3 min late". */
export function describeDue(dueAt: string, now = Date.now()): string {
  const mins = Math.round((new Date(dueAt).getTime() - now) / 60_000);
  if (mins > 0) return `${mins} min left`;
  if (mins === 0) return 'Due now';
  return `${-mins} min late`;
}

export function clockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
}
