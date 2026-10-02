import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Defs, LinearGradient, Path, Stop } from 'react-native-svg';

import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui';
import { colors, fonts, space } from '@/lib/theme';

/** Original cape mark; replaces the unlicensed stock photo in the Figma welcome. */
function Cape() {
  return (
    <Svg width={220} height={240} viewBox="0 0 220 240" accessibilityElementsHidden>
      <Defs>
        <LinearGradient id="cape" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={colors.heroStart} />
          <Stop offset="1" stopColor={colors.heroEnd} />
        </LinearGradient>
      </Defs>
      <Path d="M70 20 Q110 0 150 20 L210 220 Q160 200 110 232 Q60 200 10 220 Z" fill="url(#cape)" />
      <Path d="M70 20 Q110 44 150 20" stroke={colors.paper} strokeWidth={6} fill="none" strokeLinecap="round" />
    </Svg>
  );
}

export default function Welcome() {
  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <StatusBar style="light" />
      <View style={styles.top}>
        <Logo inverted size={30} />
      </View>
      <View style={styles.hero}>
        <Cape />
        <Text style={styles.headline}>Will you answer the call?</Text>
        <Text style={styles.sub}>Get help in seconds. Be the help nearby.</Text>
      </View>
      <View style={styles.actions}>
        <Button label="Get started" variant="hero" onPress={() => router.push('/sign-in')} tall />
        <Button label="I have an account" variant="outline" onPress={() => router.push('/sign-in')} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.ink, paddingHorizontal: space.lg },
  top: { alignItems: 'center', paddingTop: space.lg },
  hero: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md },
  headline: { fontFamily: fonts.display, fontSize: 34, color: colors.paper, textAlign: 'center', marginTop: space.lg },
  sub: { fontSize: 17, color: '#C9C9D1', textAlign: 'center' },
  actions: { gap: space.sm, paddingBottom: space.md },
});
