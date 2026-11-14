// Muse Dispatcher on the phone (Meta hackathon, Nov 2026): talk to HereO,
// share a privacy-blurred photo of where you are, and watch what the AI
// coordinator did and why.

import {
  AudioQuality,
  IOSOutputFormat,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
  type RecordingOptions,
} from 'expo-audio';
import * as ImagePicker from 'expo-image-picker';
import { useCallback, useEffect, useRef, useState } from 'react';

import { supabase } from './supabase';

/** Muse Voice Transcribe wants WAV: mono 16-bit PCM at 16 kHz. */
export const WAV_16K: RecordingOptions = {
  extension: '.wav',
  sampleRate: 16000,
  numberOfChannels: 1,
  bitRate: 256000,
  android: { outputFormat: 'default', audioEncoder: 'default' },
  ios: {
    outputFormat: IOSOutputFormat.LINEARPCM,
    audioQuality: AudioQuality.HIGH,
    linearPCMBitDepth: 16,
    linearPCMIsBigEndian: false,
    linearPCMIsFloat: false,
  },
  web: {},
};

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
export function bytesToBase64(bytes: Uint8Array): string {
  let out = '';
  let i = 0;
  for (; i + 2 < bytes.length; i += 3) {
    const n = (bytes[i] << 16) | (bytes[i + 1] << 8) | bytes[i + 2];
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + B64[(n >> 6) & 63] + B64[n & 63];
  }
  if (i < bytes.length) {
    const n = (bytes[i] << 16) | ((bytes[i + 1] ?? 0) << 8);
    out += B64[(n >> 18) & 63] + B64[(n >> 12) & 63] + (i + 1 < bytes.length ? B64[(n >> 6) & 63] : '=') + '=';
  }
  return out;
}

export type VoiceState = 'idle' | 'recording' | 'sending' | 'sent' | 'error';

/** Press-and-hold voice report. Release sends it to Muse Voice Transcribe. */
export function useVoiceReport(incidentId: string) {
  const recorder = useAudioRecorder(WAV_16K);
  const [state, setState] = useState<VoiceState>('idle');
  const [transcript, setTranscript] = useState<string | null>(null);
  const startedAt = useRef(0);

  const start = useCallback(async () => {
    const perm = await requestRecordingPermissionsAsync();
    if (!perm.granted) {
      setState('error');
      return;
    }
    await setAudioModeAsync({ allowsRecording: true, playsInSilentMode: true });
    await recorder.prepareToRecordAsync();
    recorder.record();
    startedAt.current = Date.now();
    setState('recording');
  }, [recorder]);

  const stop = useCallback(async () => {
    if (!recorder.isRecording) return;
    await recorder.stop();
    // Hand the audio session back to playback (the siren may still need it).
    await setAudioModeAsync({ allowsRecording: false, playsInSilentMode: true });
    if (Date.now() - startedAt.current < 700 || !recorder.uri) {
      setState('idle');
      return;
    }
    setState('sending');
    try {
      const buf = await (await fetch(recorder.uri)).arrayBuffer();
      const { data, error } = await supabase.functions.invoke('muse-voice', {
        body: { incident_id: incidentId, audio_base64: bytesToBase64(new Uint8Array(buf)) },
      });
      if (error) throw error;
      setTranscript(typeof data?.transcript === 'string' ? data.transcript : null);
      setState(data?.status === 'ok' ? 'sent' : 'error');
    } catch (err) {
      console.warn('voice report failed', err);
      setState('error');
    }
  }, [incidentId, recorder]);

  return { state, transcript, start, stop };
}

/** Lets her take or pick a photo of where she is; the server blurs faces and plates before anyone sees it. */
export async function shareScene(incidentId: string, source: 'camera' | 'library') {
  const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.6, base64: true, exif: false };
  if (source === 'camera') {
    const perm = await ImagePicker.requestCameraPermissionsAsync();
    if (!perm.granted) throw new Error('Camera permission is off. You can still use a photo from your library.');
  }
  const res = source === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
  if (res.canceled || !res.assets[0]?.base64) return null;
  const { data, error } = await supabase.functions.invoke('muse-scene', {
    body: { incident_id: incidentId, image_base64: res.assets[0].base64 },
  });
  if (error) throw error;
  return data as { status: string; description?: string; blurred?: number };
}

/** Signed URL for a blurred scene photo (participants only, by storage policy). */
export function useSceneUrl(path: string | null | undefined) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    if (!path) return;
    supabase.storage
      .from('scenes')
      .createSignedUrl(path, 600)
      .then(({ data }) => live && setUrl(data?.signedUrl ?? null));
    return () => {
      live = false;
    };
  }, [path]);
  return path ? url : null;
}

export interface AgentDecision {
  id: number;
  run_id: string;
  phase: 'dispatch' | 'reassess';
  step: number;
  tool: string;
  args: Record<string, unknown>;
  verdict: 'allowed' | 'changed' | 'blocked';
  reason: string | null;
  model: string;
  latency_ms: number | null;
  created_at: string;
}

/** The coordinator's decision log for an incident, kept live. */
export function useAgentDecisions(incidentId: string) {
  const [rows, setRows] = useState<AgentDecision[]>([]);
  useEffect(() => {
    const load = async () => {
      const { data } = await supabase
        .from('agent_decisions')
        .select('*')
        .eq('incident_id', incidentId)
        .order('id', { ascending: true });
      if (data) setRows(data as AgentDecision[]);
    };
    load();
    const channel = supabase
      .channel(`agent:${incidentId}:${Math.random().toString(36).slice(2)}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'agent_decisions', filter: `incident_id=eq.${incidentId}` }, load)
      .subscribe();
    const poll = setInterval(load, 15_000);
    return () => {
      clearInterval(poll);
      supabase.removeChannel(channel);
    };
  }, [incidentId]);
  return rows;
}

/** Same rule as the server: UK and Ireland dial 999, everywhere else in our plan 911. */
export function emergencyNumber(lat: number | null | undefined, lng: number | null | undefined): '999' | '911' {
  if (lat == null || lng == null) return '911';
  return lat > 49.8 && lat < 61 && lng > -11 && lng < 2.1 ? '999' : '911';
}

const TOOL_LABEL: Record<string, string> = {
  set_assessment: 'Assessed the situation',
  assign_hero: 'Sent a hero',
  recommend_emergency_call: 'Recommended an emergency call',
  write_brief: 'Wrote your brief',
  post_note: 'Posted a note',
  finish: 'Done for now',
  'guard:presence_floor': 'Safety rule: sent the nearest hero',
  'guard:brief_fallback': 'Safety rule: wrote a brief',
};

export function describeDecision(d: AgentDecision, heroName?: (id: string) => string | undefined): string {
  const base = TOOL_LABEL[d.tool] ?? d.tool;
  const a = d.args ?? {};
  if (d.tool === 'set_assessment') return `${base}: ${String(a.urgency ?? '')}${a.category ? `, ${String(a.category)}` : ''}`;
  if (d.tool === 'assign_hero') {
    const who = typeof a.user_id === 'string' ? heroName?.(a.user_id) : undefined;
    return `${base}${who ? ` (${who})` : ''}: “${String(a.job ?? '')}”`;
  }
  if (d.tool === 'recommend_emergency_call') return `${base}: ${String(a.reason ?? '')}`;
  if (d.tool === 'post_note') return `${base}: “${String(a.text ?? '')}”`;
  return base;
}
