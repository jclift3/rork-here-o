// Liquid glass building blocks (Meta hackathon, Nov 2026): a slow-moving
// brand-colour aurora to sit behind everything, and glass surfaces on top.
// On iOS 26 the surfaces are real liquid glass; elsewhere a frosted fallback.

import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { useEffect, useState, type ReactNode } from 'react';
import { Animated, Easing, StyleSheet, useWindowDimensions, View, type StyleProp, type ViewStyle } from 'react-native';
import Svg, { Defs, RadialGradient, Rect, Stop } from 'react-native-svg';

const LIQUID = isLiquidGlassAvailable();

/** A glass surface. `tint` adds a faint colour wash, `strong` makes it more opaque for long text. */
export function Glass({
  children,
  style,
  tint,
  radius = 24,
  interactive,
}: {
  children?: ReactNode;
  style?: StyleProp<ViewStyle>;
  tint?: string;
  radius?: number;
  interactive?: boolean;
}) {
  if (LIQUID) {
    return (
      <GlassView
        glassEffectStyle="regular"
        colorScheme="dark"
        tintColor={tint}
        isInteractive={interactive}
        style={[{ borderRadius: radius, overflow: 'hidden' }, style]}>
        {children}
      </GlassView>
    );
  }
  return (
    <View style={[styles.fallback, { borderRadius: radius }, tint ? { backgroundColor: tint } : null, style]}>{children}</View>
  );
}

const BLOBS = [
  { color: '#E8338B', x: 0.15, y: 0.18, r: 0.75, dx: 40, dy: 30, ms: 9000 },
  { color: '#F2602E', x: 0.9, y: 0.45, r: 0.7, dx: -50, dy: 40, ms: 11000 },
  { color: '#6D3BFF', x: 0.25, y: 0.85, r: 0.8, dx: 30, dy: -45, ms: 13000 },
] as const;

/** Slowly drifting colour light behind glass. `calm` dims it for dense screens. */
export function Aurora({ calm }: { calm?: boolean }) {
  const { width, height } = useWindowDimensions();
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: '#07070B' }]}>
      {BLOBS.map((b, i) => (
        <Blob key={i} {...b} width={width} height={height} opacity={calm ? 0.32 : 0.55} />
      ))}
    </View>
  );
}

function Blob({
  color,
  x,
  y,
  r,
  dx,
  dy,
  ms,
  width,
  height,
  opacity,
}: {
  color: string;
  x: number;
  y: number;
  r: number;
  dx: number;
  dy: number;
  ms: number;
  width: number;
  height: number;
  opacity: number;
}) {
  const [t] = useState(() => new Animated.Value(0));
  useEffect(() => {
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(t, { toValue: 1, duration: ms, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(t, { toValue: 0, duration: ms, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [t, ms]);
  const size = Math.max(width, height) * r;
  const id = `g${color.slice(1)}`;
  return (
    <Animated.View
      style={{
        position: 'absolute',
        width: size,
        height: size,
        left: width * x - size / 2,
        top: height * y - size / 2,
        opacity,
        transform: [
          { translateX: t.interpolate({ inputRange: [0, 1], outputRange: [0, dx] }) },
          { translateY: t.interpolate({ inputRange: [0, 1], outputRange: [0, dy] }) },
          { scale: t.interpolate({ inputRange: [0, 1], outputRange: [1, 1.12] }) },
        ],
      }}>
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id={id} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={color} stopOpacity={0.9} />
            <Stop offset="0.45" stopColor={color} stopOpacity={0.35} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Rect width={size} height={size} fill={`url(#${id})`} />
      </Svg>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  fallback: {
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: 'rgba(255,255,255,0.18)',
    overflow: 'hidden',
  },
});
