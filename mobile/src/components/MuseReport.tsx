// Talk to HereO and share where you are (Meta hackathon, Nov 2026).
// Hold to talk: Muse Voice Transcribe turns it into text for the coordinator.
// Share where I am: a photo, with faces and plates blurred by SAM 3.1 first.

import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { Camera, ImageIcon, Mic, ShieldCheck } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { Label, ModelChip, night, Panel } from '@/components/MissionControl';
import { shareScene, useSceneUrl, useVoiceReport } from '@/lib/muse';
import { friendlyError } from '@/lib/supabase';
import { colors, fonts, space } from '@/lib/theme';
import type { IncidentEvent } from '@/lib/types';

export function TalkToHereO({ incidentId }: { incidentId: string }) {
  const voice = useVoiceReport(incidentId);
  const [sharing, setSharing] = useState(false);

  const hint =
    voice.state === 'recording'
      ? 'Listening… let go to send'
      : voice.state === 'sending'
        ? 'Sending to HereO…'
        : voice.state === 'sent'
          ? 'Sent. Hold again to add more.'
          : voice.state === 'error'
            ? 'Couldn’t send that. Try again, or type below.'
            : 'Hold to tell HereO what’s happening';

  const share = (source: 'camera' | 'library') => async () => {
    setSharing(true);
    try {
      const res = await shareScene(incidentId, source);
      if (res?.status === 'not_shared') Alert.alert('Photo not shared', 'The privacy blur was unavailable, so HereO kept your photo off the record.');
    } catch (err) {
      Alert.alert('Could not share the photo', friendlyError(err));
    }
    setSharing(false);
  };

  return (
    <Panel>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Label>TALK TO HEREO</Label>
        <ModelChip label="Muse Voice" />
      </View>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel="Hold to talk to HereO"
        accessibilityHint="Records while you hold, sends when you let go"
        onPressIn={() => {
          if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
          voice.start();
        }}
        onPressOut={voice.stop}
        style={[styles.talk, voice.state === 'recording' && styles.talkActive]}>
        {voice.state === 'sending' ? <ActivityIndicator color={colors.paper} /> : <Mic color={colors.paper} size={24} />}
        <Text style={styles.talkText} numberOfLines={2}>
          {hint}
        </Text>
      </Pressable>
      {voice.transcript && <Text style={styles.transcript}>“{voice.transcript}”</Text>}
      <View style={styles.row}>
        <Pressable accessibilityRole="button" onPress={share('camera')} disabled={sharing} style={styles.small}>
          <Camera size={18} color={night.text} />
          <Text style={styles.smallText}>Photo of where I am</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Share a photo from your library" onPress={share('library')} disabled={sharing} style={[styles.small, { flex: 0 }]}>
          {sharing ? <ActivityIndicator color={night.text} /> : <ImageIcon size={18} color={night.text} />}
        </Pressable>
      </View>
      <View style={styles.privacy}>
        <ShieldCheck size={14} color={night.muted} />
        <Text style={styles.privacyText}>SAM 3.1 blurs faces and number plates before anyone sees your photo.</Text>
      </View>
    </Panel>
  );
}

/** The latest blurred scene photo and what the AI says about the place. */
export function SceneCard({ path, events, title = 'Where they are' }: { path: string | null; events: IncidentEvent[]; title?: string }) {
  const url = useSceneUrl(path);
  const latest = [...events].reverse().find((e) => e.kind === 'scene');
  if (!path && !latest) return null;
  const description = latest?.body?.replace(/\s*\[\d+ blurred\]$/, '') ?? '';
  const blurred = latest?.body?.match(/\[(\d+) blurred\]$/)?.[1];
  return (
    <Panel style={{ padding: 0, overflow: 'hidden' }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 14 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
          <Label>{title.toUpperCase()}</Label>
          {!!description && <ModelChip label="Muse Spark vision" />}
        </View>
      </View>
      {url ? (
        <View>
          <Image source={{ uri: url }} style={styles.photo} contentFit="cover" accessibilityLabel="Photo of the place, faces blurred" />
          <View style={styles.badge}>
            <ShieldCheck size={13} color={night.text} />
            <Text style={styles.badgeText}>
              {blurred && blurred !== '0' ? `SAM 3.1 · ${blurred} blurred` : 'SAM 3.1 · checked'}
            </Text>
          </View>
        </View>
      ) : null}
      <View style={{ paddingHorizontal: 16, paddingBottom: 16, gap: 8 }}>
        {!!description && <Text style={styles.description}>{description}</Text>}
      </View>
    </Panel>
  );
}

const styles = StyleSheet.create({
  talk: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: 'rgba(232,51,139,0.22)',
    borderWidth: 1,
    borderColor: 'rgba(255,122,184,0.55)',
    borderRadius: 18,
    minHeight: 64,
    paddingHorizontal: space.md,
  },
  talkActive: { backgroundColor: colors.alert },
  talkText: { flex: 1, color: night.text, fontFamily: fonts.displayMedium, fontSize: 17 },
  transcript: { fontSize: 15, lineHeight: 21, color: night.text, fontStyle: 'italic' },
  row: { flexDirection: 'row', gap: space.sm },
  small: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    borderWidth: 1.5,
    borderColor: night.line,
    borderRadius: 12,
    minHeight: 48,
    paddingHorizontal: space.md,
  },
  smallText: { fontFamily: fonts.displayMedium, fontSize: 15, color: night.text },
  privacy: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  privacyText: { flex: 1, fontSize: 12, color: night.muted },
  photo: { width: '100%', aspectRatio: 4 / 3, backgroundColor: night.raised },
  badge: {
    position: 'absolute',
    left: 12,
    bottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(11,11,15,0.75)',
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
  },
  badgeText: { color: night.text, fontSize: 12, fontWeight: '800', letterSpacing: 0.3 },
  description: { fontSize: 17, lineHeight: 24, color: night.text },
});
