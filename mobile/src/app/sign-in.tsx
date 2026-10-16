import { router } from 'expo-router';
import { ArrowLeft } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable } from 'react-native';

import { Body, Button, Screen, TextField, Title } from '@/components/ui';
import { friendlyError, isConfigured, supabase } from '@/lib/supabase';
import { colors } from '@/lib/theme';

const MIN_PASSWORD = 8;
const CODE_LENGTH = 6;

type Step = 'sign-in' | 'create' | 'forgot' | 'code' | 'new-password';
// What the emailed code is for: confirming a new account, or resetting a password.
type CodeFor = 'signup' | 'recovery';

/**
 * Email and password. New accounts confirm their email with a 6-digit code,
 * and a forgotten password is reset with one.
 */
export default function SignIn() {
  const [step, setStep] = useState<Step>('sign-in');
  // Where Back on the code screen returns to: the form the person came from.
  const [codeFrom, setCodeFrom] = useState<Step>('create');
  const [codeFor, setCodeFor] = useState<CodeFor>('signup');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const creating = step === 'create';
  const address = email.trim().toLowerCase();
  const validEmail = /^\S+@\S+\.\S+$/.test(address);
  const ready =
    step === 'code'
      ? code.length === CODE_LENGTH
      : step === 'forgot'
        ? validEmail
        : step === 'new-password'
          ? password.length >= MIN_PASSWORD
          : validEmail && password.length >= (creating ? MIN_PASSWORD : 1);

  const run = async (action: () => Promise<void>) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await action();
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  };

  const askForCode = (purpose: CodeFor = 'signup') => {
    setCode('');
    setCodeFor(purpose);
    setCodeFrom(step);
    setStep('code');
  };

  const signIn = () =>
    run(async () => {
      const { error } = await supabase.auth.signInWithPassword({ email: address, password });
      if (!error) return void router.replace('/');
      if (/not confirmed/i.test(error.message)) {
        await supabase.auth.resend({ type: 'signup', email: address });
        return askForCode();
      }
      setError(/invalid login/i.test(error.message) ? 'That email and password don’t match.' : friendlyError(error));
    });

  const createAccount = () =>
    run(async () => {
      if (password.length > 72) return setError('Use a password of 72 characters or fewer.');
      const { data, error } = await supabase.auth.signUp({ email: address, password });
      if (error) return setError(friendlyError(error));
      if (data.session) return void router.replace('/');
      // Supabase hides whether an address is taken: a confirmed account comes back with no identities.
      if (data.user && data.user.identities?.length === 0) {
        return setError('That email already has an account. Sign in instead.');
      }
      askForCode();
    });

  const sendResetCode = () =>
    supabase.auth.resetPasswordForEmail(address).then(({ error }) => {
      if (error) throw error;
    });

  const forgot = () =>
    run(async () => {
      await sendResetCode();
      askForCode('recovery');
    });

  const confirm = () =>
    run(async () => {
      const { error } = await supabase.auth.verifyOtp({ email: address, token: code, type: codeFor });
      if (error) {
        setError(/expired|invalid/i.test(error.message) ? 'That code didn’t work. Check it or send a new one.' : friendlyError(error));
        return;
      }
      if (codeFor === 'signup') return void router.replace('/');
      // The code signed them in; now they choose the new password.
      setPassword('');
      setStep('new-password');
    });

  const resend = () =>
    run(async () => {
      if (codeFor === 'recovery') await sendResetCode();
      else {
        const { error } = await supabase.auth.resend({ type: 'signup', email: address });
        if (error) return setError(friendlyError(error));
      }
      setNotice(`We sent a new code to ${address}.`);
    });

  const savePassword = () =>
    run(async () => {
      if (password.length > 72) return setError('Use a password of 72 characters or fewer.');
      const { error } = await supabase.auth.updateUser({ password });
      if (error) {
        setError(/different from the old/i.test(error.message) ? 'Choose a password you haven’t used here before.' : friendlyError(error));
        return;
      }
      router.replace('/');
    });

  const errorText = error && <Body style={{ color: colors.alert }}>{error}</Body>;

  if (step === 'new-password') {
    return (
      <Screen>
        <Title>Choose a new password</Title>
        <Body muted>You’ll use it to sign in to {address} from now on.</Body>
        <TextField
          label="New password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoCapitalize="none"
          autoComplete="new-password"
          textContentType="newPassword"
          placeholder={`At least ${MIN_PASSWORD} characters`}
          onSubmitEditing={() => ready && savePassword()}
        />
        <Button label="Save password" onPress={savePassword} loading={busy} disabled={!ready} />
        {errorText}
      </Screen>
    );
  }

  if (step === 'forgot') {
    return (
      <Screen>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => setStep('sign-in')} hitSlop={16}>
          <ArrowLeft color={colors.ink} />
        </Pressable>
        <Title>Reset your password</Title>
        <Body muted>We’ll email you a {CODE_LENGTH}-digit code to set a new one.</Body>
        <TextField
          label="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoComplete="email"
          keyboardType="email-address"
          textContentType="emailAddress"
          placeholder="you@example.com"
          onSubmitEditing={() => ready && forgot()}
        />
        <Button label="Email me a code" onPress={forgot} loading={busy} disabled={!ready} />
        {errorText}
      </Screen>
    );
  }

  if (step === 'code') {
    return (
      <Screen>
        <Pressable accessibilityRole="button" accessibilityLabel="Back" onPress={() => setStep(codeFrom)} hitSlop={16}>
          <ArrowLeft color={colors.ink} />
        </Pressable>
        <Title>Check your email</Title>
        <Body muted>We sent a {CODE_LENGTH}-digit code to {address}. It can take a minute to arrive.</Body>
        <TextField
          label="Code"
          value={code}
          onChangeText={(text) => setCode(text.replace(/\D/g, '').slice(0, CODE_LENGTH))}
          keyboardType="number-pad"
          autoComplete="one-time-code"
          textContentType="oneTimeCode"
          placeholder="123456"
          maxLength={CODE_LENGTH}
          onSubmitEditing={() => ready && confirm()}
        />
        <Button label={codeFor === 'signup' ? 'Confirm email' : 'Continue'} onPress={confirm} loading={busy} disabled={!ready} />
        <Button label="Send a new code" variant="ghost" onPress={resend} disabled={busy} />
        {notice && <Body muted>{notice}</Body>}
        {errorText}
      </Screen>
    );
  }

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
        onSubmitEditing={() => ready && (creating ? createAccount() : signIn())}
      />
      <Button
        label={creating ? 'Create account' : 'Sign in'}
        onPress={creating ? createAccount : signIn}
        loading={busy}
        disabled={!ready}
      />
      <Button
        label={creating ? 'I already have an account' : 'New here? Create an account'}
        variant="ghost"
        onPress={() => {
          setStep(creating ? 'sign-in' : 'create');
          setError(null);
        }}
      />
      {!creating && (
        <Button
          label="Forgot password?"
          variant="ghost"
          onPress={() => {
            setStep('forgot');
            setError(null);
          }}
        />
      )}
      {errorText}
    </Screen>
  );
}
