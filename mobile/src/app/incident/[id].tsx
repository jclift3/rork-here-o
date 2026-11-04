import { router, useLocalSearchParams } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ArrowLeft, MapPin, Navigation, Phone, Send, Sparkles } from 'lucide-react-native';
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Alert, KeyboardAvoidingView, Linking, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  GradientPanel,
  Label,
  StatusBackdrop,
  LiveMap,
  ModelChip,
  night,
  night_styles,
  Panel,
  PersonRow,
  Sheet,
  Tracker,
  walkTime,
  type StepState,
} from '@/components/MissionControl';
import { modelName, MuseCoordinator } from '@/components/MuseCoordinator';
import { SceneCard, TalkToHereO } from '@/components/MuseReport';
import { AlarmOverlay, PinSheet } from '@/components/RingAlarm';
import { Body, Button, Screen, Title } from '@/components/ui';
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
import { colors, space } from '@/lib/theme';
import type { IncidentEvent, Responder } from '@/lib/types';

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
  const raeScroll = useRef<ScrollView>(null);

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
    : coming.some((r) => r.status === 'on_scene')
      ? 'Help is with you'
      : coming.length
        ? 'Help is on the way'
        : incident.dispatched_at
          ? 'Your alert is out'
          : 'Sending your alert…';
  const firstComing = coming[0];
  const arrived = coming.some((r) => r.status === 'on_scene');
  const sub = firstComing
    ? `${firstName(firstComing)} ${firstComing.status === 'on_scene' ? 'is with you' : `is coming${firstComing.distance_m != null ? `, ${walkTime(firstComing.distance_m)}` : ''}`}.`
    : active
      ? 'Your circle has been told. HereO is finding heroes near you.'
      : '';

  return (
    <View style={styles.root}>
      <ScrollToTopWhen when={arrived || !active} scrollRef={raeScroll} />
      <StatusBar style="light" />
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
        <ScrollView ref={raeScroll} style={{ flex: 1 }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1 }}>
          <LiveMap lat={incident.lat} lng={incident.lng} label="You" active={active} />
          <Sheet>
            <Label color={active ? '#FF6B6E' : '#3CCB7F'}>{active ? `● LIVE · ${num} READY` : 'CLOSED'}</Label>
            <Text accessibilityRole="header" style={night_styles.headline}>
              {headline}
            </Text>
            {!!sub && <Text style={night_styles.sub}>{sub}</Text>}
            <Tracker steps={trackerSteps(bundle)} />
            <BriefCard bundle={bundle} />
            {active && <TalkToHereO incidentId={incident.id} />}
            <SceneCard path={incident.scene_path ?? null} events={bundle.events} title="What helpers see" />
            {responders.length > 0 && (
              <Panel>
                <Label>{active ? 'WHO KNOWS' : 'WHO WAS THERE'}</Label>
                {responders.map((r) => (
                  <ResponderRow key={r.user_id} responder={r} />
                ))}
              </Panel>
            )}
            {active && <NeighboursComing incidentId={incident.id} />}
            <MuseCoordinator incidentId={incident.id} responders={responders} />
            {!active && <ThankHelpers bundle={bundle} userId={userId} />}
            <Timeline bundle={bundle} userId={userId} />
            {active && <Button label="I pressed by mistake" variant="ghost" onPress={() => ask('cancelled')} />}
          </Sheet>
        </ScrollView>
        <StatusBackdrop />
        {active && (
          <Dock>
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
              <Button label="I'm safe" variant="safe" tall style={styles.safeButton} onPress={() => ask('resolved')} />
            </View>
          </Dock>
        )}
      </KeyboardAvoidingView>
    </View>
  );
}

/** Brings the top of the screen (headline, tracker) back into view when the moment comes. */
function ScrollToTopWhen({ when, scrollRef }: { when: boolean; scrollRef: React.RefObject<ScrollView | null> }) {
  useEffect(() => {
    if (when) scrollRef.current?.scrollTo({ y: 0, animated: true });
  }, [when, scrollRef]);
  return null;
}

function firstName(r: Responder) {
  return (r.profiles?.display_name || (r.kind === 'circle' ? 'Circle member' : 'A hero')).split(' ')[0];
}

/** Alert out → AI coordinating → hero on the way → with you. */
function trackerSteps({ incident, responders }: IncidentBundle): { label: string; state: StepState }[] {
  const closed = incident.status !== 'active';
  const going = responders.find((r) => r.status === 'en_route' || r.status === 'on_scene');
  const here = responders.some((r) => r.status === 'on_scene');
  const out: StepState = incident.dispatched_at || closed ? 'done' : 'now';
  // The AI stays "on it" until a hero has actually accepted.
  const ai: StepState = going || closed ? 'done' : out === 'done' ? 'now' : 'next';
  const way: StepState = here || (closed && going) ? 'done' : going ? 'now' : 'next';
  const withYou: StepState = here ? (closed ? 'done' : 'now') : 'next';
  return [
    { label: 'Alert out', state: out },
    { label: 'AI on it', state: ai },
    { label: going ? `${firstName(going)} coming` : 'Hero coming', state: way },
    { label: 'With you', state: withYou },
  ];
}

function Dock({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  return <View style={[styles.dock, { paddingBottom: Math.max(insets.bottom, space.md) }]}>{children}</View>;
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
    <Panel>
      <Label>HEREO NEARBY</Label>
      <Text style={night_styles.body}>
        {[
          counts.here ? `${counts.here} ${counts.here === 1 ? 'is' : 'are'} with you` : '',
          counts.going ? `${counts.going} ${counts.going === 1 ? 'is' : 'are'} on the way` : '',
        ]
          .filter(Boolean)
          .join(', ') || `${counts.rung} ${counts.rung === 1 ? 'person' : 'people'} nearby rung`}
        {counts.here || counts.going ? ` (of ${counts.rung} people nearby rung).` : '.'}
      </Text>
    </Panel>
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

  const forHeroes = latestNote(events, 'For heroes: ');
  const withThem = active && me?.status === 'on_scene';
  const niaScroll = useRef<ScrollView>(null);
  const critical = incident.urgency === 'critical';

  return (
    <View style={styles.root}>
      <StatusBar style="light" />
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollToTopWhen when={withThem || !active} scrollRef={niaScroll} />
        <ScrollView ref={niaScroll} style={{ flex: 1 }} keyboardShouldPersistTaps="handled" contentContainerStyle={{ flexGrow: 1 }}>
          <LiveMap lat={incident.lat} lng={incident.lng} label={requesterName} active={active} />
          <Sheet>
            <View style={{ flexDirection: 'row', gap: space.sm, flexWrap: 'wrap', alignItems: 'center' }}>
              <Label color={active ? (critical ? '#FF6B6E' : '#FF7AB8') : night.muted}>
                {active ? `● ${incident.urgency.toUpperCase()} · ${me?.kind === 'circle' ? 'YOUR CIRCLE' : 'HERO ALERT'}` : 'CLOSED'}
              </Label>
              {incident.mode === 'her_o' && <ModelChip label="Her-O" />}
            </View>
            <Text accessibilityRole="header" style={night_styles.headline}>
              {withThem ? `You're with ${requesterName}` : active ? `${requesterName} needs help` : 'This request is closed'}
            </Text>
            {withThem ? (
              <Text style={night_styles.sub}>{requesterName} has been told you&apos;re here. Stay with them until they say they&apos;re safe.</Text>
            ) : (
              active && me?.distance_m != null && <Text style={night_styles.sub}>{walkTime(me.distance_m)} from you</Text>
            )}
            {active && me && me.status !== 'notified' && me.status !== 'declined' && <Tracker steps={heroSteps(me.status, requesterName)} />}
            {active && incident.duress_at && (
              <Panel accent={colors.alert}>
                <Label color="#FF6B6E">DURESS PIN USED</Label>
                <Text style={night_styles.body}>
                  {requesterName} ended the alert with their duress PIN. Their phone shows all clear, but they may not be
                  safe. Call {num} and don&apos;t tell them you know.
                </Text>
              </Panel>
            )}
            {me?.role && active && (
              <GradientPanel>
                <View style={styles.between}>
                  <Label color={night.text}>YOUR JOB</Label>
                  <ModelChip label={modelName(incident.agent_model ?? '')} tone={incident.agent_model?.startsWith('muse') ? 'meta' : 'rules'} />
                </View>
                <Text style={night_styles.big}>{me.role}</Text>
                <Text style={night_styles.sub}>{conduct(num)}</Text>
              </GradientPanel>
            )}
            {active && forHeroes && (
              <Panel accent={colors.heroStart}>
                <View style={styles.between}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <MapPin size={15} color={colors.heroStart} />
                    <Label>WHERE TO FIND {requesterName.toUpperCase()}</Label>
                  </View>
                  <ModelChip label="Muse Spark" />
                </View>
                <Text style={night_styles.body}>{forHeroes}</Text>
              </Panel>
            )}
            <SceneCard path={incident.scene_path ?? null} events={events} title={`Where ${requesterName} is`} />
            {active && incident.lat != null && (
              <Button
                label="Walking directions"
                variant="ghost"
                style={styles.darkGhost}
                icon={<Navigation size={18} color={night.muted} />}
                onPress={directions}
              />
            )}
            <BriefCard bundle={bundle} />
            {responders.length > 0 && (
              <Panel>
                <Label>RESPONDERS</Label>
                {responders.map((r) => (
                  <ResponderRow key={r.user_id} responder={r} me={r.user_id === userId} />
                ))}
              </Panel>
            )}
            <MuseCoordinator incidentId={incident.id} responders={responders} />
            <Timeline bundle={bundle} userId={userId} />
          </Sheet>
        </ScrollView>
        <StatusBackdrop />
        {active && me && (
          <Dock>
            {withThem && (
              <View style={styles.withRow}>
                <View style={styles.withDot} />
                <Text style={styles.withText}>With {requesterName} · stay close</Text>
              </View>
            )}
            <MessageBox incidentId={incident.id} userId={userId} />
            <View style={styles.dockButtons}>
              {me.status === 'notified' && (
                <>
                  <Button label="I'm on my way" variant="hero" tall style={{ flex: 2 }} loading={busy} onPress={() => setStatus('en_route')} />
                  <Button label="Can't now" variant="ghost" tall style={[{ flex: 1 }, styles.darkGhost]} onPress={() => setStatus('declined')} />
                </>
              )}
              {me.status === 'en_route' && (
                <Button label="I'm with them" variant="hero" tall style={{ flex: 1 }} loading={busy} onPress={() => setStatus('on_scene')} />
              )}
              <Button
                label={me.status === 'on_scene' || me.status === 'declined' ? `Call ${num}` : num}
                variant="alert"
                tall
                style={{ flex: me.status === 'on_scene' || me.status === 'declined' ? 1 : 0.7 }}
                icon={me.status === 'on_scene' || me.status === 'declined' ? <Phone color={colors.paper} size={18} /> : undefined}
                onPress={() => call911(incident.id, userId, false, num)}
              />
            </View>
          </Dock>
        )}
      </KeyboardAvoidingView>
    </View>
  );
}

/** The hero's own progress: alerted → on the way → with them. */
function heroSteps(status: Responder['status'], name: string): { label: string; state: StepState }[] {
  const here = status === 'on_scene';
  return [
    { label: 'Alerted', state: 'done' },
    { label: 'On the way', state: here ? 'done' : 'now' },
    { label: `With ${name}`, state: here ? 'now' : 'next' },
  ];
}

/** The coordinator's latest note for one audience, without its prefix. */
function latestNote(events: IncidentEvent[], prefix: string): string | null {
  const e = [...events].reverse().find((x) => x.kind === 'agent' && x.body?.startsWith(prefix));
  return e?.body ? e.body.slice(prefix.length) : null;
}

function BriefCard({ bundle }: { bundle: IncidentBundle }) {
  const { incident } = bundle;
  const urgent = incident.call_911_recommended && incident.status === 'active';
  return (
    <Panel accent={urgent ? colors.alert : colors.heroStart}>
      <View style={styles.between}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
          <Sparkles size={15} color={urgent ? colors.alert : colors.heroStart} />
          <Label>LIVE BRIEF</Label>
        </View>
        {incident.brief && <ModelChip label={modelName(incident.agent_model ?? 'muse-spark')} tone={urgent ? 'alert' : 'meta'} />}
      </View>
      <Text style={night_styles.big} accessibilityLiveRegion="polite">
        {incident.brief ?? 'Alerting your circle and finding heroes nearby…'}
      </Text>
    </Panel>
  );
}

function ResponderRow({ responder, me }: { responder: Responder; me?: boolean }) {
  const color =
    responder.status === 'on_scene' ? '#3CCB7F' : responder.status === 'en_route' ? '#FF7AB8' : responder.status === 'declined' ? night.faint : night.muted;
  const sub = [
    me ? 'You' : responder.kind === 'circle' ? 'Circle' : 'Hero',
    responder.distance_m != null && responder.status !== 'on_scene' ? walkTime(responder.distance_m) : null,
  ]
    .filter(Boolean)
    .join(' · ');
  return (
    <PersonRow
      name={firstName(responder)}
      sub={sub}
      status={RESPONDER_STATUS_LABEL[responder.status]}
      statusColor={color}
      hero={responder.kind === 'guardian'}
    />
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
      <Text style={night_styles.section}>MESSAGES</Text>
      {items.map((e) => {
        const mine = e.actor_id === userId;
        const agent = e.kind === 'agent';
        return (
          <View
            key={e.id}
            style={[
              styles.bubble,
              mine ? styles.mine : styles.theirs,
              agent && styles.agentBubble,
              e.kind === 'escalated_911' && styles.alertBubble,
            ]}>
            {!mine && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={styles.bubbleName}>{agent ? 'HereO coordinator' : (e.profiles?.display_name?.split(' ')[0] ?? 'HereO')}</Text>
                {agent && <ModelChip label="Muse Spark" />}
              </View>
            )}
            {e.kind === 'voice' && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={[styles.bubbleName, mine && { color: 'rgba(255,255,255,0.75)' }]}>SAID OUT LOUD</Text>
                <ModelChip label="Muse Voice" />
              </View>
            )}
            <Text style={{ color: night.text, fontSize: 16, lineHeight: 22 }}>{e.kind === 'voice' ? `“${e.body}”` : e.body}</Text>
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
        placeholderTextColor={night.faint}
        style={styles.messageInput}
        maxLength={1000}
        onSubmitEditing={send}
        returnKeyType="send"
      />
      <Pressable accessibilityRole="button" accessibilityLabel="Send" onPress={send} hitSlop={8} style={styles.sendButton}>
        <Send size={20} color={night.text} />
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
  if (!helpers.length || sent) return sent ? <Text style={night_styles.body}>Thanks sent.</Text> : null;
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
  root: { flex: 1, backgroundColor: night.bg },
  dock: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: night.line,
    paddingHorizontal: space.md,
    paddingTop: space.md,
    gap: space.sm,
    backgroundColor: night.card,
  },
  dockButtons: { flexDirection: 'row', gap: space.sm },
  safeButton: { flex: 1, backgroundColor: 'transparent', borderColor: colors.safe },
  withRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  withDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.safe },
  withText: { color: '#3CCB7F', fontSize: 14, fontWeight: '800', letterSpacing: 0.3 },
  darkGhost: { borderColor: night.line, borderWidth: 1.5 },
  between: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  bubble: { padding: 12, borderRadius: 16, maxWidth: '88%', gap: 4 },
  mine: { alignSelf: 'flex-end', backgroundColor: colors.heroStart },
  theirs: { alignSelf: 'flex-start', backgroundColor: night.raised },
  agentBubble: { borderWidth: 1, borderColor: 'rgba(232,51,139,0.4)', backgroundColor: night.card },
  alertBubble: { backgroundColor: 'rgba(229,37,42,0.22)' },
  bubbleName: { fontSize: 12, fontWeight: '700', color: night.muted },
  messageBox: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  messageInput: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: night.line,
    backgroundColor: night.bg,
    borderRadius: 14,
    minHeight: 48,
    paddingHorizontal: 14,
    fontSize: 16,
    color: night.text,
  },
  sendButton: { width: 48, height: 48, backgroundColor: night.raised, alignItems: 'center', justifyContent: 'center', borderRadius: 14 },
});
