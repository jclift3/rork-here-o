import { router } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable } from 'react-native';

import { Body, Button, Screen, TextField, Title } from '@/components/ui';
import { friendlyError, isConfigured, supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';

const MIN_PASSWORD = 8;

/** Email and password. New accounts are created by the sign-up function. */
export default function SignIn() {
  const [creating, setCreating] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validEmail = /^\S+@\S+\.\S+$/.test(email.trim());
  const ready = validEmail && password.length >= (creating ? MIN_PASSWORD : 1);

  const submit = async () => {
    setBusy(true);
    setError(null);
    try {
      if (creating) await createAccount(email.trim(), password);
      const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
      if (error) {
        setError(/invalid login/i.test(error.message) ? 'That email and password don’t match.' : friendlyError(error));
        return;
      }
      router.replace('/');
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen>
      <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => router.back()} hitSlop={16}>
        <ArrowLeft color={colors.ink} />
      </Pressable>
      <Title>{creating ? 'Create your account' : 'Sign in'}</Title>
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
        textContentType="emailAddress"
        placeholder="you@example.com"
      />
      <TextField
        label="Password"
        value={password}
        onChangeText={setPassword}
        secureTextEntry
        autoCapitalize="none"
        autoComplete={creating ? 'new-password' : 'current-password'}
        textContentType={creating ? 'newPassword' : 'password'}
        placeholder={creating ? `At least ${MIN_PASSWORD} characters` : ''}
        onSubmitEditing={() => ready && submit()}
      />
      <Button label={creating ? 'Create account' : 'Sign in'} onPress={submit} loading={busy} disabled={!ready} />
      <Button
        label={creating ? 'I already have an account' : 'New here? Create an account'}
        variant="ghost"
        onPress={() => {
          setCreating(!creating);
          setError(null);
        }}
      />
      {error && <Body style={{ color: colors.alert }}>{error}</Body>}
    </Screen>
  );
}

async function createAccount(email: string, password: string) {
  const { error } = await supabase.functions.invoke('sign-up', { body: { email, password } });
  if (!error) return;
  // The function answers with a readable { error } message.
  const body = await (error as { context?: Response }).context?.json?.().catch(() => null);
  throw new Error(body?.error ?? error.message);
}
