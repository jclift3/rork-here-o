import * as Location from 'expo-location';
import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Navigation, Phone } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Alert, Linking, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { IncidentMap } from '@/components/IncidentMap';
import { Body, Button, Card, Pill, Screen, Title } from '@/components/ui';
import { getQuickPosition } from '@/lib/location';
import {
  compassDirection,
  describeRingDistance,
  reportFalseRing,
  respondToRing,
  useRingCard,
  type RingCard,
} from '@/lib/ring';
import { useUserId } from '@/lib/session';
import { friendlyError } from '@/lib/supabase';
import { colors, space } from '@/lib/theme';

/**
 * What a HereO user nearby sees when they are rung: where, how far, how many
 * others are going, and one tap to get there. Never who she is. The pin goes
 * away when the alert ends.
 */
export default function RingScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const userId = useUserId();
  const { card, missing, reload } = useRingCard(id, userId);

  if (!card) {
    return (
      <Screen>
        <BackButton />
        <Body muted>{missing ? 'This alert is not available to you.' : 'Loading…'}</Body>
      </Screen>
    );
  }
  return card.active ? <ActiveRing card={card} reload={reload} /> : <EndedRing card={card} reload={reload} />;
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

function useWhere(card: RingCard) {
  const [address, setAddress] = useState<string | null>(null);
  const [fromMe, setFromMe] = useState<{ distance: number; direction: string } | null>(null);
  const { lat, lng } = card;
  useEffect(() => {
    if (lat == null || lng == null) return;
    let live = true;
    Location.reverseGeocodeAsync({ latitude: lat, longitude: lng })
      .then(([a]) => {
        if (!live || !a) return;
        const street = [a.streetNumber, a.street].filter(Boolean).join(' ');
        setAddress([street || a.name, a.city].filter(Boolean).join(', ') || null);
      })
      .catch(() => {});
    getQuickPosition().then((me) => {
      if (!live || !me) return;
      const dLat = ((lat - me.lat) * Math.PI) / 180;
      const dLng = ((lng - me.lng) * Math.PI) / 180;
      const a =
        Math.sin(dLat / 2) ** 2 + Math.cos((me.lat * Math.PI) / 180) * Math.cos((lat * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
      setFromMe({ distance: 2 * 6371000 * Math.asin(Math.sqrt(a)), direction: compassDirection(me, { lat, lng }) });
    });
    return () => {
      live = false;
    };
  }, [lat, lng]);
  return { address, fromMe };
}

function ActiveRing({ card, reload }: { card: RingCard; reload: () => void }) {
  const { address, fromMe } = useWhere(card);
  const [busy, setBusy] = useState(false);
  const drive = card.travel === 'drive';

  const directions = () => {
    if (card.lat == null || card.lng == null) return;
    const q = `${card.lat},${card.lng}`;
    Linking.openURL(
      Platform.OS === 'ios'
        ? `http://maps.apple.com/?daddr=${q}&dirflg=${drive ? 'd' : 'w'}`
        : `https://www.google.com/maps/dir/?api=1&destination=${q}&travelmode=${drive ? 'driving' : 'walking'}&dir_action=navigate`,
    );
  };
  const respond = async (status: 'en_route' | 'on_scene' | 'declined') => {
    setBusy(true);
    try {
      await respondToRing(card.incident_id, status);
      if (status === 'en_route') directions();
      reload();
    } catch (err) {
      Alert.alert('Could not update', friendlyError(err));
    }
    setBusy(false);
  };

  const distance = fromMe ? describeRingDistance(fromMe.distance) : describeRingDistance(card.distance_m);
  const others = card.going;

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <Screen edges={[]} style={{ paddingBottom: space.lg }}>
        <BackButton />
        <View style={{ flexDirection: 'row', gap: space.sm }}>
          <Pill label="HereO ring" color={colors.alert} filled />
          {card.her_o && <Pill label="Her-O" color={colors.herO} filled />}
        </View>
        <Title style={{ fontSize: 30 }}>Someone nearby needs help</Title>
        <Body>
          {distance}
          {fromMe ? `, to the ${fromMe.direction}` : ''}
          {address ? ` · ${address}` : ''}
        </Body>
        <IncidentMap lat={card.lat} lng={card.lng} label="Needs help" />
        <Body muted>
          {others === 0 ? 'Nobody has said they’re going yet.' : `${others} ${others === 1 ? 'other person is' : 'others are'} going.`}
        </Body>
        <Card style={{ borderWidth: 2, borderColor: colors.heroStart, backgroundColor: colors.paper, gap: space.xs }}>
          <Text style={styles.cardLabel}>WHAT TO DO</Text>
          {drive && <Body>Park first.</Body>}
          <Body>Go with at least one other person if you can.</Body>
          <Body>Knock and call out. Stay with them until they’re OK.</Body>
          <Body>Call 911 if anyone sees danger. Never confront anyone.</Body>
        </Card>
        {card.my_status === 'en_route' && (
          <Button label={drive ? 'Driving directions' : 'Walking directions'} variant="outline" icon={<Navigation size={18} color={colors.ink} />} onPress={directions} />
        )}
        <Button label="Report a false alarm" variant="ghost" onPress={() => confirmReport(card, reload)} disabled={card.false_alarm_reported} />
      </Screen>
      <View style={styles.dock}>
        {card.my_status === 'notified' && (
          <>
            <Button label="I’m going" variant="hero" tall style={{ flex: 2 }} loading={busy} onPress={() => respond('en_route')} />
            <Button label="Can’t go" variant="outline" tall style={{ flex: 1 }} onPress={() => respond('declined')} />
          </>
        )}
        {card.my_status === 'en_route' && (
          <Button label="I’m here" variant="hero" tall style={{ flex: 2 }} loading={busy} onPress={() => respond('on_scene')} />
        )}
        <Button
          label="911"
          variant="alert"
          tall
          style={{ flex: 1 }}
          icon={<Phone color={colors.paper} size={18} />}
          onPress={() => Linking.openURL('tel:911')}
        />
      </View>
    </SafeAreaView>
  );
}

function EndedRing({ card, reload }: { card: RingCard; reload: () => void }) {
  return (
    <Screen>
      <BackButton />
      <Title style={{ color: colors.safe }}>All clear</Title>
      <Body>This alert has ended. Thank you for being ready to help.</Body>
      {card.false_alarm_reported ? (
        <Body muted>You reported this as a false alarm.</Body>
      ) : (
        <Button label="Report a false alarm" variant="ghost" onPress={() => confirmReport(card, reload)} />
      )}
      <Button label="Done" onPress={() => router.replace('/home')} />
    </Screen>
  );
}

function confirmReport(card: RingCard, reload: () => void) {
  Alert.alert(
    'Report a false alarm?',
    'Use this if you got there and nobody needed help, or the alert was a prank. Repeated false alarms limit who an account can ring.',
    [
      { text: 'Back', style: 'cancel' },
      {
        text: 'Report',
        style: 'destructive',
        onPress: async () => {
          try {
            await reportFalseRing(card.incident_id);
            reload();
          } catch (err) {
            Alert.alert('Could not report', friendlyError(err));
          }
        },
      },
    ],
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  dock: {
    flexDirection: 'row',
    gap: space.sm,
    padding: space.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
    backgroundColor: colors.paper,
  },
  cardLabel: { fontSize: 12, fontWeight: '800', letterSpacing: 1.2, color: colors.ink },
});
