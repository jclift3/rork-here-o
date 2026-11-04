import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Navigation, Phone, Send, Sparkles } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Linking, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { IncidentMap } from '@/components/IncidentMap';
import { MuseCoordinator } from '@/components/MuseCoordinator';
import { SceneCard, TalkToHereO } from '@/components/MuseReport';
import { AlarmOverlay, PinSheet } from '@/components/RingAlarm';
import { Avatar, Body, Button, Card, Pill, Screen, SectionLabel, Title } from '@/components/ui';
import {
  call911,
  closeIncident,
  RESPONDER_STATUS_LABEL,
  sendMessage,
  setResponderStatus,
  updateIncidentLocation,
  useIncident,
  type IncidentBundle,
} from '@/lib/incidents';
import { watchPosition } from '@/lib/location';
import { emergencyNumber } from '@/lib/muse';
import { disarmRing, endHelpRequest, loadPinStatus, notifyRingEnded, useDuress, useRingFlow, type PinStatus } from '@/lib/ring';
import { useUserId } from '@/lib/session';
import { friendlyError, supabase } from '@/lib/supabase';
import { colors, fonts, space } from '@/lib/theme';
import type { Responder } from '@/lib/types';

const conduct = (n: string) => `Be present. Don't pursue. Call ${n} for danger.`;

/**
 * One live screen for everyone in an incident. The person who asked sees who
 * is coming and keeps Call 911 / I'm safe under their thumb; a responder sees
 * their job, the person's location, and their own status buttons.
 */
export default function IncidentScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const userId = useUserId();
  const { bundle, error } = useIncident(id);

  if (error) {
    return (
      <Screen>
        <BackButton />
        <Body>{error}</Body>
      </Screen>
    );
  }
  if (!bundle) {
    return (
      <Screen>
        <BackButton />
        <Body muted>Loading…</Body>
      </Screen>
    );
  }
  return bundle.incident.requester_id === userId ? (
    <RequesterView bundle={bundle} userId={userId} />
  ) : (
    <ResponderView bundle={bundle} userId={userId} />
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

function RequesterView({ bundle, userId }: { bundle: IncidentBundle; userId: string }) {
  const { incident, responders } = bundle;
  const duress = useDuress(incident.id);
  const flow = useRingFlow();
  const [pinStatus, setPinStatus] = useState<PinStatus | null>(null);
  const [ending, setEnding] = useState<'resolved' | 'cancelled' | null>(null);
  // Set once she ends it here, with her PIN or her duress PIN: both look the same.
  const [ended, setEnded] = useState<'resolved' | 'cancelled' | null>(null);
  // The tap that hides the alarm screen can land on the buttons under it; ignore those briefly.
  const [hiddenAt, setHiddenAt] = useState(0);
  const justHidden = () => Date.now() - hiddenAt < 700;
  const active = incident.status === 'active';
  const num = emergencyNumber(incident.lat, incident.lng);

  useEffect(() => {
    loadPinStatus().then(setPinStatus);
  }, []);

  // Keep sharing location while the request is open.
  useEffect(() => {
    if (!active) return;
    let stop = () => {};
    let last = 0;
    watchPosition((c) => {
      if (Date.now() - last < 10_000) return;
      last = Date.now();
      updateIncidentLocation(incident.id, c.lat, c.lng);
    }).then((s) => (stop = s));
    return () => stop();
  }, [active, incident.id]);

  // Closed from another device: make sure the siren stops here too.
  useEffect(() => {
    if (!active && flow.incidentId === incident.id) disarmRing();
  }, [active, flow.incidentId, incident.id]);

  const end = async (status: 'resolved' | 'cancelled', pin: string | null): Promise<string | null> => {
    try {
      await endHelpRequest(incident.id, status, pin);
      setEnding(null);
      // Same screen whether the PIN was real or duress.
      setEnded(status);
      return null;
    } catch (err) {
      return friendlyError(err);
    }
  };
  const ask = (status: 'resolved' | 'cancelled') => {
    if (justHidden()) return;
    if (pinStatus?.has_pin) return setEnding(status);
    const failed = (message: string | null) => message && Alert.alert('Could not close your request', message);
    if (status === 'resolved') {
      Alert.alert("You're safe?", 'Everyone helping will be told they can stand down.', [
        { text: 'Not yet', style: 'cancel' },
        { text: "Yes, I'm safe", onPress: async () => failed(await end('resolved', null)) },
      ]);
    } else {
      Alert.alert('Cancel this request?', 'Use this if you pressed by mistake.', [
        { text: 'Keep it open', style: 'cancel' },
        { text: 'Cancel request', style: 'destructive', onPress: async () => failed(await end('cancelled', null)) },
      ]);
    }
  };
  // Inside the 3 second window nobody nearby has been rung yet, so no PIN.
  const cancelWindow = async () => {
    disarmRing();
    try {
      await closeIncident(incident.id, 'cancelled');
      notifyRingEnded(incident.id);
      setEnded('cancelled');
    } catch (err) {
      Alert.alert('Could not cancel', friendlyError(err));
    }
  };

  if (ended || duress) return <SafeNow cancelled={ended === 'cancelled'} />;

  const coming = responders.filter((r) => r.status === 'en_route' || r.status === 'on_scene');
  const headline = !active
    ? incident.status === 'resolved'
      ? "You're safe"
      : 'Request cancelled'
    : coming.length
      ? 'Help is on the way'
      : incident.dispatched_at
        ? 'Your alert is out'
        : 'Sending your alert…';

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      {active && flow.incidentId === incident.id && (
        <AlarmOverlay
          emergencyNumber={num}
          onCall911={() => call911(incident.id, userId, true, num)}
          onImOk={() => ask('resolved')}
          onCancelWindow={cancelWindow}
          onHide={() => setHiddenAt(Date.now())}
        />
      )}
      <PinSheet
        visible={ending != null}
        title={ending === 'cancelled' ? 'Enter your PIN to cancel' : 'Enter your PIN to end your alert'}
        onSubmit={(pin) => end(ending ?? 'resolved', pin)}
        onClose={() => setEnding(null)}
      />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Screen edges={[]} style={{ paddingBottom: space.lg }}>
          <BackButton />
          <Title style={{ color: active ? colors.alert : colors.safe }}>{headline}</Title>
          <BriefCard bundle={bundle} />
          {active && <TalkToHereO incidentId={incident.id} />}
          <MuseCoordinator incidentId={incident.id} responders={responders} />
          <IncidentMap lat={incident.lat} lng={incident.lng} label="You" />
          {active && <NeighboursComing incidentId={incident.id} />}
          <SectionLabel>{responders.length ? 'Who knows' : 'Finding people nearby'}</SectionLabel>
          {responders.map((r) => (
            <ResponderRow key={r.user_id} responder={r} />
          ))}
          {!active && <ThankHelpers bundle={bundle} userId={userId} />}
          <Timeline bundle={bundle} userId={userId} />
          {active && <Button label="I pressed by mistake" variant="ghost" onPress={() => ask('cancelled')} />}
        </Screen>
        {active && (
          <View style={styles.dock}>
            <MessageBox incidentId={incident.id} userId={userId} />
            <View style={styles.dockButtons}>
              <Button
                label={`Call ${num}`}
                variant="alert"
                tall
                style={{ flex: 1 }}
                icon={<Phone color={colors.paper} size={20} />}
                onPress={() => !justHidden() && call911(incident.id, userId, true, num)}
              />
              <Button label="I'm safe" variant="safe" tall style={{ flex: 1 }} onPress={() => ask('resolved')} />
            </View>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/** What she sees after ending her request, with her PIN or her duress PIN alike. */
function SafeNow({ cancelled }: { cancelled: boolean }) {
  useEffect(() => disarmRing(), []);
  return (
    <Screen>
      <Title style={{ color: colors.safe }}>{cancelled ? 'Alert cancelled' : 'You’re safe'}</Title>
      <Body>
        {cancelled
          ? 'Anyone who was alerted has been told it was a mistake.'
          : 'Everyone who was helping has been told they can stand down.'}
      </Body>
      <Button label="Done" variant="primary" onPress={() => router.replace('/home')} />
    </Screen>
  );
}

/** How many HereO users nearby were rung and are on their way. Never who. */
function NeighboursComing({ incidentId }: { incidentId: string }) {
  const [counts, setCounts] = useState<{ rung: number; going: number; here: number } | null>(null);
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase.from('ring_responders').select('status').eq('incident_id', incidentId);
      if (!data) return;
      setCounts({
        rung: data.length,
        going: data.filter((r) => r.status === 'en_route').length,
        here: data.filter((r) => r.status === 'on_scene').length,
      });
    };
    load();
    const channel = supabase
      .channel(`ring-count:${incidentId}:${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'ring_responders', filter: `incident_id=eq.${incidentId}` }, load)
      .subscribe();
    const poll = setInterval(load, 15_000);
    return () => {
      clearInterval(poll);
      supabase.removeChannel(channel);
    };
  }, [incidentId]);
  if (!counts?.rung) return null;
  return (
    <Card>
      <Text style={styles.cardLabel}>HEREO NEARBY</Text>
      <Body>
        {[
          counts.here ? `${counts.here} ${counts.here === 1 ? 'is' : 'are'} with you` : '',
          counts.going ? `${counts.going} ${counts.going === 1 ? 'is' : 'are'} on the way` : '',
        ]
          .filter(Boolean)
          .join(', ') || `${counts.rung} ${counts.rung === 1 ? 'person' : 'people'} nearby rung`}
        {counts.here || counts.going ? ` (of ${counts.rung} people nearby rung).` : '.'}
      </Body>
    </Card>
  );
}

function ResponderView({ bundle, userId }: { bundle: IncidentBundle; userId: string }) {
  const { incident, responders, events } = bundle;
  const me = responders.find((r) => r.user_id === userId);
  const active = incident.status === 'active';
  const requesterName = events.find((e) => e.kind === 'created')?.profiles?.display_name?.split(' ')[0] ?? 'They';
  const [busy, setBusy] = useState(false);
  const num = emergencyNumber(incident.lat, incident.lng);

  const setStatus = async (status: Responder['status']) => {
    setBusy(true);
    try {
      await setResponderStatus(incident.id, userId, status);
    } catch (err) {
      Alert.alert('Could not update', friendlyError(err));
    }
    setBusy(false);
  };

  const directions = () => {
    if (incident.lat == null || incident.lng == null) return;
    const q = `${incident.lat},${incident.lng}`;
    Linking.openURL(Platform.OS === 'ios' ? `http://maps.apple.com/?daddr=${q}&dirflg=w` : `https://www.google.com/maps/dir/?api=1&destination=${q}&travelmode=walking`);
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Screen edges={[]} style={{ paddingBottom: space.lg }}>
          <BackButton />
          <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap' }}>
            <Pill label={incident.urgency} color={incident.urgency === 'critical' ? colors.alert : colors.ink} filled />
            {incident.mode === 'her_o' && <Pill label="Her-O" color={colors.herO} filled />}
            {me && <Pill label={me.kind === 'circle' ? 'Your circle' : 'Hero'} color={colors.heroStart} />}
          </View>
          <Title style={{ fontSize: 30 }}>{active ? `${requesterName} needs help` : 'This request is closed'}</Title>
          {active && incident.duress_at && (
            <Card tone="alert">
              <Text style={[styles.cardLabel, { color: colors.alert }]}>DURESS PIN USED</Text>
              <Body>
                {requesterName} ended the alert with their duress PIN. Their phone shows all clear, but they may not be
                safe. Call {num} and don&apos;t tell them you know.
              </Body>
            </Card>
          )}
          {me?.role && active && (
            <Card style={{ borderWidth: 2, borderColor: colors.heroStart, backgroundColor: colors.paper }}>
              <Text style={styles.cardLabel}>YOUR JOB</Text>
              <Text style={styles.role}>{me.role}</Text>
              <Body muted>{conduct(num)}</Body>
            </Card>
          )}
          <BriefCard bundle={bundle} />
          <SceneCard path={incident.scene_path ?? null} events={events} />
          <MuseCoordinator incidentId={incident.id} responders={responders} />
          <IncidentMap lat={incident.lat} lng={incident.lng} label={requesterName} />
          {active && incident.lat != null && (
            <Button label="Walking directions" variant="outline" icon={<Navigation size={18} color={colors.ink} />} onPress={directions} />
          )}
          <SectionLabel>Responders</SectionLabel>
          {responders.map((r) => (
            <ResponderRow key={r.user_id} responder={r} />
          ))}
          <Timeline bundle={bundle} userId={userId} />
        </Screen>
        {active && me && (
          <View style={styles.dock}>
            <MessageBox incidentId={incident.id} userId={userId} />
            <View style={styles.dockButtons}>
              {me.status === 'notified' && (
                <>
                  <Button label="I'm on my way" variant="hero" tall style={{ flex: 2 }} loading={busy} onPress={() => setStatus('en_route')} />
                  <Button label="Can't now" variant="outline" tall style={{ flex: 1 }} onPress={() => setStatus('declined')} />
                </>
              )}
              {me.status === 'en_route' && (
                <Button label="I'm with them" variant="hero" tall style={{ flex: 1 }} loading={busy} onPress={() => setStatus('on_scene')} />
              )}
              <Button
                label={num}
                variant="alert"
                tall
                style={{ flex: me.status === 'on_scene' || me.status === 'declined' ? 1 : 0.7 }}
                icon={<Phone color={colors.paper} size={18} />}
                onPress={() => call911(incident.id, userId, false, num)}
              />
            </View>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function BriefCard({ bundle }: { bundle: IncidentBundle }) {
  const { incident } = bundle;
  const urgent = incident.call_911_recommended && incident.status === 'active';
  return (
    <Card tone={urgent ? 'alert' : undefined}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
        <Sparkles size={16} color={urgent ? colors.alert : colors.heroStart} />
        <Text style={styles.cardLabel}>LIVE BRIEF</Text>
      </View>
      <Text style={styles.brief} accessibilityLiveRegion="polite">{incident.brief ?? 'Alerting your circle and finding heroes nearby…'}</Text>
    </Card>
  );
}

function ResponderRow({ responder }: { responder: Responder }) {
  const name = responder.profiles?.display_name || (responder.kind === 'circle' ? 'Circle member' : 'Hero');
  const color =
    responder.status === 'on_scene' ? colors.safe : responder.status === 'en_route' ? colors.heroStart : colors.muted;
  return (
    <View style={styles.responder}>
      <Avatar name={name} size={40} color={responder.kind === 'guardian' ? colors.heroStart : colors.ink} />
      <View style={{ flex: 1 }}>
        <Text style={styles.responderName}>{name.split(' ')[0]}</Text>
        <Body muted style={{ fontSize: 14 }}>{responder.kind === 'circle' ? 'Your circle' : 'Hero'}</Body>
      </View>
      <Pill label={RESPONDER_STATUS_LABEL[responder.status]} color={color} filled={responder.status !== 'notified'} />
    </View>
  );
}

function Timeline({ bundle, userId }: { bundle: IncidentBundle; userId: string }) {
  const items = useMemo(
    () =>
      bundle.events.filter(
        (e) =>
          e.kind === 'message' ||
          e.kind === 'escalated_911' ||
          e.kind === 'voice' ||
          e.kind === 'agent' ||
          (e.kind === 'created' && e.body),
      ),
    [bundle.events],
  );
  if (!items.length) return null;
  return (
    <>
      <SectionLabel>Messages</SectionLabel>
      {items.map((e) => {
        const mine = e.actor_id === userId;
        return (
          <View key={e.id} style={[styles.bubble, mine ? styles.mine : styles.theirs, e.kind === 'escalated_911' && styles.alertBubble]}>
            {!mine && <Text style={styles.bubbleName}>{e.kind === 'agent' ? 'HereO coordinator' : (e.profiles?.display_name?.split(' ')[0] ?? 'HereO')}</Text>}
            {e.kind === 'voice' && <Text style={[styles.bubbleName, mine && { color: colors.mist }]}>SAID OUT LOUD</Text>}
            <Text style={{ color: mine ? colors.paper : colors.ink, fontSize: 16 }}>{e.kind === 'voice' ? `“${e.body}”` : e.body}</Text>
          </View>
        );
      })}
    </>
  );
}

function MessageBox({ incidentId, userId }: { incidentId: string; userId: string }) {
  const [text, setText] = useState('');
  const send = async () => {
    const body = text.trim();
    if (!body) return;
    setText('');
    try {
      await sendMessage(incidentId, userId, body);
    } catch (err) {
      setText(body);
      Alert.alert('Message not sent', friendlyError(err));
    }
  };
  return (
    <View style={styles.messageBox}>
      <TextInput
        value={text}
        onChangeText={setText}
        placeholder="Message everyone helping"
        placeholderTextColor={colors.muted}
        style={styles.messageInput}
        maxLength={1000}
        onSubmitEditing={send}
        returnKeyType="send"
      />
      <Pressable accessibilityRole="button" accessibilityLabel="Send" onPress={send} hitSlop={8} style={styles.sendButton}>
        <Send size={20} color={colors.paper} />
      </Pressable>
    </View>
  );
}

function ThankHelpers({ bundle, userId }: { bundle: IncidentBundle; userId: string }) {
  // Everyone is "released" once the request closes, so use the timeline to
  // find who actually set out or arrived.
  const acted = new Set(
    bundle.events.filter((e) => e.kind === 'status' && (e.body === 'en_route' || e.body === 'on_scene')).map((e) => e.actor_id),
  );
  const helpers = bundle.responders.filter((r) => acted.has(r.user_id));
  const [sent, setSent] = useState(false);
  if (!helpers.length || sent) return sent ? <Body>Thanks sent.</Body> : null;
  const thank = async () => {
    const rows = helpers.map((h) => ({
      incident_id: bundle.incident.id,
      from_id: userId,
      to_id: h.user_id,
      message: 'Thank you for being there for me.',
    }));
    const { error } = await supabase.from('thanks').upsert(rows, { onConflict: 'incident_id,from_id,to_id', ignoreDuplicates: true });
    if (error) Alert.alert('Could not send thanks', friendlyError(error));
    else setSent(true);
  };
  return <Button label={`Thank ${helpers.length === 1 ? 'your helper' : 'your helpers'}`} variant="hero" onPress={thank} />;
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.paper },
  dock: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
    padding: space.md,
    gap: space.sm,
    backgroundColor: colors.paper,
  },
  dockButtons: { flexDirection: 'row', gap: space.sm },
  cardLabel: { fontSize: 12, fontWeight: '800', letterSpacing: 1.2, color: colors.ink },
  brief: { fontSize: 18, lineHeight: 25, color: colors.ink },
  role: { fontFamily: fonts.displayMedium, fontSize: 20, lineHeight: 27, color: colors.ink },
  responder: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  responderName: { fontFamily: fonts.displayMedium, fontSize: 16, color: colors.ink },
  bubble: { padding: 12, borderRadius: 16, maxWidth: '85%', gap: 2 },
  mine: { alignSelf: 'flex-end', backgroundColor: colors.ink },
  theirs: { alignSelf: 'flex-start', backgroundColor: colors.mist },
  alertBubble: { backgroundColor: colors.alertSoft },
  bubbleName: { fontSize: 12, fontWeight: '700', color: colors.muted },
  messageBox: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  messageInput: { flex: 1, borderWidth: 2, borderColor: colors.ink, minHeight: 48, paddingHorizontal: 14, fontSize: 16, color: colors.ink },
  sendButton: { width: 48, height: 48, backgroundColor: colors.ink, alignItems: 'center', justifyContent: 'center', borderRadius: 12 },
});
