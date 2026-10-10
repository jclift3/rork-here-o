import { router, useLocalSearchParams } from 'expo-router';
import { Bike, ChevronRight, Footprints, House, X } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Body, Button, Card, Screen, SectionLabel, TextField, Title } from '@/components/ui';
import { useMode } from '@/lib/mode';
import { useUserId } from '@/lib/session';
import { friendlyError, supabase } from '@/lib/supabase';
import { colors, fonts, radius, space, touchTarget } from '@/lib/theme';
import { isTripKind, loadTripSettings, TRIP_KINDS, type TripSettings } from '@/lib/trips';
import type { TripKind } from '@/lib/types';
import { DURATIONS, startWalk } from '@/lib/walks';

const KIND_ICONS = { walk: Footprints, run: Footprints, ride: Bike } as const;

/**
 * Start a trip: a walk, run or ride your circle follows until you check in.
 * hereo://walk?go=1&kind=run (the widget) starts one straight away, heading
 * home when a home is saved.
 */
export default function StartTrip() {
  const params = useLocalSearchParams<{ go?: string; kind?: string }>();
  const userId = useUserId();
  const { mode } = useMode();
  const initialKind: TripKind = isTripKind(params.kind) ? params.kind : 'walk';
  const [kind, setKind] = useState<TripKind>(initialKind);
  const [minutes, setMinutes] = useState<number>(TRIP_KINDS[initialKind].minutes);
  const [destination, setDestination] = useState('');
  const [settings, setSettings] = useState<TripSettings | null>(null);
  const [circleCount, setCircleCount] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const autoStarted = useRef(false);

  const goingHome = destination.trim().toLowerCase() === 'home';

  const start = async (opts?: { kind: TripKind; minutes: number; destination: string; settings: TripSettings | null }) => {
    const o = opts ?? { kind, minutes, destination, settings };
    setBusy(true);
    setError(null);
    try {
      // One trip at a time: open the one already running.
      const { data: running } = await supabase
        .from('walks')
        .select('id')
        .eq('user_id', userId)
        .eq('status', 'active')
        .limit(1)
        .maybeSingle();
      if (running) {
        router.replace({ pathname: '/walk/[id]', params: { id: running.id } });
        return;
      }
      const home = o.destination.trim().toLowerCase() === 'home' ? (o.settings?.home ?? null) : null;
      const id = await startWalk({
        userId,
        mode,
        kind: o.kind,
        minutes: o.minutes,
        destination: o.destination,
        destinationPoint: home,
      });
      router.replace({ pathname: '/walk/[id]', params: { id } });
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  useEffect(() => {
    supabase
      .from('circle_members')
      .select('member_id', { count: 'exact', head: true })
      .eq('owner_id', userId)
      .then(({ count }) => setCircleCount(count ?? 0));
  }, [userId]);

  useEffect(() => {
    loadTripSettings(userId).then((s) => {
      setSettings(s);
      if (s.home) setDestination((d) => d || 'Home');
      if (params.go === '1' && !autoStarted.current) {
        autoStarted.current = true;
        start({ kind: initialKind, minutes: TRIP_KINDS[initialKind].minutes, destination: s.home ? 'Home' : '', settings: s });
      }
    });
    // Runs once per open; start reads the values passed to it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userId]);

  const chooseKind = (k: TripKind) => {
    setKind(k);
    setMinutes(TRIP_KINDS[k].minutes);
  };

  const Icon = KIND_ICONS[kind];
  return (
    <Screen>
      <Pressable accessibilityRole="button" accessibilityLabel="Close" hitSlop={16} onPress={() => router.back()}>
        <X color={colors.ink} />
      </Pressable>
      <Icon color={colors.heroStart} size={32} />
      <Title>Start a trip</Title>
      <Body muted>
        Your circle follows along live from the start and hears when you arrive. If you don’t check in on time, HereO
        alerts them.
      </Body>
      {circleCount === 0 && (
        <Pressable accessibilityRole="button" onPress={() => router.push('/circle')}>
          <Card tone="alert" style={styles.row}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.rowTitle}>Nobody is in your circle yet</Text>
              <Body muted>Add someone you trust so they can follow your trip.</Body>
            </View>
            <ChevronRight color={colors.ink} />
          </Card>
        </Pressable>
      )}

      <View style={styles.chips} accessibilityRole="radiogroup">
        {(Object.keys(TRIP_KINDS) as TripKind[]).map((k) => (
          <Chip
            key={k}
            label={TRIP_KINDS[k].label}
            icon={kindIcon(k, k === kind)}
            on={k === kind}
            onPress={() => chooseKind(k)}
          />
        ))}
      </View>

      <SectionLabel>Where are you going?</SectionLabel>
      <View style={styles.chips}>
        <Chip
          label="Home"
          icon={<House size={16} color={goingHome ? colors.paper : colors.ink} />}
          on={goingHome}
          onPress={() => setDestination(goingHome ? '' : 'Home')}
        />
      </View>
      <TextField
        value={destination}
        onChangeText={setDestination}
        placeholder="Home, the gym, Sam’s place"
        maxLength={120}
        returnKeyType="done"
      />
      {goingHome && settings && (
        <Body muted>
          {settings.home
            ? 'The trip ends by itself when you get home, and your circle hears you’re home safe.'
            : 'Set your home in Profile and trips home will end by themselves when you arrive.'}
        </Body>
      )}

      <SectionLabel>Check in within</SectionLabel>
      <View style={styles.chips} accessibilityRole="radiogroup">
        {DURATIONS.map((m) => (
          <Chip key={m} label={`${m} min`} on={m === minutes} onPress={() => setMinutes(m)} />
        ))}
      </View>

      {error && <Body style={{ color: colors.alert }}>{error}</Body>}
      <Button label={`Start ${TRIP_KINDS[kind].noun}`} variant="hero" tall loading={busy} onPress={() => start()} />
      <Body muted style={{ textAlign: 'center' }}>
        You can add time or check in early from the trip screen.
      </Body>
    </Screen>
  );
}

function kindIcon(k: TripKind, on: boolean) {
  const Icon = KIND_ICONS[k];
  return <Icon size={18} color={on ? colors.paper : colors.heroStart} />;
}

function Chip({ label, on, onPress, icon }: { label: string; on: boolean; onPress: () => void; icon?: React.ReactNode }) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ checked: on }}
      onPress={onPress}
      style={[styles.chip, on && styles.chipOn]}>
      {icon}
      <Text style={[styles.chipText, on && { color: colors.paper }]}>{label}</Text>
    </Pressable>
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
    flexDirection: 'row',
    gap: space.xs,
  },
  chipOn: { backgroundColor: colors.ink },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  rowTitle: { fontFamily: fonts.displayMedium, fontSize: 17, color: colors.ink },
  chipText: { fontFamily: fonts.displayMedium, fontSize: 16, color: colors.ink },
});
