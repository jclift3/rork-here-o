// Talk to HereO and share where you are (Meta hackathon, Nov 2026).
// Hold to talk: Muse Voice Transcribe turns it into text for the coordinator.
// Share where I am: a photo, with faces and plates blurred by SAM 3.1 first.

import { Image } from 'expo-image';
import * as Haptics from 'expo-haptics';
import { Camera, ImageIcon, Mic, ShieldCheck } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';

import { Card } from '@/components/ui';
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
            : 'Hold and tell HereO what’s happening';

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
    <Card>
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
        <Text style={styles.talkText}>{hint}</Text>
      </Pressable>
      {voice.transcript && <Text style={styles.transcript}>“{voice.transcript}”</Text>}
      <View style={styles.row}>
        <Pressable accessibilityRole="button" onPress={share('camera')} disabled={sharing} style={styles.small}>
          <Camera size={18} color={colors.ink} />
          <Text style={styles.smallText}>Photo of where I am</Text>
        </Pressable>
        <Pressable accessibilityRole="button" accessibilityLabel="Share a photo from your library" onPress={share('library')} disabled={sharing} style={[styles.small, { flex: 0 }]}>
          {sharing ? <ActivityIndicator color={colors.ink} /> : <ImageIcon size={18} color={colors.ink} />}
        </Pressable>
      </View>
      <View style={styles.privacy}>
        <ShieldCheck size={14} color={colors.muted} />
        <Text style={styles.privacyText}>Faces and number plates are blurred before anyone sees your photo.</Text>
      </View>
    </Card>
  );
}

/** The latest blurred scene photo and what the AI says about the place. */
export function SceneCard({ path, events }: { path: string | null; events: IncidentEvent[] }) {
  const url = useSceneUrl(path);
  const latest = [...events].reverse().find((e) => e.kind === 'scene');
  if (!path && !latest) return null;
  const description = latest?.body?.replace(/\s*\[\d+ blurred\]$/, '') ?? '';
  const blurred = latest?.body?.match(/\[(\d+) blurred\]$/)?.[1];
  return (
    <Card>
      <Text style={styles.label}>WHERE THEY ARE</Text>
      {url && <Image source={{ uri: url }} style={styles.photo} contentFit="cover" accessibilityLabel="Photo of the place, faces blurred" />}
      {!!description && <Text style={styles.description}>{description}</Text>}
      <View style={styles.privacy}>
        <ShieldCheck size={14} color={colors.muted} />
        <Text style={styles.privacyText}>
          {blurred && blurred !== '0' ? `${blurred} faces or plates blurred by SAM 3.1.` : 'Checked for faces and plates by SAM 3.1.'}
        </Text>
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  talk: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    backgroundColor: colors.ink,
    borderRadius: 16,
    minHeight: 64,
    paddingHorizontal: space.md,
  },
  talkActive: { backgroundColor: colors.alert },
  talkText: { flex: 1, color: colors.paper, fontFamily: fonts.displayMedium, fontSize: 17 },
  transcript: { fontSize: 15, lineHeight: 21, color: colors.ink, fontStyle: 'italic' },
  row: { flexDirection: 'row', gap: space.sm },
  small: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    borderWidth: 2,
    borderColor: colors.ink,
    borderRadius: 12,
    minHeight: 48,
    paddingHorizontal: space.md,
  },
  smallText: { fontFamily: fonts.displayMedium, fontSize: 15, color: colors.ink },
  privacy: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  privacyText: { flex: 1, fontSize: 12, color: colors.muted },
  label: { fontSize: 12, fontWeight: '800', letterSpacing: 1.2, color: colors.ink },
  photo: { width: '100%', aspectRatio: 4 / 3, borderRadius: 12, backgroundColor: colors.mist },
  description: { fontSize: 16, lineHeight: 23, color: colors.ink },
});
