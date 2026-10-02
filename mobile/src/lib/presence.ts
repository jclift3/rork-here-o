import { useEffect } from 'react';
import { AppState } from 'react-native';

import { getQuickPosition } from './location';
import { supabase } from './supabase';

const HEARTBEAT_MS = 2 * 60_000;

/**
 * While a guardian is marked available and the app is open, share a coarse
 * position every two minutes so dispatch can find them. Positions are only
 * readable by the dispatch function, never by other users.
 *
 * With the app closed, backgroundLocation.ts takes over if the guardian
 * allowed "Always" location.
 */
export function useGuardianPresence(userId: string, available: boolean) {
  useEffect(() => {
    if (!userId || !available) return;
    let stopped = false;
    const beat = async () => {
      if (stopped || AppState.currentState !== 'active') return;
      const pos = await getQuickPosition();
      if (!pos || stopped) return;
      await supabase
        .from('private_profiles')
        .update({ last_lat: pos.lat, last_lng: pos.lng, last_seen_at: new Date().toISOString() })
        .eq('id', userId);
    };
    beat();
    const timer = setInterval(beat, HEARTBEAT_MS);
    const sub = AppState.addEventListener('change', (s) => s === 'active' && beat());
    return () => {
      stopped = true;
      clearInterval(timer);
      sub.remove();
    };
  }, [userId, available]);
}
