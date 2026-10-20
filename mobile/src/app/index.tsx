import { Redirect } from 'expo-router';

import { useSession } from '@/lib/session';

/** Sends people to the right place: welcome, finish setup, or the app. */
export default function Index() {
  const { session, profile, profileLoading } = useSession();
  if (!session) return <Redirect href="/welcome" />;
  // Right after sign-in the profile is still loading; don't send a returning
  // user to set-up meanwhile.
  if (profileLoading) return null;
  if (!profile?.display_name) return <Redirect href="/onboarding" />;
  return <Redirect href="/home" />;
}
