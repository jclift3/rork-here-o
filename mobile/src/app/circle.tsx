import { router, useFocusEffect } from 'expo-router';
import { X } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar, Body, Button, Screen, SectionLabel, TextField, Title } from '@/components/ui';
import { useUserId } from '@/lib/session';
import { friendlyError, supabase } from '@/lib/supabase';
import { colors, fonts, space } from '@/lib/theme';

interface Member {
  member_id: string;
  profiles: { display_name: string } | null;
}

export default function CircleScreen() {
  const userId = useUserId();
  const [members, setMembers] = useState<Member[]>([]);
  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const { data } = await supabase
      .from('circle_members')
      .select('member_id, profiles:member_id(display_name)')
      .eq('owner_id', userId);
    setMembers((data ?? []) as unknown as Member[]);
  }, [userId]);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  const add = async () => {
    setBusy(true);
    setError(null);
    const { error } = await supabase.rpc('add_to_circle', { p_email: email });
    setBusy(false);
    if (error) return setError(friendlyError(error));
    setEmail('');
    load();
  };

  const remove = async (memberId: string) => {
    await supabase.from('circle_members').delete().eq('owner_id', userId).eq('member_id', memberId);
    load();
  };

  return (
    <Screen edges={['top', 'bottom']}>
      <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={() => router.back()} hitSlop={16}>
        <X color={colors.ink} />
      </Pressable>
      <Title>Your circle</Title>
      <Body muted>
        These people are alerted the moment you ask for help, before anyone else, with your live location. They need a
        HereO account.
      </Body>
      <TextField
        label="Add by email"
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        placeholder="friend@example.com"
      />
      <Button label="Add to circle" onPress={add} loading={busy} disabled={!/^\S+@\S+\.\S+$/.test(email.trim())} />
      {error && <Body style={{ color: colors.alert }}>{error}</Body>}
      <SectionLabel>{members.length} in your circle</SectionLabel>
      {members.map((m) => (
        <View key={m.member_id} style={styles.row}>
          <Avatar name={m.profiles?.display_name ?? '?'} />
          <Text style={styles.name}>{m.profiles?.display_name || 'New member'}</Text>
          <Pressable accessibilityRole="button" accessibilityLabel="Remove" onPress={() => remove(m.member_id)} hitSlop={12}>
            <X color={colors.muted} />
          </Pressable>
        </View>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.sm },
  name: { flex: 1, fontFamily: fonts.displayMedium, fontSize: 17, color: colors.ink },
});
