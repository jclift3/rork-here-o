import FontAwesome from "@expo/vector-icons/FontAwesome";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { useEffect } from "react";
import { StatusBar } from "expo-status-bar";
import Colors from "@/constants/colors";

export const unstable_settings = {
  initialRouteName: "index",
};

// Prevent the splash screen from auto-hiding before asset loading is complete.
SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const [loaded, error] = useFonts({
    ...FontAwesome.font,
  });

  useEffect(() => {
    if (error) {
      console.error(error);
      throw error;
    }
  }, [error]);

  useEffect(() => {
    if (loaded) {
      SplashScreen.hideAsync();
    }
  }, [loaded]);

  if (!loaded) {
    return null;
  }

  return <RootLayoutNav />;
}

function RootLayoutNav() {
  return (
    <>
      <StatusBar style="dark" />
      <Stack
        screenOptions={{
          headerStyle: {
            backgroundColor: Colors.white,
          },
          headerTintColor: Colors.text,
          headerTitleStyle: {
            fontWeight: '600',
          },
          contentStyle: {
            backgroundColor: Colors.background,
          },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="login" options={{ headerShown: false }} />
        <Stack.Screen name="register" options={{ headerShown: false }} />
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="request-details/[id]" options={{ title: "Help Request" }} />
        <Stack.Screen name="quick-help" options={{ title: "Quick Help" }} />
        <Stack.Screen name="circle-of-trust" options={{ title: "Circle of Trust" }} />
        <Stack.Screen name="safety-check-in" options={{ title: "Safety Check-In" }} />
        <Stack.Screen name="follow-me" options={{ title: "Follow Me" }} />
        <Stack.Screen name="emergency-exit" options={{ title: "Emergency Exit" }} />
        <Stack.Screen name="safe-place/[id]" options={{ title: "Safe Place" }} />
        <Stack.Screen name="support-group/[id]" options={{ title: "Support Group" }} />
        <Stack.Screen name="mentor/[id]" options={{ title: "Mentor Profile" }} />
        <Stack.Screen name="verification/intro" options={{ title: "Verification", headerShown: false }} />
        <Stack.Screen name="verification/basic" options={{ title: "Basic Verification" }} />
        <Stack.Screen name="verification/pending" options={{ title: "Verification Status", headerShown: false }} />
      </Stack>
    </>
  );
}