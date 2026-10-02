import { router } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { Avatar, Body, Button, Card, Pill, Screen, SectionLabel, TextField, Title } from '@/components/ui';
import {
  isGuardianBackgroundLocationOn,
  startGuardianBackgroundLocation,
  stopGuardianBackgroundLocation,
} from '@/lib/backgroundLocation';
import { useSession } from '@/lib/session';
import { friendlyError, supabase } from '@/lib/supabase';
import { colors, fonts, space } from '@/lib/theme';

export default function Profile() {
  const { session, profile, refreshProfile } = useSession();
  const [name, setName] = useState(profile?.display_name ?? '');
  const [error, setError] = useState<string | null>(null);
  const [background, setBackground] = useState<boolean | null>(null);

  useEffect(() => {
    isGuardianBackgroundLocationOn().then(setBackground);
  }, [profile?.guardian_available]);

  const update = async (patch: { display_name?: string; guardian_available?: boolean }) => {
    if (!session) return;
    const { error } = await supabase.from('profiles').update(patch).eq('id', session.user.id);
    setError(error ? friendlyError(error) : null);
    await refreshProfile();
  };

  const setAvailable = async (on: boolean) => {
    await update({ guardian_available: on });
    if (!on) {
      await stopGuardianBackgroundLocation();
      setBackground(false);
      return;
    }
    if (Platform.OS === 'web') return;
    // Apple and Google require a clear explanation before the "Always" prompt.
    Alert.alert(
      'Stay reachable with HereO closed?',
      'HereO can check your location in the background while you’re available, so it can send you to someone nearby. Nobody sees where you are, and it stops when you turn availability off.',
      [
        { text: 'Only while open', style: 'cancel' },
        {
          text: 'Continue',
          onPress: async () => {
            const result = await startGuardianBackgroundLocation();
            setBackground(result === 'on');
            if (result === 'denied') {
              Alert.alert('Location set to While Using', 'HereO can reach you while the app is open. You can choose Always in Settings.');
            }
          },
        },
      ],
    );
  };

  return (
    <Screen>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.md }}>
        <Avatar name={profile?.display_name ?? '?'} size={64} />
        <View style={{ gap: 4 }}>
          <Title style={{ fontSize: 28 }}>{profile?.display_name}</Title>
          <View style={{ flexDirection: 'row', gap: space.sm }}>
            {profile?.is_guardian && <Pill label="Guardian" color={colors.heroStart} filled />}
            {profile?.her_o_verified && <Pill label="Her-O verified" color={colors.herO} filled />}
          </View>
        </View>
      </View>

      {profile?.is_guardian && (
        <Card style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={styles.rowTitle}>Available to respond</Text>
            <Body muted>While on, HereO can send you to people nearby. Your location is never shown to anyone.</Body>
            {profile.guardian_available && background != null && Platform.OS !== 'web' && (
              <Body muted style={{ marginTop: 4 }}>
                {background ? 'Reachable even with HereO closed.' : 'Reachable while HereO is open.'}
              </Body>
            )}
          </View>
          <Switch
            value={profile.guardian_available}
            onValueChange={(v) => setAvailable(v)}
            trackColor={{ true: colors.heroStart, false: colors.line }}
          />
        </Card>
      )}

      <SectionLabel>Your people</SectionLabel>
      <LinkRow title="Circle" detail="Who hears first when you need help" onPress={() => router.push('/circle')} />
      <LinkRow
        title={profile?.is_guardian ? 'Guardian settings' : 'Become a guardian'}
        detail="Code of conduct and training"
        onPress={() => router.push('/guardian')}
      />

      <SectionLabel>Name</SectionLabel>
      <TextField value={name} onChangeText={setName} maxLength={60} />
      <Button label="Save name" variant="outline" disabled={!name.trim() || name === profile?.display_name} onPress={() => update({ display_name: name.trim() })} />
      {error && <Body style={{ color: colors.alert }}>{error}</Body>}

      <SectionLabel>Her-O</SectionLabel>
      <LinkRow
        title="Her-O verification"
        detail={profile?.her_o_verified ? 'Verified' : 'For women who want to respond to Her-O requests'}
        onPress={() => router.push('/verify')}
      />

      <Button label="Sign out" variant="ghost" onPress={async () => {
          await stopGuardianBackgroundLocation();
          await supabase.auth.signOut();
          router.replace('/welcome');
        }} />
    </Screen>
  );
}

function LinkRow({ title, detail, onPress }: { title: string; detail: string; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} accessibilityRole="button">
      <Card style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={styles.rowTitle}>{title}</Text>
          <Body muted>{detail}</Body>
        </View>
        <ChevronRight color={colors.ink} />
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  rowTitle: { fontFamily: fonts.displayMedium, fontSize: 17, color: colors.ink },
});
