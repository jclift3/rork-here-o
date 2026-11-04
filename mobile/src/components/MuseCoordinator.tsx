// What the AI coordinator did on this incident and what the safety rules did
// about it (Meta hackathon, Nov 2026). A live feed on the dark incident
// screen: each step tagged with the Meta model, or the rule, that did it.

import { Check, ChevronDown, ChevronUp, PenLine, ShieldAlert, Sparkles } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { ModelChip, night, Panel } from '@/components/MissionControl';
import { describeDecision, useAgentDecisions, type AgentDecision } from '@/lib/muse';
import { colors, fonts, space } from '@/lib/theme';
import type { Responder } from '@/lib/types';

const VERDICT = {
  allowed: { Icon: Check, color: '#3CCB7F', label: 'done' },
  changed: { Icon: PenLine, color: '#FF7AB8', label: 'adjusted by safety rules' },
  blocked: { Icon: ShieldAlert, color: '#FF6B6E', label: 'blocked by safety rules' },
} as const;

/** "muse-spark-1.3" → "Muse Spark". */
export function modelName(model: string): string {
  if (!model || model === 'rules-only') return 'Safety rules';
  if (model.startsWith('muse-spark')) return 'Muse Spark';
  if (model.startsWith('muse-voice')) return 'Muse Voice';
  if (model.startsWith('sam')) return 'SAM 3.1';
  return model;
}

export function MuseCoordinator({ incidentId, responders }: { incidentId: string; responders: Responder[] }) {
  const rows = useAgentDecisions(incidentId).filter((d) => d.tool !== 'finish');
  const [open, setOpen] = useState(false);
  if (!rows.length) return null;
  const names = new Map(responders.map((r) => [r.user_id, r.profiles?.display_name?.split(' ')[0] ?? 'a hero']));
  const shown = open ? rows : rows.slice(-4);
  const fixes = rows.filter((r) => r.verdict !== 'allowed' || r.tool.startsWith('guard:')).length;
  const ms = rows.find((r) => r.latency_ms != null)?.latency_ms;
  return (
    <Panel>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={open ? 'Show fewer coordinator steps' : 'Show all coordinator steps'}
        onPress={() => setOpen((v) => !v)}
        style={styles.header}>
        <Sparkles size={16} color={colors.heroStart} />
        <Text style={styles.label}>AI COORDINATOR</Text>
        <View style={{ flex: 1 }} />
        {rows.length > 4 && (open ? <ChevronUp size={18} color={night.muted} /> : <ChevronDown size={18} color={night.muted} />)}
      </Pressable>
      <View style={{ gap: space.md }}>
        {shown.map((d, i) => (
          <Row key={d.id} d={d} name={(id) => names.get(id)} chip={i === 0 || chipOf(d) !== chipOf(shown[i - 1])} />
        ))}
      </View>
      <Text style={styles.foot}>
        {rows.length} steps{ms ? ` · planned in ${(ms / 1000).toFixed(1)} s` : ''}
        {fixes ? ` · ${fixes} checked by HereO’s safety rules` : ' · all passed HereO’s safety rules'}
      </Text>
    </Panel>
  );
}

const chipOf = (d: AgentDecision) => (d.tool.startsWith('guard:') ? 'Safety rules' : modelName(d.model));

function Row({ d, name, chip }: { d: AgentDecision; name: (id: string) => string | undefined; chip: boolean }) {
  const v = VERDICT[d.verdict];
  const rule = d.tool.startsWith('guard:');
  return (
    <View style={styles.row} accessible accessibilityLabel={`${describeDecision(d, name)}, ${v.label}`}>
      <View style={[styles.dot, { borderColor: v.color }]}>
        <v.Icon size={12} color={v.color} strokeWidth={3} />
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        {chip && <ModelChip label={chipOf(d)} tone={rule ? 'rules' : d.verdict === 'blocked' ? 'alert' : 'meta'} />}
        <Text style={styles.text}>{describeDecision(d, name)}</Text>
        {d.verdict !== 'allowed' && d.reason && <Text style={[styles.reason, { color: v.color }]}>{d.reason}</Text>}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  label: { fontSize: 12, fontWeight: '800', letterSpacing: 1.4, color: night.muted },
  row: { flexDirection: 'row', gap: space.sm, alignItems: 'flex-start' },
  dot: { width: 22, height: 22, borderRadius: 11, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center', marginTop: 1 },
  text: { fontSize: 15, lineHeight: 21, color: night.text },
  reason: { fontSize: 13, lineHeight: 18, fontFamily: fonts.displayMedium },
  foot: { fontSize: 12, color: night.faint },
});
