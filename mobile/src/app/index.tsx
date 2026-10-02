import { Redirect } from 'expo-router';

import { useSession } from '@/lib/session';

/** Sends people to the right place: welcome, finish setup, or the app. */
export default function Index() {
  const { session, profile } = useSession();
  if (!session) return <Redirect href="/welcome" />;
  if (!profile?.display_name) return <Redirect href="/onboarding" />;
  return <Redirect href="/home" />;
}
