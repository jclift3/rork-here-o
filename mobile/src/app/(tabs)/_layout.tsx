import { Redirect } from 'expo-router';
import { Tabs } from 'expo-router/tabs';

import { HelpTabBar } from '@/components/HelpTabBar';
import { useSession } from '@/lib/session';

export default function TabsLayout() {
  const { session } = useSession();
  if (!session) return <Redirect href="/welcome" />;
  return (
    <Tabs tabBar={(props) => <HelpTabBar {...props} />} screenOptions={{ headerShown: false }}>
      <Tabs.Screen name="home" />
      <Tabs.Screen name="discover" />
      <Tabs.Screen name="help" />
      <Tabs.Screen name="messages" />
      <Tabs.Screen name="profile" />
    </Tabs>
  );
}
