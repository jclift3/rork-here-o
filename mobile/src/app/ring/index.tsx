import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';

import { Body, Button, Screen, Title } from '@/components/ui';
import { call911, raiseAlert } from '@/lib/incidents';
import { useMode } from '@/lib/mode';
import { useSession } from '@/lib/session';
import { friendlyError } from '@/lib/supabase';

/**
 * hereo://ring. Back Tap, the Action Button and "Hey Siri, HereO ring" open
 * this through a Shortcut ("Open URL"), and it raises a help request straight
 * away, exactly like holding the button.
 */
export default function RingNow() {
  const { session, loading } = useSession();
  const { mode } = useMode();
  const started = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (loading || started.current) return;
    if (!session) {
      router.replace('/welcome');
      return;
    }
    started.current = true;
    raiseAlert({ userId: session.user.id, mode, trigger: 'hold' })
      .then((id) => router.replace({ pathname: '/incident/[id]', params: { id } }))
      .catch((err) => setError(friendlyError(err)));
  }, [loading, session, mode]);

  return (
    <Screen>
      <Title>{error ? 'Your alert didn’t send' : 'Sending your alert…'}</Title>
      {error && (
        <>
          <Body>{error}</Body>
          <Body>If you are in danger, call 911.</Body>
          <Button label="Call 911" variant="alert" tall onPress={() => call911(null, session?.user.id ?? '', true)} />
        </>
      )}
    </Screen>
  );
}
