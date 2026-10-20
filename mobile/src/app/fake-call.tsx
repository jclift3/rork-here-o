import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { Phone, PhoneOff, X } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Text, Vibration, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Body, Button, Screen, SectionLabel, TextField, Title } from '@/components/ui';
import { colors, fonts, radius, space, touchTarget } from '@/lib/theme';

const DELAYS = [
  { label: 'Now', seconds: 0 },
  { label: '10 sec', seconds: 10 },
  { label: '30 sec', seconds: 30 },
  { label: '1 min', seconds: 60 },
] as const;

const NOTIFICATION_ID = 'fake-call';

type Phase = 'setup' | 'waiting' | 'ringing' | 'talking';

/**
 * A believable incoming call, for leaving a conversation or a situation
 * without escalating it. Nothing is dialed and no one is alerted.
 */
export default function FakeCall() {
  const [caller, setCaller] = useState('Mom');
  const [delay, setDelay] = useState<number>(10);
  const [phase, setPhase] = useState<Phase>('setup');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
      Vibration.cancel();
      cancelNotification();
    },
    [],
  );

  const schedule = async () => {
    if (delay === 0) {
      ring();
      return;
    }
    setPhase('waiting');
    timer.current = setTimeout(ring, delay * 1000);
    // Rings through the lock screen too.
    if (Platform.OS !== 'web') {
      await Notifications.scheduleNotificationAsync({
        identifier: NOTIFICATION_ID,
        content: { title: caller.trim() || 'Mom', body: 'Incoming call', sound: 'default' },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL, seconds: delay },
      }).catch(() => {});
    }
  };

  const ring = () => {
    setPhase('ringing');
    Vibration.vibrate([0, 900, 700], true);
  };

  const stop = () => {
    if (timer.current) clearTimeout(timer.current);
    Vibration.cancel();
    cancelNotification();
  };

  if (phase === 'ringing') {
    return (
      <CallScreen caller={caller} subtitle="mobile">
        <View style={styles.callActions}>
          <RoundButton
            label="Decline"
            color={colors.alert}
            icon={<PhoneOff color={colors.paper} size={30} />}
            onPress={() => {
              stop();
              router.back();
            }}
          />
          <RoundButton
            label="Accept"
            color={colors.safe}
            icon={<Phone color={colors.paper} size={30} />}
            onPress={() => {
              stop();
              setPhase('talking');
            }}
          />
        </View>
      </CallScreen>
    );
  }

  if (phase === 'talking') {
    return (
      <CallScreen caller={caller} subtitle={<CallTimer />}>
        <View style={styles.callActions}>
          <RoundButton
            label="End"
            color={colors.alert}
            icon={<PhoneOff color={colors.paper} size={30} />}
            onPress={() => router.back()}
          />
        </View>
      </CallScreen>
    );
  }

  if (phase === 'waiting') {
    return (
      <Screen>
        <Title>Call scheduled</Title>
        <Body muted>
          {caller.trim() || 'Mom'} will call in {DELAYS.find((d) => d.seconds === delay)?.label}. You can put your phone
          away.
        </Body>
        <Button
          label="Cancel call"
          variant="outline"
          onPress={() => {
            stop();
            setPhase('setup');
          }}
        />
      </Screen>
    );
  }

  return (
    <Screen>
      <Pressable accessibilityRole="button" accessibilityLabel="Close" hitSlop={16} onPress={() => router.back()}>
        <X color={colors.ink} />
      </Pressable>
      <Title>Fake call</Title>
      <Body muted>Get a realistic incoming call so you have a reason to step away. Nobody is alerted.</Body>
      <SectionLabel>Who’s calling</SectionLabel>
      <TextField value={caller} onChangeText={setCaller} maxLength={30} />
      <SectionLabel>When</SectionLabel>
      <View style={styles.chips} accessibilityRole="radiogroup">
        {DELAYS.map((d) => {
          const on = d.seconds === delay;
          return (
            <Pressable
              key={d.seconds}
              accessibilityRole="radio"
              accessibilityState={{ checked: on }}
              onPress={() => setDelay(d.seconds)}
              style={[styles.chip, on && styles.chipOn]}>
              <Text style={[styles.chipText, on && { color: colors.paper }]}>{d.label}</Text>
            </Pressable>
          );
        })}
      </View>
      <Button label={delay === 0 ? 'Ring now' : 'Schedule call'} variant="primary" tall onPress={schedule} />
    </Screen>
  );
}

function CallScreen({ caller, subtitle, children }: { caller: string; subtitle: React.ReactNode; children: React.ReactNode }) {
  return (
    <SafeAreaView style={styles.call} edges={['top', 'bottom']}>
      <View style={{ alignItems: 'center', gap: space.sm, paddingTop: space.xxl }}>
        <View style={styles.callAvatar}>
          <Text style={styles.callAvatarText}>{(caller.trim() || 'M')[0].toUpperCase()}</Text>
        </View>
        <Text style={styles.callName}>{caller.trim() || 'Mom'}</Text>
        {typeof subtitle === 'string' ? <Text style={styles.callSub}>{subtitle}</Text> : subtitle}
      </View>
      {children}
    </SafeAreaView>
  );
}

function CallTimer() {
  const [seconds, setSeconds] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, []);
  const mm = Math.floor(seconds / 60);
  const ss = String(seconds % 60).padStart(2, '0');
  return <Text style={styles.callSub}>{`${mm}:${ss}`}</Text>;
}

function RoundButton({ label, color, icon, onPress }: { label: string; color: string; icon: React.ReactNode; onPress: () => void }) {
  return (
    <View style={{ alignItems: 'center', gap: space.sm }}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={label}
        onPress={onPress}
        style={({ pressed }) => [styles.round, { backgroundColor: color, opacity: pressed ? 0.8 : 1 }]}>
        {icon}
      </Pressable>
      <Text style={styles.callSub}>{label}</Text>
    </View>
  );
}

function cancelNotification() {
  if (Platform.OS !== 'web') Notifications.cancelScheduledNotificationAsync(NOTIFICATION_ID).catch(() => {});
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: {
    minHeight: touchTarget,
    minWidth: 80,
    paddingHorizontal: space.md,
    borderWidth: 2,
    borderColor: colors.ink,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipOn: { backgroundColor: colors.ink },
  chipText: { fontFamily: fonts.displayMedium, fontSize: 16, color: colors.ink },
  call: { flex: 1, backgroundColor: '#1C1C22', justifyContent: 'space-between', paddingBottom: space.xxl },
  callAvatar: {
    width: 96,
    height: 96,
    borderRadius: 48,
    backgroundColor: '#3A3A44',
    alignItems: 'center',
    justifyContent: 'center',
  },
  callAvatarText: { color: colors.paper, fontSize: 40, fontWeight: '600' },
  callName: { color: colors.paper, fontSize: 34, fontWeight: '500' },
  callSub: { color: '#C7C7CF', fontSize: 17 },
  callActions: { flexDirection: 'row', justifyContent: 'space-evenly' },
  round: { width: 76, height: 76, borderRadius: 38, alignItems: 'center', justifyContent: 'center' },
});
