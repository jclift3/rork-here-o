import { router } from 'expo-router';
import { Linking, Text } from 'react-native';
import { useState } from 'react';

import { Body, Button, Card, Screen, SectionLabel, TextField, Title } from '@/components/ui';
import { startGuardianBackgroundLocation } from '@/lib/backgroundLocation';
import { useEmergencyNumber } from '@/lib/emergency';
import { PRIVACY_URL, TERMS_URL, TERMS_VERSION } from '@/lib/legal';
import { saveRingSettings, type Travel } from '@/lib/ring';
import { useSession } from '@/lib/session';
import { friendlyError, supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';

export default function Onboarding() {
  const { session, refreshProfile } = useSession();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const emergency = useEmergencyNumber();
  const [step, setStep] = useState<'name' | 'ring'>('name');

  const save = async () => {
    if (!session) return;
    setBusy(true);
    const { error } = await supabase.from('profiles').update({ display_name: name.trim() }).eq('id', session.user.id);
    // Record which terms they agreed to by continuing (version and time).
    const { error: termsError } = error ? { error: null } : await supabase.rpc('accept_terms', { p_version: TERMS_VERSION });
    setBusy(false);
    if (termsError) return setError(friendlyError(termsError));
    if (error) return setError(friendlyError(error));
    await refreshProfile();
    setStep('ring');
  };

  const answerRing = async (travel: Travel | null) => {
    if (!session) return;
    if (travel) {
      setBusy(true);
      try {
        await saveRingSettings(session.user.id, { optIn: true, travel });
        await startGuardianBackgroundLocation();
      } catch (err) {
        setBusy(false);
        return setError(friendlyError(err));
      }
      setBusy(false);
    }
    router.replace('/home');
  };

  if (step === 'ring') {
    return (
      <Screen>
        <Title>Answer the HereO ring?</Title>
        <Body>
          When someone close by holds their help button, HereO can ring your phone too and show you where they are. People
          in the same building or street get there in minutes, and help comes faster.
        </Body>
        <Card>
          <Body>• You’re rung only when you’re within about half a mile, or a mile if you drive.</Body>
          <Body>• Go with someone else, knock and call out, and stay with them. Never confront anyone.</Body>
          <Body>• HereO checks your location in the background to find you. Nobody sees where you are.</Body>
        </Card>
        <Button label="Yes, I’d go on foot" variant="hero" loading={busy} onPress={() => answerRing('foot')} />
        <Button label="Yes, I can drive" variant="outline" disabled={busy} onPress={() => answerRing('drive')} />
        <Button label="Not now" variant="ghost" disabled={busy} onPress={() => answerRing(null)} />
        {error && <Body style={{ color: colors.alert }}>{error}</Body>}
        <Body muted>You can change this any time in Profile.</Body>
      </Screen>
    );
  }

  return (
    <Screen>
      <Title>Welcome to HereO</Title>
      <Body>
        HereO connects you with the people you trust and trained heroes nearby. Hold the help button and they know where
        you are within seconds.
      </Body>
      <TextField
        label="What should helpers call you?"
        value={name}
        onChangeText={setName}
        placeholder="First name"
        autoComplete="given-name"
        maxLength={60}
      />
      <Button label="Continue" onPress={save} loading={busy} disabled={!name.trim()} />
      <Body muted>
        By continuing you agree to HereO’s{' '}
        <Text style={{ textDecorationLine: 'underline' }} onPress={() => Linking.openURL(TERMS_URL)}>
          Terms
        </Text>{' '}
        and{' '}
        <Text style={{ textDecorationLine: 'underline' }} onPress={() => Linking.openURL(PRIVACY_URL)}>
          Privacy Policy
        </Text>
        . HereO is not an emergency service: in danger, call {emergency}.
      </Body>
      {error && <Body style={{ color: colors.alert }}>{error}</Body>}
      <SectionLabel>How it works</SectionLabel>
      <Card>
        <Body>1. Hold the gradient button for two seconds, from any screen.</Body>
        <Body>2. Your circle gets your location right away.</Body>
        <Body>3. Nearby heroes get a short, specific job from HereO’s AI coordinator.</Body>
        <Body>4. Everyone sees one live brief. Calling {emergency} is always one tap away.</Body>
      </Card>
    </Screen>
  );
}
