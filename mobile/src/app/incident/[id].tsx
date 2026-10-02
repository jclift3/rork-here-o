import { router, useLocalSearchParams } from 'expo-router';
import { ArrowLeft, Navigation, Phone, Send, Sparkles } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { Alert, KeyboardAvoidingView, Linking, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { IncidentMap } from '@/components/IncidentMap';
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
import { useUserId } from '@/lib/session';
import { friendlyError, supabase } from '@/lib/supabase';
import { colors, fonts, space } from '@/lib/theme';
import type { Responder } from '@/lib/types';

const CONDUCT = "Be present. Don't pursue. Call 911 for danger.";

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
  const active = incident.status === 'active';

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

  const safe = () =>
    Alert.alert("You're safe?", 'Everyone helping will be told they can stand down.', [
      { text: 'Not yet', style: 'cancel' },
      { text: "Yes, I'm safe", onPress: () => closeIncident(incident.id, 'resolved') },
    ]);
  const falseAlarm = () =>
    Alert.alert('Cancel this request?', 'Use this if you pressed by mistake.', [
      { text: 'Keep it open', style: 'cancel' },
      { text: 'Cancel request', style: 'destructive', onPress: () => closeIncident(incident.id, 'cancelled') },
    ]);

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
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <Screen edges={[]} style={{ paddingBottom: space.lg }}>
          <BackButton />
          <Title style={{ color: active ? colors.alert : colors.safe }}>{headline}</Title>
          <BriefCard bundle={bundle} />
          <IncidentMap lat={incident.lat} lng={incident.lng} label="You" />
          <SectionLabel>{responders.length ? 'Who knows' : 'Finding people nearby'}</SectionLabel>
          {responders.map((r) => (
            <ResponderRow key={r.user_id} responder={r} />
          ))}
          {!active && <ThankHelpers bundle={bundle} userId={userId} />}
          <Timeline bundle={bundle} userId={userId} />
          {active && <Button label="I pressed by mistake" variant="ghost" onPress={falseAlarm} />}
        </Screen>
        {active && (
          <View style={styles.dock}>
            <MessageBox incidentId={incident.id} userId={userId} />
            <View style={styles.dockButtons}>
              <Button
                label="Call 911"
                variant="alert"
                tall
                style={{ flex: 1 }}
                icon={<Phone color={colors.paper} size={20} />}
                onPress={() => call911(incident.id, userId, true)}
              />
              <Button label="I'm safe" variant="safe" tall style={{ flex: 1 }} onPress={safe} />
            </View>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function ResponderView({ bundle, userId }: { bundle: IncidentBundle; userId: string }) {
  const { incident, responders, events } = bundle;
  const me = responders.find((r) => r.user_id === userId);
  const active = incident.status === 'active';
  const requesterName = events.find((e) => e.kind === 'created')?.profiles?.display_name?.split(' ')[0] ?? 'They';
  const [busy, setBusy] = useState(false);

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
            {me && <Pill label={me.kind === 'circle' ? 'Your circle' : 'Guardian'} color={colors.heroStart} />}
          </View>
          <Title style={{ fontSize: 30 }}>{active ? `${requesterName} needs help` : 'This request is closed'}</Title>
          {me?.role && active && (
            <Card style={{ borderWidth: 2, borderColor: colors.heroStart, backgroundColor: colors.paper }}>
              <Text style={styles.cardLabel}>YOUR JOB</Text>
              <Text style={styles.role}>{me.role}</Text>
              <Body muted>{CONDUCT}</Body>
            </Card>
          )}
          <BriefCard bundle={bundle} />
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
                label="911"
                variant="alert"
                tall
                style={{ flex: me.status === 'on_scene' || me.status === 'declined' ? 1 : 0.7 }}
                icon={<Phone color={colors.paper} size={18} />}
                onPress={() => call911(incident.id, userId, false)}
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
      <Text style={styles.brief} accessibilityLiveRegion="polite">{incident.brief ?? 'Alerting your circle and finding guardians nearby…'}</Text>
    </Card>
  );
}

function ResponderRow({ responder }: { responder: Responder }) {
  const name = responder.profiles?.display_name || (responder.kind === 'circle' ? 'Circle member' : 'Guardian');
  const color =
    responder.status === 'on_scene' ? colors.safe : responder.status === 'en_route' ? colors.heroStart : colors.muted;
  return (
    <View style={styles.responder}>
      <Avatar name={name} size={40} color={responder.kind === 'guardian' ? colors.heroStart : colors.ink} />
      <View style={{ flex: 1 }}>
        <Text style={styles.responderName}>{name.split(' ')[0]}</Text>
        <Body muted style={{ fontSize: 14 }}>{responder.kind === 'circle' ? 'Your circle' : 'Guardian'}</Body>
      </View>
      <Pill label={RESPONDER_STATUS_LABEL[responder.status]} color={color} filled={responder.status !== 'notified'} />
    </View>
  );
}

function Timeline({ bundle, userId }: { bundle: IncidentBundle; userId: string }) {
  const items = useMemo(
    () => bundle.events.filter((e) => e.kind === 'message' || e.kind === 'escalated_911' || (e.kind === 'created' && e.body)),
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
            {!mine && <Text style={styles.bubbleName}>{e.profiles?.display_name?.split(' ')[0] ?? 'HereO'}</Text>}
            <Text style={{ color: mine ? colors.paper : colors.ink, fontSize: 16 }}>{e.body}</Text>
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
