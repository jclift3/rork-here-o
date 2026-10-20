import { router, useFocusEffect } from 'expo-router';
import { ChevronRight, X } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Body, Screen, Title } from '@/components/ui';
import { openNotificationTarget } from '@/lib/notifications';
import { useUserId } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { colors, fonts, space } from '@/lib/theme';

interface SentNotification {
  id: number;
  title: string;
  body: string;
  data: Record<string, unknown>;
  created_at: string;
}

function when(iso: string) {
  const d = new Date(iso);
  const time = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  if (d.toDateString() === new Date().toDateString()) return time;
  return `${d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}, ${time}`;
}

/** Every push HereO has sent you, newest first, worded exactly as it was sent. */
export default function NotificationsScreen() {
  const userId = useUserId();
  const [items, setItems] = useState<SentNotification[] | null>(null);

  useFocusEffect(
    useCallback(() => {
      supabase
        .from('notifications')
        .select('id, title, body, data, created_at')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(100)
        .then(({ data }) => setItems((data ?? []) as SentNotification[]));
    }, [userId]),
  );

  return (
    <Screen edges={['top', 'bottom']}>
      <Pressable accessibilityRole="button" accessibilityLabel="Close" onPress={() => router.back()} hitSlop={16}>
        <X color={colors.ink} />
      </Pressable>
      <Title>Notifications</Title>
      {items?.length === 0 && <Body muted>Alerts and trip updates HereO sends you show up here.</Body>}
      {items?.map((n) => {
        const opens = ['ring_id', 'incident_id', 'walk_id'].some((k) => typeof n.data?.[k] === 'string');
        return (
          <Pressable
            key={n.id}
            style={styles.row}
            disabled={!opens}
            accessibilityRole={opens ? 'button' : undefined}
            onPress={() => openNotificationTarget(n.data)}>
            <View style={{ flex: 1, gap: 4 }}>
              <Text style={styles.title}>{n.title}</Text>
              <Body>{n.body}</Body>
              <Body muted style={{ fontSize: 13 }}>{when(n.created_at)}</Body>
            </View>
            {opens && <ChevronRight color={colors.muted} />}
          </Pressable>
        );
      })}
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
  title: { fontFamily: fonts.displayMedium, fontSize: 17, color: colors.ink },
});
