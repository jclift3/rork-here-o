import { router } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable } from 'react-native';

import { Body, Button, Screen, TextField, Title } from '@/components/ui';
import { friendlyError, isConfigured, supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';

/** Passwordless: email a six-digit code, nothing to remember under stress. */
export default function SignIn() {
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendCode = async () => {
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: true } });
    setBusy(false);
    if (error) setError(friendlyError(error));
    else setSent(true);
  };

  const verify = async () => {
    setBusy(true);
    setError(null);
    const { error } = await supabase.auth.verifyOtp({ email: email.trim(), token: code.trim(), type: 'email' });
    setBusy(false);
    if (error) setError(friendlyError(error));
    else router.replace('/');
  };

  return (
    <Screen>
      <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} hitSlop={16}>
        <ArrowLeft color={colors.ink} />
      </Pressable>
      <Title>Sign in</Title>
      {!isConfigured && (
        <Body muted>This build has no backend configured. Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.</Body>
      )}
      <TextField
        label="Email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        autoComplete="email"
        keyboardType="email-address"
        placeholder="you@example.com"
        editable={!sent}
      />
      {sent ? (
        <>
          <Body muted>We sent a 6-digit code to {email.trim()}.</Body>
          <TextField
            label="Code"
            value={code}
            onChangeText={(t) => setCode(t.replace(/\D/g, '').slice(0, 6))}
            keyboardType="number-pad"
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            placeholder="123456"
            style={{ letterSpacing: 8, fontSize: 24 }}
          />
          <Button label="Sign in" onPress={verify} loading={busy} disabled={code.length !== 6} />
          <Button label="Use a different email" variant="ghost" onPress={() => { setSent(false); setCode(''); }} />
        </>
      ) : (
        <Button label="Send code" onPress={sendCode} loading={busy} disabled={!/^\S+@\S+\.\S+$/.test(email.trim())} />
      )}
      {error && <Body style={{ color: colors.alert }}>{error}</Body>}
    </Screen>
  );
}
