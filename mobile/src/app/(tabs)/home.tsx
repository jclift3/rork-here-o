import { router, useFocusEffect } from 'expo-router';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronRight, Footprints, PhoneIncoming } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { StatusBar } from 'expo-status-bar';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Aurora, Glass } from '@/components/Glass';
import { HoldToHelp } from '@/components/HoldToHelp';
import { Mascot } from '@/components/Mascot';
import { alertSendFailed, raiseAlert } from '@/lib/incidents';
import { getQuickPosition } from '@/lib/location';
import { useMode } from '@/lib/mode';
import { describeRingDistance, loadActiveRings, useDuress, type ActiveRing } from '@/lib/ring';
import { useSession, useUserId } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { colors, fonts, heroGradient, radius, space } from '@/lib/theme';
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
  const insets = useSafeAreaInsets();
  const userId = useUserId();
  const { mode, setMode } = useMode();
  const [nearby, setNearby] = useState<number | null>(null);
  const [circleCount, setCircleCount] = useState(0);
  const [active, setActive] = useState<string | null>(null);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [walks, setWalks] = useState<Walk[]>([]);
  const [rings, setRings] = useState<ActiveRing[]>([]);
  // After her duress PIN the request is still open, but her phone must look closed.
  const duress = useDuress(active);

  const load = useCallback(async () => {
    const [mine, circle, assigned, activeWalks, activeRings] = await Promise.all([
      supabase.from('incidents').select('id').eq('requester_id', userId).eq('status', 'active').maybeSingle(),
      supabase.from('circle_members').select('member_id', { count: 'exact', head: true }).eq('owner_id', userId),
      supabase
        .from('incident_responders')
        .select('incident_id, status, role, distance_m, incidents!inner(status, urgency, created_at)')
        .eq('user_id', userId)
        .in('status', ['notified', 'en_route', 'on_scene'])
        .eq('incidents.status', 'active'),
      loadActiveWalks(),
      loadActiveRings(),
    ]);
    setWalks(activeWalks);
    setRings(activeRings);
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

  // Refresh while the screen is open so a new hero alert shows up even when a
  // push can't arrive (simulators, notifications off).
  useFocusEffect(
    useCallback(() => {
      load();
      const timer = setInterval(load, 10_000);
      return () => clearInterval(timer);
    }, [load]),
  );

  const sendAlert = async () => {
    try {
      const id = await raiseAlert({ userId, mode, trigger: 'hold' });
      router.push({ pathname: '/incident/[id]', params: { id } });
    } catch (err) {
      alertSendFailed(err);
    }
  };

  const nearbyText = nearby == null ? 'Checking who’s nearby…' : `${nearby} ${nearby === 1 ? 'hero' : 'heroes'} nearby`;

  return (
    <View style={styles.root}>
      <Aurora />
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + space.sm }]}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.hello}>Hi{profile?.display_name ? `, ${profile.display_name.split(' ')[0]}` : ''}</Text>
            <Text style={styles.helloSub}>You’re not alone out here.</Text>
          </View>
          <ModeSwitch mode={mode} onChange={setMode} />
        </View>

        <Glass radius={26} style={styles.status}>
          <Mascot size={56} radius={16} />
          <View style={{ flex: 1, gap: 2 }} accessible accessibilityRole="summary">
            <Text style={styles.statusTitle}>{nearbyText}</Text>
            <Text style={styles.statusSub}>
              {circleCount} in your circle{mode === 'her_o' ? ' · Her-O mode' : ''}
            </Text>
          </View>
          <View style={styles.liveDot} />
        </Glass>

        {active && !duress && (
          <Pressable onPress={() => router.push({ pathname: '/incident/[id]', params: { id: active } })}>
            <Glass tint="rgba(229,37,42,0.35)" style={styles.row}>
              <Text style={styles.rowTitle}>Your help request is open</Text>
              <ChevronRight color={colors.paper} />
            </Glass>
          </Pressable>
        )}

        {rings.map((r) => (
          <Pressable key={r.incident_id} onPress={() => router.push({ pathname: '/ring/[id]', params: { id: r.incident_id } })}>
            <Glass tint="rgba(229,37,42,0.3)" style={styles.alertCard}>
              <Text style={styles.alertLabel}>{r.my_status === 'notified' ? '● SOMEONE NEARBY NEEDS HELP' : '● YOU’RE GOING'}</Text>
              <Text style={styles.statusSub}>{describeRingDistance(r.distance_m)} · Tap for the map</Text>
            </Glass>
          </Pressable>
        ))}

        {assignments.map((a) => (
          <Pressable key={a.incident_id} onPress={() => router.push({ pathname: '/incident/[id]', params: { id: a.incident_id } })}>
            <LinearGradient colors={heroGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.assignFrame}>
              <View style={styles.assignInner}>
                <Text style={styles.alertLabel}>{a.status === 'notified' ? '● SOMEONE NEEDS HELP' : '● YOU ARE RESPONDING'}</Text>
                {a.role && <Text style={styles.assignRole}>{a.role}</Text>}
                <Text style={styles.statusSub}>{a.distance_m != null ? `${a.distance_m} m away · ` : ''}Tap to open</Text>
              </View>
            </LinearGradient>
          </Pressable>
        ))}

        {walks.map((w) => {
          const mineWalk = w.user_id === userId;
          const name = w.profiles?.display_name?.split(' ')[0] || 'Someone';
          return (
            <Pressable key={w.id} onPress={() => router.push({ pathname: '/walk/[id]', params: { id: w.id } })}>
              <Glass style={styles.row}>
                <Footprints color={colors.heroStart} />
                <View style={{ flex: 1, gap: 2 }}>
                  <Text style={styles.rowTitle}>{mineWalk ? `You’re ${lower(tripTitle(w))}` : followerTitle(name, w)}</Text>
                  <Text style={styles.statusSub}>
                    {mineWalk ? `${describeDue(w.due_at)} · check in by ${clockTime(w.due_at)}` : `Due by ${clockTime(w.due_at)}`}
                  </Text>
                </View>
                <ChevronRight color={colors.paper} />
              </Glass>
            </Pressable>
          );
        })}

        <View style={styles.holdWrap}>
          <HoldToHelp size={230} glow onComplete={sendAlert} onTap={() => router.push('/help')} />
          <Text style={styles.holdHint}>
            {mode === 'her_o'
              ? 'Her-O mode: only verified women heroes are sent.'
              : 'Hold for two seconds. Your circle and nearby heroes are alerted.'}
          </Text>
        </View>

        <View style={styles.quickRow}>
          <QuickAction
            label="Start a trip"
            icon={<Footprints color={colors.paper} />}
            disabled={walks.some((w) => w.user_id === userId)}
            onPress={() => router.push('/walk')}
          />
          <QuickAction label="Fake call" icon={<PhoneIncoming color={colors.paper} />} onPress={() => router.push('/fake-call')} />
        </View>

        {circleCount === 0 && (
          <Pressable onPress={() => router.push('/circle')}>
            <Glass style={styles.row}>
              <View style={{ flex: 1, gap: 2 }}>
                <Text style={styles.rowTitle}>Add your circle</Text>
                <Text style={styles.statusSub}>The people you trust most hear first.</Text>
              </View>
              <ChevronRight color={colors.paper} />
            </Glass>
          </Pressable>
        )}

        {!profile?.is_guardian && (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Become a hero"
            onPress={() => router.push('/guardian')}
            style={({ pressed }) => ({ opacity: pressed ? 0.85 : 1 })}>
            <Glass radius={26} style={styles.invite}>
              <View style={{ flex: 1, gap: space.sm }}>
                <Text style={styles.inviteTitle}>Will you answer the call?</Text>
                <Text style={styles.statusSub}>Be the person nearby who shows up.</Text>
                <LinearGradient colors={heroGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.invitePill}>
                  <Text style={styles.invitePillText}>Become a hero</Text>
                </LinearGradient>
              </View>
              <Mascot size={96} radius={20} />
            </Glass>
          </Pressable>
        )}
      </ScrollView>
    </View>
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
      style={({ pressed }) => [{ flex: 1 }, { opacity: disabled ? 0.4 : pressed ? 0.7 : 1 }]}>
      <Glass radius={22} style={styles.quick} interactive>
        {icon}
        <Text style={styles.quickLabel}>{label}</Text>
      </Glass>
    </Pressable>
  );
}

function ModeSwitch({ mode, onChange }: { mode: HelpMode; onChange: (m: HelpMode) => void }) {
  return (
    <Glass radius={999} style={styles.switch}>
      <View style={{ flexDirection: 'row' }} accessibilityRole="radiogroup">
      {(['here_o', 'her_o'] as const).map((m) => {
        const on = mode === m;
        return (
          <Pressable
            key={m}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            onPress={() => onChange(m)}
            style={[styles.switchItem, on && { backgroundColor: m === 'her_o' ? colors.herO : 'rgba(255,255,255,0.22)' }]}>
            <Text style={[styles.switchText, { color: on ? colors.paper : 'rgba(255,255,255,0.6)' }]}>{m === 'her_o' ? 'Her-O' : 'Here-O'}</Text>
          </Pressable>
        );
      })}
      </View>
    </Glass>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#07070B' },
  content: { padding: space.md, gap: space.md, paddingBottom: 130 },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: space.xs },
  hello: { fontFamily: fonts.display, fontSize: 32, color: colors.paper, letterSpacing: -0.5 },
  helloSub: { fontSize: 15, color: 'rgba(255,255,255,0.6)', marginTop: 2 },
  status: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.sm + 4 },
  statusTitle: { fontFamily: fonts.display, fontSize: 20, color: colors.paper },
  statusSub: { fontSize: 15, color: 'rgba(255,255,255,0.68)' },
  liveDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#3CCB7F',
    marginRight: space.sm,
    shadowColor: '#3CCB7F',
    shadowOpacity: 1,
    shadowRadius: 8,
  },
  alertCard: { padding: space.md, gap: 6 },
  alertLabel: { fontSize: 12, fontWeight: '800', letterSpacing: 1.4, color: colors.paper },
  assignFrame: { borderRadius: 24, padding: 2, shadowColor: colors.heroStart, shadowOpacity: 0.6, shadowRadius: 20 },
  assignInner: { backgroundColor: 'rgba(14,10,18,0.86)', borderRadius: 22, padding: space.md, gap: 6 },
  assignRole: { fontFamily: fonts.displayMedium, fontSize: 18, lineHeight: 24, color: colors.paper },
  invite: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md },
  inviteTitle: { fontFamily: fonts.display, fontSize: 22, lineHeight: 27, color: colors.paper },
  invitePill: { alignSelf: 'flex-start', borderRadius: radius.pill, paddingHorizontal: 14, paddingVertical: 8, marginTop: space.xs },
  invitePillText: { fontWeight: '800', fontSize: 13, letterSpacing: 0.6, textTransform: 'uppercase', color: colors.paper },
  holdWrap: { alignItems: 'center', gap: space.lg, paddingVertical: space.xl },
  holdHint: { textAlign: 'center', fontSize: 15, lineHeight: 21, color: 'rgba(255,255,255,0.7)', paddingHorizontal: space.lg },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md },
  rowTitle: { flex: 1, fontFamily: fonts.displayMedium, fontSize: 17, color: colors.paper },
  quickRow: { flexDirection: 'row', gap: space.md },
  quick: { minHeight: 88, alignItems: 'center', justifyContent: 'center', gap: space.sm },
  quickLabel: { fontFamily: fonts.displayMedium, fontSize: 15, color: colors.paper },
  switch: { padding: 3 },
  switchItem: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: radius.pill, minHeight: 34, justifyContent: 'center' },
  switchText: { fontWeight: '800', fontSize: 13 },
});

function lower(s: string) {
  return s.charAt(0).toLowerCase() + s.slice(1);
}
