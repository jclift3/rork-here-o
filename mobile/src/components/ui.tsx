import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextStyle,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, fonts, heroGradient, radius, space, touchTarget } from '@/lib/theme';

export function Screen({
  children,
  scroll = true,
  style,
  edges = ['top'],
}: {
  children: ReactNode;
  scroll?: boolean;
  style?: StyleProp<ViewStyle>;
  edges?: ('top' | 'bottom')[];
}) {
  return (
    <SafeAreaView edges={edges} style={styles.screen}>
      {scroll ? (
        <ScrollView contentContainerStyle={[styles.content, style]} keyboardShouldPersistTaps="handled">
          {children}
        </ScrollView>
      ) : (
        <View style={[styles.content, { flex: 1 }, style]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

export function Title({ children, style }: { children: ReactNode; style?: StyleProp<TextStyle> }) {
  return (
    <Text accessibilityRole="header" style={[styles.title, style]}>
      {children}
    </Text>
  );
}

export function SectionLabel({ children }: { children: ReactNode }) {
  return <Text style={styles.sectionLabel}>{children}</Text>;
}

export function Body({
  children,
  muted,
  style,
  numberOfLines,
}: {
  children: ReactNode;
  muted?: boolean;
  style?: StyleProp<TextStyle>;
  numberOfLines?: number;
}) {
  return (
    <Text numberOfLines={numberOfLines} style={[styles.body, muted && { color: colors.muted }, style]}>
      {children}
    </Text>
  );
}

type ButtonVariant = 'primary' | 'outline' | 'hero' | 'alert' | 'safe' | 'ghost';

export function Button({
  label,
  onPress,
  variant = 'primary',
  loading,
  disabled,
  icon,
  style,
  tall,
}: {
  label: string;
  onPress: () => void;
  variant?: ButtonVariant;
  loading?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
  style?: StyleProp<ViewStyle>;
  tall?: boolean;
}) {
  const v = buttonVariants[variant];
  const inner = (
    <View style={[styles.buttonInner, tall && { minHeight: 64 }]}>
      {loading ? (
        <ActivityIndicator color={v.text} />
      ) : (
        <>
          {icon}
          <Text style={[styles.buttonLabel, { color: v.text }]}>{label}</Text>
        </>
      )}
    </View>
  );
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled, busy: !!loading }}
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: v.bg, borderColor: v.border, opacity: disabled ? 0.4 : pressed ? 0.85 : 1 },
        variant === 'hero' && { borderWidth: 0 },
        style,
      ]}>
      {variant === 'hero' ? (
        <LinearGradient colors={heroGradient} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={styles.gradientFill}>
          {inner}
        </LinearGradient>
      ) : (
        inner
      )}
    </Pressable>
  );
}

const buttonVariants: Record<ButtonVariant, { bg: string; text: string; border: string }> = {
  primary: { bg: colors.ink, text: colors.paper, border: colors.ink },
  outline: { bg: colors.paper, text: colors.ink, border: colors.ink },
  hero: { bg: colors.heroStart, text: colors.paper, border: 'transparent' },
  alert: { bg: colors.alert, text: colors.paper, border: colors.alert },
  safe: { bg: colors.paper, text: colors.safe, border: colors.safe },
  ghost: { bg: 'transparent', text: colors.muted, border: 'transparent' },
};

export function TextField(props: TextInputProps & { label?: string }) {
  const { label, style, ...rest } = props;
  return (
    <View style={{ gap: space.xs }}>
      {label ? <Text style={styles.fieldLabel}>{label}</Text> : null}
      <TextInput placeholderTextColor={colors.muted} style={[styles.input, style]} {...rest} />
    </View>
  );
}

export function Card({ children, style, tone }: { children: ReactNode; style?: StyleProp<ViewStyle>; tone?: 'mist' | 'alert' | 'safe' }) {
  const bg = tone === 'alert' ? colors.alertSoft : tone === 'safe' ? colors.safeSoft : colors.mist;
  return <View style={[styles.card, { backgroundColor: bg }, style]}>{children}</View>;
}

export function Pill({ label, color = colors.ink, filled }: { label: string; color?: string; filled?: boolean }) {
  return (
    <View style={[styles.pill, { borderColor: color, backgroundColor: filled ? color : 'transparent' }]}>
      <Text style={[styles.pillText, { color: filled ? colors.paper : color }]}>{label}</Text>
    </View>
  );
}

export function Avatar({ name, size = 40, color = colors.ink }: { name: string; size?: number; color?: string }) {
  const initials = name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('') || '?';
  return (
    <View style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: color, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: colors.paper, fontFamily: fonts.displayMedium, fontSize: size * 0.38 }}>{initials}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.paper },
  content: { padding: space.lg, gap: space.md, paddingBottom: 120 },
  title: { fontFamily: fonts.display, fontSize: 36, color: colors.ink, letterSpacing: -0.5 },
  sectionLabel: { fontWeight: '800', fontSize: 13, letterSpacing: 1.2, textTransform: 'uppercase', color: colors.ink, marginTop: space.md },
  body: { fontSize: 16, lineHeight: 23, color: colors.ink },
  button: { borderRadius: radius.card, borderWidth: 2, overflow: 'hidden', minHeight: touchTarget },
  gradientFill: { flex: 1 },
  buttonInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm, paddingHorizontal: space.md, minHeight: touchTarget + 4 },
  buttonLabel: { fontWeight: '800', fontSize: 15, letterSpacing: 0.8, textTransform: 'uppercase' },
  fieldLabel: { fontWeight: '700', fontSize: 14, color: colors.ink },
  input: { borderWidth: 2, borderColor: colors.ink, paddingHorizontal: space.md, minHeight: 56, fontSize: 17, color: colors.ink },
  card: { borderRadius: radius.card, padding: space.md, gap: space.sm },
  pill: { borderWidth: 1.5, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 3, alignSelf: 'flex-start' },
  pillText: { fontSize: 12, fontWeight: '800', letterSpacing: 0.5, textTransform: 'uppercase' },
});
