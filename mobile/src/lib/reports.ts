import { useEffect, useMemo, useState } from 'react';
import { Alert } from 'react-native';

import { friendlyError, supabase } from './supabase';

type Reason = 'unsafe' | 'harassment' | 'false_alarm' | 'other';

const REASONS: { reason: Reason; label: string }[] = [
  { reason: 'unsafe', label: 'Made me feel unsafe' },
  { reason: 'harassment', label: 'Abusive or harassing message' },
  { reason: 'false_alarm', label: 'Misusing HereO' },
  { reason: 'other', label: 'Something else' },
];

interface Target {
  userId: string;
  name: string;
  incidentId?: string | null;
  eventId?: number | null;
  /** Called after a block, so the screen can hide what this person wrote. */
  onBlocked?: () => void;
}

/**
 * Report or block someone you met through HereO (App Store guideline 1.2).
 * Reports go to the HereO team; a block keeps you apart from now on.
 */
export function reportOrBlock(t: Target) {
  Alert.alert(t.name, 'What would you like to do?', [
    { text: `Report ${t.name}`, onPress: () => chooseReason(t) },
    { text: `Block ${t.name}`, style: 'destructive', onPress: () => confirmBlock(t) },
    { text: 'Cancel', style: 'cancel' },
  ]);
}

function chooseReason(t: Target) {
  Alert.alert(`Report ${t.name}`, 'The HereO team reviews every report, usually within a day. They won’t be told who reported them.', [
    ...REASONS.map((r) => ({ text: r.label, onPress: () => askBlockToo(t, r.reason) })),
    { text: 'Cancel', style: 'cancel' as const },
  ]);
}

function askBlockToo(t: Target, reason: Reason) {
  Alert.alert('Also block them?', `If you block ${t.name}, HereO won’t send them to you or you to them, and you won’t see their messages.`, [
    { text: 'Report only', onPress: () => send(t, reason, false) },
    { text: 'Report and block', style: 'destructive', onPress: () => send(t, reason, true) },
  ]);
}

async function send(t: Target, reason: Reason, block: boolean) {
  const { error } = await supabase.rpc('report_user', {
    p_reported: t.userId,
    p_reason: reason,
    p_incident: t.incidentId ?? null,
    p_event: t.eventId ?? null,
    p_block: block,
  });
  if (error) return Alert.alert('Couldn’t send your report', friendlyError(error));
  if (block) {
    notifyBlocked();
    t.onBlocked?.();
  }
  Alert.alert('Thanks for telling us', 'Your report is with the HereO team. If you are in danger now, call your emergency number.');
}

function confirmBlock(t: Target) {
  Alert.alert(`Block ${t.name}?`, `HereO won’t send them to you or you to them, and you won’t see their messages. You can unblock them in Profile.`, [
    { text: 'Cancel', style: 'cancel' },
    {
      text: 'Block',
      style: 'destructive',
      onPress: async () => {
        const { error } = await supabase.rpc('block_user', { p_blocked: t.userId });
        if (error) return Alert.alert('Couldn’t block them', friendlyError(error));
        notifyBlocked();
        t.onBlocked?.();
      },
    },
  ]);
}

const listeners = new Set<() => void>();
function notifyBlocked() {
  listeners.forEach((l) => l());
}

export interface BlockedPerson {
  blocked_id: string;
  created_at: string;
  profiles: { display_name: string } | null;
}

async function fetchBlocked(userId: string): Promise<BlockedPerson[]> {
  const { data } = await supabase
    .from('user_blocks')
    .select('blocked_id, created_at, profiles:blocked_id(display_name)')
    .eq('blocker_id', userId)
    .order('created_at', { ascending: false });
  return (data ?? []) as unknown as BlockedPerson[];
}

/** The people this user has blocked; refreshes after any block. */
export function useBlocked(userId: string | null | undefined) {
  const [blocked, setBlocked] = useState<BlockedPerson[]>([]);
  const [version, setVersion] = useState(0);
  useEffect(() => {
    const bump = () => setVersion((v) => v + 1);
    listeners.add(bump);
    return () => {
      listeners.delete(bump);
    };
  }, []);
  useEffect(() => {
    if (!userId) return;
    let alive = true;
    fetchBlocked(userId).then((b) => alive && setBlocked(b));
    return () => {
      alive = false;
    };
  }, [userId, version]);
  const blockedIds = useMemo(() => new Set(blocked.map((b) => b.blocked_id)), [blocked]);
  const unblock = async (id: string) => {
    if (!userId) return;
    await supabase.from('user_blocks').delete().eq('blocker_id', userId).eq('blocked_id', id);
    notifyBlocked();
  };
  return { blocked, blockedIds, unblock };
}
