import { router } from 'expo-router';
import { Footprints, X } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Body, Button, Screen, SectionLabel, TextField, Title } from '@/components/ui';
import { useMode } from '@/lib/mode';
import { useUserId } from '@/lib/session';
import { friendlyError } from '@/lib/supabase';
import { colors, fonts, radius, space, touchTarget } from '@/lib/theme';
import { DURATIONS, GRACE_MINUTES, startWalk } from '@/lib/walks';

/** Walk with me: a check-in timer your circle can follow. */
export default function StartWalk() {
  const userId = useUserId();
  const { mode } = useMode();
  const [minutes, setMinutes] = useState<number>(15);
  const [destination, setDestination] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = async () => {
    setBusy(true);
    setError(null);
    try {
      const id = await startWalk({ userId, mode, minutes, destination });
      router.replace({ pathname: '/walk/[id]', params: { id } });
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Pressable accessibilityRole="button" accessibilityLabel="Close" hitSlop={16} onPress={() => router.back()}>
        <X color={colors.ink} />
      </Pressable>
      <Footprints color={colors.heroStart} size={32} />
      <Title>Walk with me</Title>
      <Body muted>
        Your circle can follow along until you check in. If you don’t check in on time, HereO alerts them and nearby
        guardians {GRACE_MINUTES} minutes later.
      </Body>

      <SectionLabel>Where are you going?</SectionLabel>
      <TextField
        value={destination}
        onChangeText={setDestination}
        placeholder="Home, the train, Sam’s place"
        maxLength={120}
        returnKeyType="done"
      />

      <SectionLabel>Check in within</SectionLabel>
      <View style={styles.chips} accessibilityRole="radiogroup">
        {DURATIONS.map((m) => {
          const on = m === minutes;
          return (
            <Pressable
              key={m}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              onPress={() => setMinutes(m)}
              style={[styles.chip, on && styles.chipOn]}>
              <Text style={[styles.chipText, on && { color: colors.paper }]}>{m} min</Text>
            </Pressable>
          );
        })}
      </View>

      {error && <Body style={{ color: colors.alert }}>{error}</Body>}
      <Button label="Start walk" variant="hero" tall loading={busy} onPress={start} />
      <Body muted style={{ textAlign: 'center' }}>
        You can add time or check in early from the walk screen.
      </Body>
    </Screen>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: {
    minHeight: touchTarget,
    minWidth: 88,
    paddingHorizontal: space.md,
    borderWidth: 2,
    borderColor: colors.ink,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipOn: { backgroundColor: colors.ink },
  chipText: { fontFamily: fonts.displayMedium, fontSize: 16, color: colors.ink },
});
