import { Lexend_500Medium, Lexend_700Bold, useFonts } from '@expo-google-fonts/lexend';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { stopGuardianBackgroundLocation } from '@/lib/backgroundLocation';
import { ModeProvider } from '@/lib/mode';
import { registerForPush, routeNotificationTaps } from '@/lib/notifications';
import { useGuardianPresence } from '@/lib/presence';
import { refreshRingSettings, useRingSettings } from '@/lib/ring';
import { SessionProvider, useSession } from '@/lib/session';
import { colors } from '@/lib/theme';

SplashScreen.preventAutoHideAsync();

function SignedInEffects() {
  const { session, profile } = useSession();
  const userId = session?.user.id ?? '';
  useEffect(() => {
    if (userId) registerForPush(userId);
  }, [userId]);
  useEffect(() => (userId ? routeNotificationTaps() : undefined), [userId]);
  useEffect(() => {
    refreshRingSettings(userId);
  }, [userId]);
  const ring = useRingSettings();
  const guardian = !!profile?.is_guardian && !!profile.guardian_available;
  // Guardians and people who answer the HereO ring both need a fresh position.
  const findable = guardian || !!ring?.optIn;
  useGuardianPresence(userId, findable);
  // Either can be turned off elsewhere (another device); stop tracking here too.
  useEffect(() => {
    if (profile && ring && !findable) stopGuardianBackgroundLocation();
  }, [profile, ring, findable]);
  return null;
}

function RootStack() {
  const { loading } = useSession();
  const [fontsLoaded] = useFonts({ Lexend_500Medium, Lexend_700Bold });
  const ready = fontsLoaded && !loading;
  useEffect(() => {
    if (ready) SplashScreen.hideAsync();
  }, [ready]);
  if (!ready) return null;
  return (
    <>
      <SignedInEffects />
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: colors.paper } }}>
        <Stack.Screen name="welcome" options={{ contentStyle: { backgroundColor: colors.ink } }} />
        <Stack.Screen name="incident/[id]" options={{ gestureEnabled: false }} />
        <Stack.Screen name="circle" options={{ presentation: 'modal' }} />
        <Stack.Screen name="guardian" options={{ presentation: 'modal' }} />
        <Stack.Screen name="verify" options={{ presentation: 'modal' }} />
        <Stack.Screen name="walk/index" options={{ presentation: 'modal' }} />
        <Stack.Screen name="ring/index" options={{ gestureEnabled: false, animation: 'none' }} />
        <Stack.Screen name="fake-call" options={{ presentation: 'fullScreenModal', gestureEnabled: false }} />
      </Stack>
    </>
  );
}

export default function RootLayout() {
  return (
    <SessionProvider>
      <ModeProvider>
        <RootStack />
      </ModeProvider>
    </SessionProvider>
  );
}
