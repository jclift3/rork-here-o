import { router, useFocusEffect } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Avatar, Body, Pill, Screen, SectionLabel, Title } from '@/components/ui';
import { useUserId } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { colors, fonts, space } from '@/lib/theme';
import type { Incident } from '@/lib/types';

interface Thanks {
  id: number;
  incident_id: string;
  message: string;
  created_at: string;
  from: { display_name: string } | null;
}

function shortDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

/** Figma's Chats, tied to real moments: thanks you've received, then every request you've been part of. */
export default function Messages() {
  const userId = useUserId();
  const [thanks, setThanks] = useState<Thanks[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);

  useFocusEffect(
    useCallback(() => {
      supabase
        .from('thanks')
        .select('id, incident_id, message, created_at, from:from_id(display_name)')
        .eq('to_id', userId)
        .order('created_at', { ascending: false })
        .limit(50)
        .then(({ data }) => setThanks((data ?? []) as unknown as Thanks[]));
      // RLS returns only incidents this user asked for or responded to.
      supabase
        .from('incidents')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50)
        .then(({ data }) => setIncidents((data ?? []) as Incident[]));
    }, [userId]),
  );

  return (
    <Screen>
      <Title>Messages</Title>
      {thanks.length > 0 && <SectionLabel>Thank-yous</SectionLabel>}
      {thanks.map((t) => (
        <Pressable key={t.id} style={styles.row} onPress={() => router.push({ pathname: '/incident/[id]', params: { id: t.incident_id } })}>
          <Avatar name={t.from?.display_name ?? '?'} size={52} color={colors.heroStart} />
          <View style={{ flex: 1 }}>
            <Text style={styles.name}>{t.from?.display_name ?? 'Someone'}</Text>
            <Body>{t.message}</Body>
            <Body muted style={{ fontSize: 13 }}>{shortDate(t.created_at)}</Body>
          </View>
        </Pressable>
      ))}

      <SectionLabel>Help requests</SectionLabel>
      {incidents.length === 0 && <Body muted>Requests you make or respond to show up here.</Body>}
      {incidents.map((i) => (
        <Pressable key={i.id} style={styles.row} onPress={() => router.push({ pathname: '/incident/[id]', params: { id: i.id } })}>
          <View style={{ flex: 1, gap: 4 }}>
            <View style={{ flexDirection: 'row', gap: space.sm, alignItems: 'center' }}>
              <Text style={styles.name}>{i.requester_id === userId ? 'You asked for help' : 'You responded'}</Text>
              {i.status === 'active' && <Pill label="Open" color={colors.alert} filled />}
            </View>
            <Body muted numberOfLines={2}>{i.brief ?? i.note ?? 'Help request'}</Body>
            <Body muted style={{ fontSize: 13 }}>{shortDate(i.created_at)}</Body>
          </View>
        </Pressable>
      ))}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    gap: space.md,
    alignItems: 'center',
    paddingVertical: space.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.line,
  },
  name: { fontFamily: fonts.displayMedium, fontSize: 17, color: colors.ink },
});
