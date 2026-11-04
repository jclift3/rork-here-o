// What the AI coordinator did on this incident and what the safety rules did
// about it (Meta hackathon, Nov 2026). Collapsed to the latest few lines.

import { Check, ChevronDown, ChevronUp, PenLine, ShieldAlert, Sparkles } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { Card } from '@/components/ui';
import { describeDecision, useAgentDecisions, type AgentDecision } from '@/lib/muse';
import { colors, fonts, space } from '@/lib/theme';
import type { Responder } from '@/lib/types';

const VERDICT = {
  allowed: { Icon: Check, color: colors.safe, label: 'done' },
  changed: { Icon: PenLine, color: colors.heroStart, label: 'adjusted by safety rules' },
  blocked: { Icon: ShieldAlert, color: colors.alert, label: 'blocked by safety rules' },
} as const;

export function MuseCoordinator({ incidentId, responders }: { incidentId: string; responders: Responder[] }) {
  const rows = useAgentDecisions(incidentId).filter((d) => d.tool !== 'finish');
  const [open, setOpen] = useState(false);
  if (!rows.length) return null;
  const names = new Map(responders.map((r) => [r.user_id, r.profiles?.display_name?.split(' ')[0] ?? 'a hero']));
  const shown = open ? rows : rows.slice(-4);
  const model = rows.at(-1)?.model ?? '';
  const fixes = rows.filter((r) => r.verdict !== 'allowed').length;
  return (
    <Card>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={open ? 'Show fewer coordinator steps' : 'Show all coordinator steps'}
        onPress={() => setOpen((v) => !v)}
        style={styles.header}>
        <Sparkles size={16} color={colors.heroStart} />
        <Text style={styles.label}>AI COORDINATOR</Text>
        <Text style={styles.model}>{model === 'rules-only' ? 'safety rules' : model}</Text>
        {open ? <ChevronUp size={18} color={colors.muted} /> : <ChevronDown size={18} color={colors.muted} />}
      </Pressable>
      {shown.map((d) => (
        <Row key={d.id} d={d} name={(id) => names.get(id)} />
      ))}
      <Text style={styles.foot}>
        {rows.length} steps{fixes ? ` · ${fixes} checked and adjusted by HereO’s safety rules` : ' · all passed HereO’s safety rules'}
      </Text>
    </Card>
  );
}

function Row({ d, name }: { d: AgentDecision; name: (id: string) => string | undefined }) {
  const v = VERDICT[d.verdict];
  return (
    <View style={styles.row} accessible accessibilityLabel={`${describeDecision(d, name)}, ${v.label}`}>
      <v.Icon size={16} color={v.color} style={{ marginTop: 3 }} />
      <View style={{ flex: 1 }}>
        <Text style={styles.text}>{describeDecision(d, name)}</Text>
        {d.verdict !== 'allowed' && d.reason && <Text style={[styles.reason, { color: v.color }]}>{d.reason}</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  label: { fontSize: 12, fontWeight: '800', letterSpacing: 1.2, color: colors.ink },
  model: { flex: 1, fontSize: 12, color: colors.muted, textAlign: 'right', marginRight: 4 },
  row: { flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' },
  text: { fontSize: 15, lineHeight: 21, color: colors.ink },
  reason: { fontSize: 13, lineHeight: 18, fontFamily: fonts.displayMedium },
  foot: { fontSize: 12, color: colors.muted },
});
