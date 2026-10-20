import { router, useFocusEffect } from 'expo-router';
import { X } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { Pressable } from 'react-native';

import { Body, Button, Card, Pill, Screen, SectionLabel, TextField, Title } from '@/components/ui';
import { useSession, useUserId } from '@/lib/session';
import { friendlyError, supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';
import type { HerOVerification } from '@/lib/types';

/**
 * Her-O verification request. Her-O requests only go to verified women, so
 * the HereO team reviews each request (service role) before approving it.
 */
export default function Verify() {
  const userId = useUserId();
  const { profile, refreshProfile } = useSession();
  const [request, setRequest] = useState<HerOVerification | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase.from('her_o_verifications').select('*').eq('user_id', userId).maybeSingle();
    setRequest(data as HerOVerification | null);
    setLoaded(true);
    refreshProfile();
  }, [userId, refreshProfile]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const submit = async () => {
    setBusy(true);
    setError(null);
    const { error } = await supabase.from('her_o_verifications').insert({ user_id: userId, note: note.trim() || null });
    setBusy(false);
    if (error) setError(friendlyError(error));
    else load();
  };

  return (
    <Screen>
      <Pressable accessibilityRole="button" accessibilityLabel="Close" hitSlop={16} onPress={() => router.back()}>
        <X color={colors.ink} />
      </Pressable>
      <Title>Her-O verification</Title>
      <Body muted>
        In Her-O mode, a woman asking for help is only sent women heroes who have been verified. Verification is
        how we keep that promise.
      </Body>

      {profile?.her_o_verified ? (
        <Card tone="safe">
          <Pill label="Verified" color={colors.safe} filled />
          <Body>You can respond to Her-O requests and they can reach you.</Body>
        </Card>
      ) : !loaded ? (
        <Body muted>Loading…</Body>
      ) : request?.status === 'pending' ? (
        <Card>
          <Pill label="Under review" color={colors.herO} filled />
          <Body>
            We received your request on {new Date(request.submitted_at).toLocaleDateString()}. The HereO team will email
            you to arrange a quick identity check.
          </Body>
        </Card>
      ) : request?.status === 'declined' ? (
        <Card tone="alert">
          <Body>We couldn’t verify you this time.{request.review_note ? ` ${request.review_note}` : ''}</Body>
          <Body muted>Questions? Reply to the email from the HereO team.</Body>
        </Card>
      ) : (
        <>
          <SectionLabel>How it works</SectionLabel>
          <Body>1. Send a request below.</Body>
          <Body>2. The HereO team emails you to arrange a quick identity check.</Body>
          <Body>3. Once approved, a Her-O badge shows on your profile.</Body>
          <SectionLabel>Anything we should know? (optional)</SectionLabel>
          <TextField
            value={note}
            onChangeText={setNote}
            placeholder="e.g. Evenings are easiest for me"
            multiline
            maxLength={500}
            style={{ minHeight: 80, paddingTop: 14, textAlignVertical: 'top' }}
          />
          {error && <Body style={{ color: colors.alert }}>{error}</Body>}
          <Button label="Request verification" variant="primary" loading={busy} onPress={submit} />
        </>
      )}
    </Screen>
  );
}
