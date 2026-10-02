import { router } from 'expo-router';
import { useState } from 'react';

import { Body, Button, Card, Screen, SectionLabel, TextField, Title } from '@/components/ui';
import { useSession } from '@/lib/session';
import { friendlyError, supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';

export default function Onboarding() {
  const { session, refreshProfile } = useSession();
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    if (!session) return;
    setBusy(true);
    const { error } = await supabase.from('profiles').update({ display_name: name.trim() }).eq('id', session.user.id);
    setBusy(false);
    if (error) return setError(friendlyError(error));
    await refreshProfile();
    router.replace('/home');
  };

  return (
    <Screen>
      <Title>Welcome to HereO</Title>
      <Body>
        HereO connects you with the people you trust and trained guardians nearby. Hold the help button and they know where
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
      {error && <Body style={{ color: colors.alert }}>{error}</Body>}
      <SectionLabel>How it works</SectionLabel>
      <Card>
        <Body>1. Hold the gradient button for two seconds, from any screen.</Body>
        <Body>2. Your circle gets your location right away.</Body>
        <Body>3. Nearby guardians get a short, specific job from HereO’s AI coordinator.</Body>
        <Body>4. Everyone sees one live brief. Call 911 is always one tap away.</Body>
      </Card>
    </Screen>
  );
}
