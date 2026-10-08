import { Image } from 'expo-image';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Logo } from '@/components/Logo';
import { Button } from '@/components/ui';
import { colors, fonts, space } from '@/lib/theme';

export default function Welcome() {
  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <StatusBar style="light" />
      <View style={styles.top}>
        <Logo inverted size={30} />
      </View>
      <View style={styles.hero}>
        <Image
          source={require('../../assets/images/icon.png')}
          style={styles.mascot}
          accessible
          accessibilityRole="image"
          accessibilityLabel="HereO hero watching over the neighbourhood"
        />
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
  mascot: { width: 240, height: 240, borderRadius: 32 },
  headline: { fontFamily: fonts.display, fontSize: 34, color: colors.paper, textAlign: 'center', marginTop: space.lg },
  sub: { fontSize: 17, color: '#C9C9D1', textAlign: 'center' },
  actions: { gap: space.sm, paddingBottom: space.md },
});
