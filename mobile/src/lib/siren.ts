import { createAudioPlayer, setAudioModeAsync, setIsAudioActiveAsync, type AudioPlayer } from 'expo-audio';
import * as Haptics from 'expo-haptics';
import { Platform, Vibration } from 'react-native';

/**
 * The HereO siren ("Soar"): a short horn climb, looped at full volume, that
 * plays even with the ring switch on silent and keeps going if she locks the
 * phone. Apps can't raise the system volume on iOS, so it is as loud as her
 * volume allows.
 */
let player: AudioPlayer | null = null;
let playing = false;

export function isSirenPlaying() {
  return playing;
}

export async function startSiren() {
  if (Platform.OS === 'web' || playing) return;
  playing = true;
  try {
    await setAudioModeAsync({
      playsInSilentMode: true,
      shouldPlayInBackground: true,
      interruptionMode: 'doNotMix',
    });
    await setIsAudioActiveAsync(true);
    if (!player) {
      player = createAudioPlayer(require('../../assets/sounds/hereo-alarm.wav'));
      player.loop = true;
      player.volume = 1;
    }
    player.seekTo(0);
    player.play();
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    Vibration.vibrate([0, 600, 400], true);
  } catch (err) {
    console.warn('siren failed', err);
  }
}

export function stopSiren() {
  if (Platform.OS === 'web') return;
  playing = false;
  Vibration.cancel();
  try {
    player?.pause();
    // Hand the audio session back so her music or calls aren't held.
    setIsAudioActiveAsync(false).catch(() => {});
  } catch {
    // Already released.
  }
}
