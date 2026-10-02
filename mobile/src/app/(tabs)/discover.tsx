import { router, useFocusEffect } from 'expo-router';
import { Check, Circle } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { Avatar, Body, Button, Card, Pill, Screen, SectionLabel, Title } from '@/components/ui';
import { useSession, useUserId } from '@/lib/session';
import { supabase } from '@/lib/supabase';
import { colors, fonts, space } from '@/lib/theme';
import { COURSES } from '@/lib/types';

interface TopGuardian {
  user_id: string;
  display_name: string;
  thanks_count: number;
}

/** Figma's Discover, kept: recognition up top, the training path below. */
export default function Discover() {
  const { profile } = useSession();
  const userId = useUserId();
  const [top, setTop] = useState<TopGuardian[]>([]);
  const [done, setDone] = useState<Set<string>>(new Set());

  useFocusEffect(
    useCallback(() => {
      supabase.rpc('top_guardians', { p_limit: 10 }).then(({ data }) => setTop((data ?? []) as TopGuardian[]));
      supabase
        .from('guardian_trainings')
        .select('course')
        .eq('user_id', userId)
        .then(({ data }) => setDone(new Set((data ?? []).map((r) => r.course as string))));
    }, [userId]),
  );

  return (
    <Screen>
      <Title>Discover</Title>

      <SectionLabel>Top Here-Os this month</SectionLabel>
      {top.length ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: space.md }}>
          {top.map((g) => (
            <View key={g.user_id} style={styles.hero}>
              <Avatar name={g.display_name} size={64} color={colors.heroStart} />
              <Text style={styles.heroName} numberOfLines={1}>{g.display_name.split(' ')[0]}</Text>
              <Body muted style={{ fontSize: 13 }}>{g.thanks_count} thanks</Body>
            </View>
          ))}
        </ScrollView>
      ) : (
        <Body muted>When guardians are thanked for showing up, they appear here.</Body>
      )}

      <SectionLabel>Your guardian path</SectionLabel>
      <Card style={{ gap: space.md }}>
        {profile?.is_guardian ? (
          <Pill label="Guardian" color={colors.heroStart} filled />
        ) : (
          <Body>Start with the code of conduct. It takes two minutes.</Body>
        )}
        {COURSES.map((c) => {
          const complete = done.has(c.id);
          return (
            <View key={c.id} style={styles.step}>
              {complete ? <Check color={colors.safe} /> : <Circle color={colors.line} />}
              <View style={{ flex: 1 }}>
                <Text style={styles.stepTitle}>{c.title}</Text>
                <Body muted style={{ fontSize: 14 }}>
                  {complete ? 'Complete' : c.selfServe ? c.detail : `${c.detail} Through a training partner.`}
                </Body>
              </View>
            </View>
          );
        })}
        {!profile?.is_guardian && <Button label="Start" variant="hero" onPress={() => router.push('/guardian')} />}
      </Card>

      <SectionLabel>Certifications</SectionLabel>
      <Body muted>
        De-escalation, bystander intervention, Stop the Bleed and first aid are recorded when you complete them with a
        HereO training partner. Each one changes the jobs HereO gives you.
      </Body>
      <Pressable onPress={() => router.push('/guardian')}>
        <Body style={{ fontWeight: '700' }}>Guardian settings →</Body>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: 'center', width: 84, gap: 4 },
  heroName: { fontFamily: fonts.displayMedium, fontSize: 14, color: colors.ink },
  step: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start' },
  stepTitle: { fontFamily: fonts.displayMedium, fontSize: 16, color: colors.ink },
});
