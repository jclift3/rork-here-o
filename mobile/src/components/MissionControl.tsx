// The live incident screen's look (Meta hackathon, Nov 2026): a full-bleed
// map, a dark sheet that slides over it, a step tracker and small building
// blocks shared by the person asking for help and the heroes going to them.

import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { ArrowLeft, Check } from 'lucide-react-native';
import { useEffect, useState, type ReactNode } from 'react';
import { Animated, Easing, Pressable, StyleSheet, Text, useWindowDimensions, View, type StyleProp, type ViewStyle } from 'react-native';
import MapView, { Marker } from 'react-native-maps';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, fonts, heroGradient, space } from '@/lib/theme';

/** Dark palette for the live screen only; the rest of the app stays light. */
export const night = {
  bg: '#0B0B0F',
  card: '#16161D',
  raised: '#1E1E27',
  line: '#2A2A35',
  text: '#FFFFFF',
  muted: '#9C9CAA',
  faint: '#5E5E6B',
} as const;

export const MAP_HEIGHT = 300;

/** Map across the top of the screen, with a pulsing pin where the person is. */
export function LiveMap({ lat, lng, label, active }: { lat: number | null; lng: number | null; label: string; active: boolean }) {
  const insets = useSafeAreaInsets();
  const { height } = useWindowDimensions();
  // About a quarter of the screen, so the brief stays above the fold on small phones.
  const mapHeight = Math.round(Math.min(MAP_HEIGHT, height * 0.26));
  return (
    <View style={[styles.mapWrap, { height: mapHeight + insets.top }]}>
      {lat != null && lng != null ? (
        <MapView
          style={StyleSheet.absoluteFill}
          region={{ latitude: lat - 0.0009, longitude: lng, latitudeDelta: 0.006, longitudeDelta: 0.006 }}
          userInterfaceStyle="dark"
          pitchEnabled={false}
          rotateEnabled={false}
          toolbarEnabled={false}>
          <Marker coordinate={{ latitude: lat, longitude: lng }} title={label} anchor={{ x: 0.5, y: 0.5 }}>
            <PulsePin active={active} />
          </Marker>
        </MapView>
      ) : (
        <View style={[StyleSheet.absoluteFill, { backgroundColor: night.card }]} />
      )}
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(11,11,15,0.65)', 'rgba(11,11,15,0)']}
        style={[styles.mapShade, { height: insets.top + 60 }]}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Back"
        hitSlop={12}
        onPress={() => (router.canGoBack() ? router.back() : router.replace('/home'))}
        style={[styles.back, { top: insets.top + 8 }]}>
        <ArrowLeft color={night.text} size={22} />
      </Pressable>
    </View>
  );
}

function PulsePin({ active }: { active: boolean }) {
  const [pulse] = useState(() => new Animated.Value(0));
  useEffect(() => {
    if (!active) return;
    const loop = Animated.loop(
      Animated.timing(pulse, { toValue: 1, duration: 1800, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [active, pulse]);
  const color = active ? colors.alert : colors.safe;
  return (
    <View style={styles.pinBox}>
      {active && (
        <Animated.View
          style={[
            styles.pinRing,
            {
              borderColor: color,
              opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.8, 0] }),
              transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.4, 1.6] }) }],
            },
          ]}
        />
      )}
      <View style={[styles.pinDot, { backgroundColor: color }]} />
    </View>
  );
}

/** Keeps scrolled content from running under the clock and the Dynamic Island. */
export function StatusBackdrop() {
  const insets = useSafeAreaInsets();
  return <View pointerEvents="none" style={[styles.statusBackdrop, { height: insets.top }]} />;
}

/** The dark sheet that overlaps the bottom of the map. */
export function Sheet({ children }: { children: ReactNode }) {
  return <View style={styles.sheet}>{children}</View>;
}

export function Panel({ children, style, accent }: { children: ReactNode; style?: StyleProp<ViewStyle>; accent?: string }) {
  return (
    <View style={[styles.panel, accent && { borderLeftWidth: 4, borderLeftColor: accent }, style]}>{children}</View>
  );
}

/** A panel with a hero-gradient frame: the one thing a hero must do. */
export function GradientPanel({ children }: { children: ReactNode }) {
  return (
    <LinearGradient colors={heroGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.gradientFrame}>
      <View style={styles.gradientInner}>{children}</View>
    </LinearGradient>
  );
}

export function Label({ children, color = night.muted }: { children: ReactNode; color?: string }) {
  return <Text style={[styles.label, { color }]}>{children}</Text>;
}

/** Which Meta model (or rule) did a step. */
export function ModelChip({ label, tone = 'meta' }: { label: string; tone?: 'meta' | 'rules' | 'alert' }) {
  const bg = tone === 'rules' ? 'rgba(18,161,80,0.16)' : tone === 'alert' ? 'rgba(229,37,42,0.18)' : 'rgba(232,51,139,0.16)';
  const fg = tone === 'rules' ? '#3CCB7F' : tone === 'alert' ? '#FF6B6E' : '#FF7AB8';
  return (
    <View style={[styles.chip, { backgroundColor: bg }]}>
      <Text style={[styles.chipText, { color: fg }]}>{label}</Text>
    </View>
  );
}

export type StepState = 'done' | 'now' | 'next';

/** Alert out → AI coordinating → hero on the way → with you. */
export function Tracker({ steps }: { steps: { label: string; state: StepState }[] }) {
  return (
    <View style={styles.tracker} accessibilityRole="progressbar">
      {steps.map((s, i) => (
        <View key={s.label} style={styles.trackerStep}>
          <View style={styles.trackerRow}>
            <View
              style={[
                styles.trackerDot,
                s.state === 'done' && { backgroundColor: colors.safe, borderColor: colors.safe },
                s.state === 'now' && { borderColor: colors.heroStart, backgroundColor: 'rgba(232,51,139,0.25)' },
              ]}>
              {s.state === 'done' && <Check size={12} color={night.text} strokeWidth={3} />}
            </View>
            {i < steps.length - 1 && (
              <View style={[styles.trackerLine, s.state === 'done' && { backgroundColor: colors.safe }]} />
            )}
          </View>
          <Text
            style={[styles.trackerText, s.state === 'next' && { color: night.faint }, s.state === 'now' && { color: night.text }]}
            numberOfLines={2}>
            {s.label}
          </Text>
        </View>
      ))}
    </View>
  );
}

/** A person on the incident: avatar, name, what they are doing. */
export function PersonRow({
  name,
  sub,
  status,
  statusColor,
  hero,
}: {
  name: string;
  sub: string;
  status: string;
  statusColor: string;
  hero?: boolean;
}) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
  const avatar = (
    <View style={styles.avatar}>
      <Text style={styles.avatarText}>{initials || '?'}</Text>
    </View>
  );
  return (
    <View style={styles.person}>
      {hero ? (
        <LinearGradient colors={heroGradient} style={styles.avatarRing}>
          {avatar}
        </LinearGradient>
      ) : (
        <View style={[styles.avatarRing, { backgroundColor: night.line }]}>{avatar}</View>
      )}
      <View style={{ flex: 1 }}>
        <Text style={styles.personName}>{name}</Text>
        <Text style={styles.personSub}>{sub}</Text>
      </View>
      <View style={[styles.status, { borderColor: statusColor }]}>
        <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
        <Text style={[styles.statusText, { color: statusColor }]}>{status}</Text>
      </View>
    </View>
  );
}

/** Rough walking time at 80 m a minute. */
export function walkTime(m: number | null | undefined): string | null {
  if (m == null) return null;
  const min = Math.max(1, Math.round(m / 80));
  return `${m < 1000 ? `${Math.round(m / 10) * 10} m` : `${(m / 1000).toFixed(1)} km`} · ${min} min walk`;
}

export const night_styles = StyleSheet.create({
  headline: { fontFamily: fonts.display, fontSize: 32, lineHeight: 38, color: night.text, letterSpacing: -0.5 },
  sub: { fontSize: 15, lineHeight: 21, color: night.muted },
  big: { fontSize: 20, lineHeight: 28, color: night.text, fontFamily: fonts.displayMedium },
  body: { fontSize: 16, lineHeight: 23, color: night.text },
  section: { fontSize: 12, fontWeight: '800', letterSpacing: 1.4, color: night.muted, marginTop: space.sm },
});

const styles = StyleSheet.create({
  mapWrap: { width: '100%', backgroundColor: night.bg },
  mapShade: { position: 'absolute', top: 0, left: 0, right: 0 },
  statusBackdrop: { position: 'absolute', top: 0, left: 0, right: 0, backgroundColor: 'rgba(11,11,15,0.94)' },
  back: {
    position: 'absolute',
    left: space.md,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(11,11,15,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pinBox: { width: 72, height: 72, alignItems: 'center', justifyContent: 'center' },
  pinRing: { position: 'absolute', width: 72, height: 72, borderRadius: 36, borderWidth: 3 },
  pinDot: { width: 20, height: 20, borderRadius: 10, borderWidth: 3, borderColor: night.text },
  sheet: {
    marginTop: -28,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    backgroundColor: night.bg,
    paddingHorizontal: space.lg,
    paddingTop: space.lg,
    paddingBottom: space.xl,
    gap: space.md,
  },
  panel: { backgroundColor: night.card, borderRadius: 18, padding: space.md, gap: space.sm },
  gradientFrame: { borderRadius: 20, padding: 2 },
  gradientInner: { backgroundColor: night.card, borderRadius: 18, padding: space.md, gap: space.sm },
  label: { fontSize: 12, fontWeight: '800', letterSpacing: 1.4 },
  chip: { borderRadius: 999, paddingHorizontal: 8, paddingVertical: 2, alignSelf: 'flex-start' },
  chipText: { fontSize: 11, fontWeight: '800', letterSpacing: 0.4 },
  tracker: { flexDirection: 'row', marginVertical: space.xs },
  trackerStep: { flex: 1, gap: 6 },
  trackerRow: { flexDirection: 'row', alignItems: 'center' },
  trackerDot: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: night.faint,
    alignItems: 'center',
    justifyContent: 'center',
  },
  trackerLine: { flex: 1, height: 2, backgroundColor: night.line, marginHorizontal: 4 },
  trackerText: { fontSize: 11, lineHeight: 14, fontWeight: '700', color: night.muted, paddingRight: 4 },
  person: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  avatarRing: { width: 46, height: 46, borderRadius: 23, alignItems: 'center', justifyContent: 'center' },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: night.raised,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { color: night.text, fontFamily: fonts.displayMedium, fontSize: 15 },
  personName: { color: night.text, fontFamily: fonts.displayMedium, fontSize: 17 },
  personSub: { color: night.muted, fontSize: 13, marginTop: 1 },
  status: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderWidth: 1.5,
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 4,
  },
  statusDot: { width: 7, height: 7, borderRadius: 4 },
  statusText: { fontSize: 12, fontWeight: '800', letterSpacing: 0.3 },
});
