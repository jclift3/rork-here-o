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
import { loadPinStatus, saveRingSettings, setRingPin, useRingSettings, type PinStatus } from '@/lib/ring';
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
            {profile?.is_guardian && <Pill label="Hero" color={colors.heroStart} filled />}
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
        title={profile?.is_guardian ? 'Hero settings' : 'Become a hero'}
        detail="Code of conduct and training"
        onPress={() => router.push('/guardian')}
      />

      {session && <RingSettingsSection userId={session.user.id} />}

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
          <Text style={styles.rowTitle}>Also alert nearby heroes if I don’t respond</Text>
          <Body muted>
            A missed check-in always alerts your circle. With this on, if you still haven’t answered 5 minutes later,
            nearby heroes are asked to check on you too. They’re told it’s an unanswered check-in, not a confirmed
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

/** Opts in to being rung, how she sounds, her PINs, and the shortcut that rings with no screen. */
function RingSettingsSection({ userId }: { userId: string }) {
  const ring = useRingSettings();
  const [pins, setPins] = useState<PinStatus | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<'cancel' | 'duress' | null>(null);
  const [pin, setPin] = useState('');
  const [current, setCurrent] = useState('');

  useEffect(() => {
    loadPinStatus().then(setPins);
  }, []);

  const save = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      setPins(await loadPinStatus());
      return true;
    } catch (err) {
      setError(friendlyError(err));
      return false;
    } finally {
      setBusy(false);
    }
  };

  const setOptIn = (on: boolean) => {
    if (!on) return save(() => saveRingSettings(userId, { optIn: false }));
    if (Platform.OS === 'web') return save(() => saveRingSettings(userId, { optIn: true }));
    Alert.alert(
      'Answer the HereO ring?',
      'When someone within about half a mile (a mile if you drive) rings for help, your phone rings too and shows where. HereO checks your location in the background so it can find you. Nobody sees where you are.',
      [
        { text: 'Not now', style: 'cancel' },
        {
          text: 'Turn on',
          onPress: async () => {
            await save(() => saveRingSettings(userId, { optIn: true }));
            const result = await startGuardianBackgroundLocation();
            if (result === 'denied') {
              Alert.alert('Location set to While Using', 'HereO can ring you while the app is open. You can choose Always in Settings.');
            }
          },
        },
      ],
    );
  };

  const savePin = async () => {
    const kind = editing;
    if (!kind) return;
    if (await save(() => setRingPin(kind, pin, current))) {
      setEditing(null);
      setPin('');
      setCurrent('');
    }
  };

  if (!ring) return null;
  return (
    <>
      <SectionLabel>HereO ring</SectionLabel>
      <Card style={styles.row}>
        <View style={{ flex: 1 }}>
          <Text style={styles.rowTitle}>Ring me when someone nearby needs help</Text>
          <Body muted>Go with someone else, knock and call out, stay with them. Never confront anyone.</Body>
        </View>
        <Switch value={ring.optIn} disabled={busy} onValueChange={(v) => void setOptIn(v)} trackColor={{ true: colors.heroStart, false: colors.line }} />
      </Card>
      {ring.optIn && (
        <Choice
          title="How I’d get there"
          options={[
            { value: 'foot', label: 'On foot' },
            { value: 'drive', label: 'I can drive' },
          ]}
          value={ring.travel}
          onChange={(travel) => save(() => saveRingSettings(userId, { travel }))}
        />
      )}
      <Choice
        title="When I ask for help, my phone"
        options={[
          { value: 'loud', label: 'Sounds a siren' },
          { value: 'silent', label: 'Stays silent' },
        ]}
        value={ring.alarmStyle}
        onChange={(alarmStyle) => save(() => saveRingSettings(userId, { alarmStyle }))}
      />
      <Card style={{ gap: space.sm }}>
        <Text style={styles.rowTitle}>PIN to end an alert</Text>
        <Body muted>
          {pins?.has_pin
            ? pins.has_duress
              ? 'Set, with a duress PIN. The duress PIN looks like it ends the alert but keeps help coming and tells your circle.'
              : 'Set. Add a duress PIN for when someone makes you end it: it looks the same, but help keeps coming.'
            : 'Stops anyone else from ending your alert. Without one, “I’m safe” ends it.'}
        </Body>
        {editing ? (
          <>
            {pins?.has_pin && (
              <TextField label="Current PIN" value={current} onChangeText={(t) => setCurrent(t.replace(/\D/g, ''))} keyboardType="number-pad" secureTextEntry maxLength={8} />
            )}
            <TextField
              label={editing === 'duress' ? 'New duress PIN (4 to 8 digits)' : 'New PIN (4 to 8 digits)'}
              value={pin}
              onChangeText={(t) => setPin(t.replace(/\D/g, ''))}
              keyboardType="number-pad"
              secureTextEntry
              maxLength={8}
            />
            <Button label="Save PIN" loading={busy} disabled={pin.length < 4 || (!!pins?.has_pin && current.length < 4)} onPress={savePin} />
            <Button label="Back" variant="ghost" onPress={() => setEditing(null)} />
          </>
        ) : (
          <>
            <Button label={pins?.has_pin ? 'Change PIN' : 'Set a PIN'} variant="outline" onPress={() => setEditing('cancel')} />
            {pins?.has_pin && (
              <Button label={pins.has_duress ? 'Change duress PIN' : 'Add a duress PIN'} variant="outline" onPress={() => setEditing('duress')} />
            )}
          </>
        )}
      </Card>
      {Platform.OS === 'ios' && (
        <Card style={{ gap: space.xs }}>
          <Text style={styles.rowTitle}>Ring without opening HereO</Text>
          <Body muted>In the Shortcuts app, make a shortcut named “HereO ring” with one action: Open URLs, hereo://ring.</Body>
          <Body muted>Then use it for Back Tap (Settings, Accessibility, Touch, Back Tap, Triple Tap), the Action Button, or say “Hey Siri, HereO ring”.</Body>
        </Card>
      )}
      {pins && pins.strikes > 0 && (
        <Card tone="alert">
          <Body>
            {pins.limited
              ? 'Your alerts reach your circle and heroes only, because people nearby reported false alarms. This lifts 30 days after the last one.'
              : 'Someone nearby reported one of your alerts as a false alarm. Another in 30 days limits your alerts to your circle and heroes.'}
          </Body>
        </Card>
      )}
      {error && <Body style={{ color: colors.alert }}>{error}</Body>}
    </>
  );
}

function Choice<T extends string>({
  title,
  options,
  value,
  onChange,
}: {
  title: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <Card style={{ gap: space.sm }}>
      <Text style={styles.rowTitle}>{title}</Text>
      <View style={{ flexDirection: 'row', gap: space.sm }}>
        {options.map((o) => (
          <Button
            key={o.value}
            label={o.label}
            variant={o.value === value ? 'primary' : 'outline'}
            style={{ flex: 1 }}
            onPress={() => onChange(o.value)}
          />
        ))}
      </View>
    </Card>
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
