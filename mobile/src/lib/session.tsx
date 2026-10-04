import type { Session } from '@supabase/supabase-js';
import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';

import { supabase } from './supabase';
import type { Profile } from './types';

interface SessionState {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  /** Signed in, but this user's profile hasn't loaded yet (just after sign-in). */
  profileLoading: boolean;
  refreshProfile: () => Promise<void>;
}

const SessionContext = createContext<SessionState>({
  session: null,
  profile: null,
  loading: true,
  profileLoading: false,
  refreshProfile: async () => {},
});

export function SessionProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);
  // Whose profile the current `profile` is, once loaded (even if there's no row).
  const [loadedFor, setLoadedFor] = useState<string | null>(null);

  const loadProfile = useCallback(async (userId: string | undefined) => {
    if (!userId) {
      setProfile(null);
      setLoadedFor(null);
      return;
    }
    const { data } = await supabase
      .from('profiles')
      .select('id, display_name, her_o_verified, is_guardian, guardian_available')
      .eq('id', userId)
      .maybeSingle<Profile>();
    setProfile(data ?? null);
    setLoadedFor(userId);
  }, []);

  useEffect(() => {
    supabase.auth.getSession().then(async ({ data }) => {
      setSession(data.session);
      await loadProfile(data.session?.user.id);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      loadProfile(next?.user.id);
    });
    return () => sub.subscription.unsubscribe();
  }, [loadProfile]);

  const refreshProfile = useCallback(() => loadProfile(session?.user.id), [loadProfile, session]);
  const profileLoading = !!session && loadedFor !== session.user.id;

  return (
    <SessionContext.Provider value={{ session, profile, loading, profileLoading, refreshProfile }}>{children}</SessionContext.Provider>
  );
}

export function useSession() {
  return useContext(SessionContext);
}

/** The signed-in user's id. Only call below the auth gate. */
export function useUserId(): string {
  const { session } = useSession();
  return session?.user.id ?? '';
}
