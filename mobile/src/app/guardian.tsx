import { router } from 'expo-router';
import { X } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Body, Button, Card, Screen, SectionLabel, Title } from '@/components/ui';
import { useSession } from '@/lib/session';
import { friendlyError, supabase } from '@/lib/supabase';
import { colors, fonts, space } from '@/lib/theme';

const CODE = [
  ['Be present', 'Your job is to show up, be seen, and stay with the person until they are safe.'],
  ['Never pursue', "Don't chase, confront, follow, or restrain anyone. Distance is safety for you and them."],
  ['911 first for danger', 'Weapons, violence, or a medical emergency: call 911 before anything else.'],
  ['Calm is contagious', 'Low voice, open hands, give space. Ask what they need.'],
  ['Privacy', 'What you see in an incident stays in the incident. No photos, no posts.'],
] as const;

/** The guardian code of conduct. Accepting it is what makes someone a guardian. */
export default function Guardian() {
  const { session, profile, refreshProfile } = useSession();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const accept = async () => {
    if (!session) return;
    setBusy(true);
    setError(null);
    const { error: e1 } = await supabase
      .from('guardian_trainings')
      .upsert({ user_id: session.user.id, course: 'code_of_conduct' }, { onConflict: 'user_id,course', ignoreDuplicates: true });
    const { error: e2 } = e1 ? { error: e1 } : await supabase.rpc('become_guardian');
    if (!e2) await supabase.from('profiles').update({ guardian_available: true }).eq('id', session.user.id);
    setBusy(false);
    if (e2) return setError(friendlyError(e2));
    await refreshProfile();
    router.back();
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={() => router.back()} hitSlop={16}>
        <X color={colors.ink} />
      </Pressable>
      <Title>Answer the call</Title>
      <Body>
        Guardians are neighbors who show up. When someone nearby asks for help, HereO may send you with one clear job, like
        “walk to the corner and stay visible” or “call her and stay on the line.”
      </Body>
      <SectionLabel>Code of conduct</SectionLabel>
      <Card style={{ gap: space.md }}>
        {CODE.map(([title, detail]) => (
          <View key={title}>
            <Text style={styles.rule}>{title}</Text>
            <Body muted>{detail}</Body>
          </View>
        ))}
      </Card>
      {profile?.is_guardian ? (
        <Body>You’re a guardian. Turn availability on or off from your profile.</Body>
      ) : (
        <Button label="I agree. Make me a guardian" variant="hero" tall onPress={accept} loading={busy} />
      )}
      {error && <Body style={{ color: colors.alert }}>{error}</Body>}
      <Body muted style={{ fontSize: 14 }}>
        Guardians aren’t police or security and have no special authority. You can say no to any request.
      </Body>
    </Screen>
  );
}

const styles = StyleSheet.create({
  rule: { fontFamily: fonts.displayMedium, fontSize: 17, color: colors.ink },
});
