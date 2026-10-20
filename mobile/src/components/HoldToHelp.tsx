import * as Haptics from 'expo-haptics';
import { LinearGradient } from 'expo-linear-gradient';
import { useRef, useState } from 'react';
import { Animated, Easing, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

import { colors, fonts, heroGradient } from '@/lib/theme';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

/** Long enough that a pocket press won't fire, short enough for an emergency. */
export const HOLD_MS = 2000;
const TAP_MS = 250;

/**
 * The help button. Hold for two seconds to send an alert (the ring fills, the
 * phone ticks, then a strong haptic). A quick tap calls `onTap` instead.
 */
export function HoldToHelp({
  size = 200,
  onComplete,
  onTap,
  label = true,
}: {
  size?: number;
  onComplete: () => void;
  onTap?: () => void;
  label?: boolean;
}) {
  const [progress] = useState(() => new Animated.Value(0));
  const pressedAt = useRef(0);
  const done = useRef(false);
  const ticker = useRef<ReturnType<typeof setInterval> | null>(null);

  const stroke = Math.max(4, size * 0.06);
  const r = (size - stroke) / 2;
  const circumference = 2 * Math.PI * r;
  const dashOffset = progress.interpolate({ inputRange: [0, 1], outputRange: [circumference, 0] });

  const stopTicker = () => {
    if (ticker.current) clearInterval(ticker.current);
    ticker.current = null;
  };

  const onPressIn = () => {
    done.current = false;
    pressedAt.current = Date.now();
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      ticker.current = setInterval(() => Haptics.selectionAsync(), 400);
    }
    Animated.timing(progress, { toValue: 1, duration: HOLD_MS, easing: Easing.linear, useNativeDriver: false }).start(
      ({ finished }) => {
        stopTicker();
        if (finished) {
          done.current = true;
          onComplete();
          Animated.timing(progress, { toValue: 0, duration: 400, delay: 600, useNativeDriver: false }).start();
        }
      },
    );
  };

  const onPressOut = () => {
    stopTicker();
    if (done.current) return;
    progress.stopAnimation();
    Animated.timing(progress, { toValue: 0, duration: 200, useNativeDriver: false }).start();
    if (Date.now() - pressedAt.current < TAP_MS) onTap?.();
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel="Hold for two seconds to ask for help"
      accessibilityHint={onTap ? 'Tap for more options' : undefined}
      onPressIn={onPressIn}
      onPressOut={onPressOut}
      style={{ width: size, height: size }}>
      <View style={StyleSheet.absoluteFill}>
        <LinearGradient
          colors={heroGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[styles.core, { margin: stroke * 1.6, borderRadius: size }]}>
          {label ? (
            <>
              <Text style={[styles.big, { fontSize: size * 0.13 }]}>HOLD</Text>
              <Text style={[styles.small, { fontSize: Math.max(11, size * 0.065) }]}>for help</Text>
            </>
          ) : (
            <Text style={[styles.big, { fontSize: size * 0.42, lineHeight: size * 0.5 }]}>+</Text>
          )}
        </LinearGradient>
      </View>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={colors.line} strokeWidth={stroke} fill="none" />
        <AnimatedCircle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={colors.ink}
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={dashOffset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  core: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  big: { color: colors.paper, fontFamily: fonts.display, letterSpacing: 1 },
  small: { color: colors.paper, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase' },
});
