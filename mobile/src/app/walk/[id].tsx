import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Check, Plus } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { IncidentMap } from '@/components/IncidentMap';
import { Body, Button, Card, Pill, Screen, Title } from '@/components/ui';
import { call911, raiseAlert } from '@/lib/incidents';
import { watchPosition } from '@/lib/location';
import { useUserId } from '@/lib/session';
import { friendlyError } from '@/lib/supabase';
import { colors, fonts } from '@/lib/theme';
import { arrivedLabel, followerArrivedTitle, followerTitle, TRIP_KINDS, tripTitle } from '@/lib/trips';
import type { Walk } from '@/lib/types';
import {
  clockTime,
  describeDue,
  endWalk,
  extendWalk,
  finishTrip,
  EXTEND_MINUTES,
  GRACE_MINUTES,
  shareWalkLocation,
  useWalk,
} from '@/lib/walks';

const SHARE_EVERY_MS = 30_000;

export default function WalkScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const userId = useUserId();
  const { walk, error, reload } = useWalk(id);
  const now = useNow(15_000);

  if (error || !walk) {
    return (
      <Screen>
        <BackButton />
        <Body muted>{error ?? 'Loading…'}</Body>
      </Screen>
    );
  }
  return walk.user_id === userId ? (
    <WalkerView walk={walk} userId={userId} now={now} reload={reload} />
  ) : (
    <FollowerView walk={walk} userId={userId} now={now} />
  );
}

function WalkerView({ walk, userId, now, reload }: { walk: Walk; userId: string; now: number; reload: () => void }) {
  const active = walk.status === 'active';
  const [busy, setBusy] = useState<string | null>(null);

  // Share position with the circle while the walk is on.
  useEffect(() => {
    if (!active) return;
    let stop = () => {};
    let last = 0;
    watchPosition((c) => {
      if (Date.now() - last < SHARE_EVERY_MS) return;
      last = Date.now();
      shareWalkLocation(walk.id, c.lat, c.lng);
    }).then((s) => (stop = s));
    return () => stop();
  }, [active, walk.id]);

  // The trip ended somewhere else (arrival, the server, another device):
  // stop reminders, background sharing and the Live Activity.
  const lastStatus = useRef(walk.status);
  useEffect(() => {
    if (lastStatus.current === 'active' && walk.status !== 'active') finishTrip(walk, walk.status);
    lastStatus.current = walk.status;
  }, [walk]);

  const run = async (key: string, fn: () => Promise<unknown>) => {
    setBusy(key);
    try {
      await fn();
      reload();
    } catch (err) {
      Alert.alert('Something went wrong', friendlyError(err));
    } finally {
      setBusy(null);
    }
  };

  const getHelp = () =>
    run('help', async () => {
      const incidentId = await raiseAlert({
        userId,
        mode: walk.mode,
        trigger: 'tap',
        note: `Asked for help during a trip (${tripTitle(walk).toLowerCase()}).`,
      });
      await endWalk(walk, 'cancelled');
      router.replace({ pathname: '/incident/[id]', params: { id: incidentId } });
    });

  if (walk.status === 'escalated') {
    return (
      <Screen>
        <BackButton />
        <Card tone="alert">
          <Text style={styles.cardTitle}>You missed your check-in</Text>
          <Body>Your circle has been alerted. If you’re OK, open the request and tap I’m safe.</Body>
        </Card>
        {walk.incident_id && (
          <Button
            label="Open help request"
            variant="primary"
            tall
            onPress={() => router.replace({ pathname: '/incident/[id]', params: { id: walk.incident_id! } })}
          />
        )}
      </Screen>
    );
  }

  if (!active) {
    return (
      <Screen>
        <BackButton />
        <Card tone="safe">
          <Text style={styles.cardTitle}>
            {walk.status === 'arrived' ? arrivedLabel(walk) : `${TRIP_KINDS[walk.kind].label} cancelled`}
          </Text>
          <Body>
            {walk.status !== 'arrived'
              ? 'Your circle is no longer following.'
              : walk.arrived_automatically
                ? 'You reached your destination, so the trip ended and your circle knows you’re safe.'
                : 'Your circle knows you arrived safely.'}
          </Body>
        </Card>
        <Button label="Done" variant="outline" onPress={() => router.replace('/home')} />
      </Screen>
    );
  }

  const late = new Date(walk.due_at).getTime() < now;
  return (
    <Screen>
      <BackButton />
      <Pill label="Your circle is following" color={colors.heroStart} filled />
      <Title>{tripTitle(walk)}</Title>
      <View style={{ gap: 2 }}>
        <Text style={[styles.countdown, late && { color: colors.alert }]}>{describeDue(walk.due_at, now)}</Text>
        <Body muted>
          {late
            ? `Check in now. Your circle is alerted ${GRACE_MINUTES} minutes after ${clockTime(walk.due_at)}.`
            : `Check in by ${clockTime(walk.due_at)}.`}
        </Body>
      </View>

      <IncidentMap lat={walk.lat} lng={walk.lng} label="You" />

      <Button
        label="I’ve arrived"
        variant="primary"
        tall
        loading={busy === 'arrived'}
        icon={<Check color={colors.paper} size={20} />}
        onPress={() => run('arrived', () => endWalk(walk, 'arrived'))}
      />
      <Button
        label={`Add ${EXTEND_MINUTES} minutes`}
        variant="outline"
        loading={busy === 'extend'}
        icon={<Plus color={colors.ink} size={20} />}
        onPress={() => run('extend', () => extendWalk(walk))}
      />
      <Button label="Get help now" variant="hero" tall loading={busy === 'help'} onPress={getHelp} />
      <Button label="Call 911" variant="alert" onPress={() => call911(null, userId, true)} />
      <Button
        label={`Cancel ${TRIP_KINDS[walk.kind].noun}`}
        variant="ghost"
        loading={busy === 'cancel'}
        onPress={() => run('cancel', () => endWalk(walk, 'cancelled'))}
      />
    </Screen>
  );
}

function FollowerView({ walk, userId, now }: { walk: Walk; userId: string; now: number }) {
  const name = walk.profiles?.display_name?.split(' ')[0] || 'They';
  const late = walk.status === 'active' && new Date(walk.due_at).getTime() < now;
  const statusLine =
    walk.status === 'arrived'
      ? `${arrivedLabel(walk)}: ${name} ${walk.arrived_automatically ? 'arrived' : 'checked in'} at ${clockTime(walk.ended_at ?? walk.due_at)}.`
      : walk.status === 'cancelled'
        ? `${name} ended the ${TRIP_KINDS[walk.kind].noun}.`
        : walk.status === 'escalated'
          ? `${name} missed their check-in. HereO has alerted their circle.`
          : late
            ? `${name} is ${describeDue(walk.due_at, now)} checking in.`
            : `${name} will check in by ${clockTime(walk.due_at)}.`;
  // The heading follows the trip: once it ends, it says how it ended.
  const title =
    walk.status === 'arrived'
      ? followerArrivedTitle(name, walk)
      : walk.status === 'escalated'
        ? `${name} missed a check-in`
        : walk.status === 'cancelled'
          ? `${name}’s ${TRIP_KINDS[walk.kind].noun} has ended`
          : followerTitle(name, walk);

  return (
    <Screen>
      <BackButton />
      <Title>{title}</Title>
      <Card tone={walk.status === 'escalated' || late ? 'alert' : walk.status === 'arrived' ? 'safe' : 'mist'}>
        <Body>{statusLine}</Body>
        {walk.location_at && walk.status === 'active' && (
          <Body muted>Location updated {clockTime(walk.location_at)}</Body>
        )}
      </Card>
      {walk.status === 'active' && <IncidentMap lat={walk.lat} lng={walk.lng} label={name} />}
      {walk.status === 'escalated' && walk.incident_id && (
        <Button
          label="Open help request"
          variant="hero"
          tall
          onPress={() => router.replace({ pathname: '/incident/[id]', params: { id: walk.incident_id! } })}
        />
      )}
      {walk.status === 'active' && (
        <>
          <Body muted>If you think {name} is in danger right now, call 911.</Body>
          <Button label="Call 911" variant="alert" onPress={() => call911(null, userId, false)} />
        </>
      )}
    </Screen>
  );
}

function BackButton() {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Back"
      hitSlop={16}
      onPress={() => (router.canGoBack() ? router.back() : router.replace('/home'))}>
      <ArrowLeft color={colors.ink} />
    </Pressable>
  );
}

/** Re-renders on an interval so countdowns stay current. */
function useNow(everyMs: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), everyMs);
    return () => clearInterval(t);
  }, [everyMs]);
  return now;
}

const styles = StyleSheet.create({
  countdown: { fontFamily: fonts.display, fontSize: 44, color: colors.ink },
  cardTitle: { fontFamily: fonts.displayMedium, fontSize: 18, color: colors.ink },
});
