import { router } from 'expo-router';
import { ChevronRight } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Switch, Text, View } from 'react-native';

import { Avatar, Body, Button, Card, Pill, Screen, SectionLabel, TextField, Title } from '@/components/ui';
import {
  isGuardianBackgroundLocationOn,
  startGuardianBackgroundLocation,
  stopGuardianBackgroundLocation,
  stopTripBackgroundLocation,
} from '@/lib/backgroundLocation';
import { getQuickPosition } from '@/lib/location';
import { useSession } from '@/lib/session';
import { friendlyError, supabase } from '@/lib/supabase';
import { colors, fonts, space } from '@/lib/theme';
import { loadTripSettings, saveHome, setAlertGuardians, type TripSettings } from '@/lib/trips';

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

      {session && <TripsSettings userId={session.user.id} />}

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
          await stopTripBackgroundLocation();
          await supabase.auth.signOut();
          router.replace('/welcome');
        }} />
    </Screen>
  );
}

function TripsSettings({ userId }: { userId: string }) {
  const [settings, setSettings] = useState<TripSettings | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadTripSettings(userId).then(setSettings);
  }, [userId]);

  const save = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      setSettings(await loadTripSettings(userId));
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  const setHereAsHome = () =>
    save(async () => {
      const pos = await getQuickPosition(8000);
      if (!pos) throw new Error('We couldn’t find your location. Check that HereO can use it, then try again.');
      await saveHome(userId, pos);
    });

  if (!settings) return null;
  return (
    <>
      <SectionLabel>Trips</SectionLabel>
      <Card style={{ gap: space.sm }}>
        <Text style={styles.rowTitle}>Home</Text>
        <Body muted>
          {settings.home
            ? 'Saved. Trips home end by themselves when you get there, and your circle hears you’re home safe.'
            : 'Save where home is and trips home end by themselves when you arrive. Only HereO uses it.'}
        </Body>
        <Button
          label={settings.home ? 'Update home to where I am now' : 'Set home to where I am now'}
          variant="outline"
          loading={busy}
          onPress={setHereAsHome}
        />
        {settings.home && <Button label="Forget home" variant="ghost" onPress={() => save(() => saveHome(userId, null))} />}
      </Card>
      <Card style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={styles.rowTitle}>Also alert nearby guardians if I don’t respond</Text>
          <Body muted>
            A missed check-in always alerts your circle. With this on, if you still haven’t answered 5 minutes later,
            nearby guardians are asked to check on you too. They’re told it’s an unanswered check-in, not a confirmed
            emergency.
          </Body>
        </View>
        <Switch
          value={settings.alertGuardians}
          disabled={busy}
          onValueChange={(v) => save(() => setAlertGuardians(userId, v))}
          trackColor={{ true: colors.heroStart, false: colors.line }}
        />
      </Card>
      {error && <Body style={{ color: colors.alert }}>{error}</Body>}
    </>
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
