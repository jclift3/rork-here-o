import { router, useFocusEffect } from 'expo-router';
import { ChevronRight, Footprints, PhoneIncoming, ShieldCheck } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';

import { HoldToHelp } from '@/components/HoldToHelp';
import { Body, Card, Pill, Screen, SectionLabel, Title } from '@/components/ui';
import { raiseAlert } from '@/lib/incidents';
import { getQuickPosition } from '@/lib/location';
import { useMode } from '@/lib/mode';
import { useSession, useUserId } from '@/lib/session';
import { friendlyError, supabase } from '@/lib/supabase';
import { colors, fonts, radius, space } from '@/lib/theme';
import type { HelpMode, Incident, Walk } from '@/lib/types';
import { followerTitle, tripTitle } from '@/lib/trips';
import { clockTime, describeDue, loadActiveWalks } from '@/lib/walks';

interface Assignment {
  incident_id: string;
  status: string;
  role: string | null;
  distance_m: number | null;
  incidents: Pick<Incident, 'status' | 'urgency' | 'created_at'> | null;
}

export default function Home() {
  const { profile } = useSession();
  const userId = useUserId();
  const { mode, setMode } = useMode();
  const [nearby, setNearby] = useState<number | null>(null);
  const [circleCount, setCircleCount] = useState(0);
  const [active, setActive] = useState<string | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [walks, setWalks] = useState<Walk[]>([]);

  const load = useCallback(async () => {
    const [mine, circle, assigned, activeWalks] = await Promise.all([
      supabase.from('incidents').select('id').eq('requester_id', userId).eq('status', 'active').maybeSingle(),
      supabase.from('circle_members').select('member_id', { count: 'exact', head: true }).eq('owner_id', userId),
      supabase
        .from('incident_responders')
        .select('incident_id, status, role, distance_m, incidents!inner(status, urgency, created_at)')
        .eq('user_id', userId)
        .in('status', ['notified', 'en_route', 'on_scene'])
        .eq('incidents.status', 'active'),
      loadActiveWalks(),
    ]);
    setWalks(activeWalks);
    setActive(mine.data?.id ?? null);
    setCircleCount(circle.count ?? 0);
    setAssignments((assigned.data ?? []) as unknown as Assignment[]);
    const pos = await getQuickPosition();
    if (pos) {
      const { data } = await supabase.rpc('guardians_nearby_count', {
        p_lat: pos.lat,
        p_lng: pos.lng,
        p_her_o_only: mode === 'her_o',
      });
      setNearby(typeof data === 'number' ? data : null);
    }
  }, [userId, mode]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const sendAlert = async () => {
    try {
      const id = await raiseAlert({ userId, mode, trigger: 'hold' });
      router.push({ pathname: '/incident/[id]', params: { id } });
    } catch (err) {
      Alert.alert("Couldn't send your alert", `${friendlyError(err)}\n\nIf you are in danger, call 911.`);
    }
  };

  return (
    <Screen>
      <View style={styles.header}>
        <Title style={{ fontSize: 30 }}>Hi{profile?.display_name ? `, ${profile.display_name}` : ''}</Title>
        <ModeSwitch mode={mode} onChange={setMode} />
      </View>
      <Body muted>
        {nearby == null ? 'Checking who is nearby…' : `${nearby} ${nearby === 1 ? 'guardian' : 'guardians'} nearby`}
        {` · ${circleCount} in your circle`}
      </Body>

      {active && (
        <Pressable onPress={() => router.push({ pathname: '/incident/[id]', params: { id: active } })}>
          <Card tone="alert" style={styles.row}>
            <Text style={styles.rowTitle}>Your help request is open</Text>
            <ChevronRight color={colors.alert} />
          </Card>
        </Pressable>
      )}

      {assignments.map((a) => (
        <Pressable key={a.incident_id} onPress={() => router.push({ pathname: '/incident/[id]', params: { id: a.incident_id } })}>
          <Card style={{ borderWidth: 2, borderColor: colors.heroStart }}>
            <Pill label={a.status === 'notified' ? 'Someone needs help' : 'You are responding'} color={colors.heroStart} filled />
            {a.role && <Body>{a.role}</Body>}
            <Body muted>{a.distance_m != null ? `${a.distance_m} m away · ` : ''}Tap to open</Body>
          </Card>
        </Pressable>
      ))}

      {walks.map((w) => {
        const mineWalk = w.user_id === userId;
        const name = w.profiles?.display_name?.split(' ')[0] || 'Someone';
        return (
          <Pressable key={w.id} onPress={() => router.push({ pathname: '/walk/[id]', params: { id: w.id } })}>
            <Card style={styles.row}>
              <Footprints color={colors.heroStart} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.rowTitle}>{mineWalk ? `You’re ${lower(tripTitle(w))}` : followerTitle(name, w)}</Text>
                <Body muted>
                  {mineWalk ? `${describeDue(w.due_at)} · check in by ${clockTime(w.due_at)}` : `Due by ${clockTime(w.due_at)}`}
                </Body>
              </View>
              <ChevronRight color={colors.ink} />
            </Card>
          </Pressable>
        );
      })}

      <View style={styles.holdWrap}>
        <HoldToHelp size={220} onComplete={sendAlert} onTap={() => router.push('/help')} />
        <Body muted style={{ textAlign: 'center' }}>
          {mode === 'her_o'
            ? 'Her-O mode: only verified women guardians are sent.'
            : 'Hold for two seconds. Your circle and nearby guardians are alerted.'}
        </Body>
      </View>

      <View style={styles.quickRow}>
        <QuickAction
          label="Start a trip"
          icon={<Footprints color={colors.ink} />}
          disabled={walks.some((w) => w.user_id === userId)}
          onPress={() => router.push('/walk')}
        />
        <QuickAction label="Fake call" icon={<PhoneIncoming color={colors.ink} />} onPress={() => router.push('/fake-call')} />
      </View>

      {circleCount === 0 && (
        <Pressable onPress={() => router.push('/circle')}>
          <Card style={styles.row}>
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={styles.rowTitle}>Add your circle</Text>
              <Body muted>The people you trust most hear first.</Body>
            </View>
            <ChevronRight color={colors.ink} />
          </Card>
        </Pressable>
      )}

      {!profile?.is_guardian && (
        <>
          <SectionLabel>Answer the call</SectionLabel>
          <Pressable onPress={() => router.push('/guardian')}>
            <Card style={styles.row}>
              <ShieldCheck color={colors.heroStart} />
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.rowTitle}>Become a guardian</Text>
                <Body muted>Be the person nearby who shows up.</Body>
              </View>
              <ChevronRight color={colors.ink} />
            </Card>
          </Pressable>
        </>
      )}
    </Screen>
  );
}

function QuickAction({
  label,
  icon,
  onPress,
  disabled,
}: {
  label: string;
  icon: React.ReactNode;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [styles.quick, { opacity: disabled ? 0.4 : pressed ? 0.7 : 1 }]}>
      {icon}
      <Text style={styles.quickLabel}>{label}</Text>
    </Pressable>
  );
}

function ModeSwitch({ mode, onChange }: { mode: HelpMode; onChange: (m: HelpMode) => void }) {
  return (
    <View style={styles.switch} accessibilityRole="radiogroup">
      {(['here_o', 'her_o'] as const).map((m) => {
        const on = mode === m;
        return (
          <Pressable
            key={m}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            onPress={() => onChange(m)}
            style={[styles.switchItem, on && { backgroundColor: m === 'her_o' ? colors.herO : colors.ink }]}>
            <Text style={[styles.switchText, { color: on ? colors.paper : colors.ink }]}>{m === 'her_o' ? 'Her-O' : 'Here-O'}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.sm },
  holdWrap: { alignItems: 'center', gap: space.md, paddingVertical: space.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  rowTitle: { fontFamily: fonts.displayMedium, fontSize: 17, color: colors.ink },
  quickRow: { flexDirection: 'row', gap: space.md },
  quick: {
    flex: 1,
    minHeight: 88,
    borderWidth: 2,
    borderColor: colors.ink,
    borderRadius: radius.card,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
  },
  quickLabel: { fontFamily: fonts.displayMedium, fontSize: 15, color: colors.ink },
  switch: { flexDirection: 'row', borderWidth: 2, borderColor: colors.ink, borderRadius: radius.pill, padding: 2 },
  switchItem: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.pill, minHeight: 36, justifyContent: 'center' },
  switchText: { fontWeight: '800', fontSize: 13 },
});

function lower(s: string) {
  return s.charAt(0).toLowerCase() + s.slice(1);
}
