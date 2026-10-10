import { Phone } from 'lucide-react-native';
import { useEffect, useState } from 'react';
import { Animated, Easing, KeyboardAvoidingView, Modal, Platform, StyleSheet, Text, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Body, Button } from '@/components/ui';
import { useRingFlow } from '@/lib/ring';
import { colors, fonts, radius, space } from '@/lib/theme';

/**
 * Full screen while her siren plays: a red and white strobe, the cancel
 * window, and the two things she needs (call 911, I'm OK). "Hide" shows the
 * request screen underneath; the siren keeps going until she ends it.
 */
export function AlarmOverlay({
  onCall911,
  onImOk,
  onCancelWindow,
  onHide,
}: {
  onCall911: () => void;
  onImOk: () => void;
  onCancelWindow: () => void;
  onHide: () => void;
}) {
  const flow = useRingFlow();
  const [hidden, setHidden] = useState(false);
  const [strobe] = useState(() => new Animated.Value(0));
  const visible = flow.phase === 'countdown' || (flow.siren && !hidden);

  useEffect(() => {
    if (!visible || !flow.siren) return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(strobe, { toValue: 1, duration: 120, easing: Easing.linear, useNativeDriver: false }),
        Animated.timing(strobe, { toValue: 0, duration: 380, easing: Easing.linear, useNativeDriver: false }),
      ]),
    );
    loop.start();
    return () => loop.stop();
  }, [visible, flow.siren, strobe]);

  if (!visible) return null;
  const background = flow.siren
    ? strobe.interpolate({ inputRange: [0, 1], outputRange: [colors.alert, colors.paper] })
    : colors.ink;
  const counting = flow.phase === 'countdown';

  return (
    <Modal visible animationType="fade" presentationStyle="fullScreen" onRequestClose={() => {
        onHide();
        setHidden(true);
      }}>
      <Animated.View style={[styles.fill, { backgroundColor: background }]}>
        <SafeAreaView style={styles.inner} edges={['top', 'bottom']}>
          <View style={styles.panel}>
            <Text style={styles.big}>{counting ? `Ringing people nearby in ${flow.secondsLeft}` : 'HereO ring is on'}</Text>
            <Body style={styles.copy}>
              {counting
                ? 'Your circle and heroes already know. Cancel now if you pressed by mistake.'
                : 'Your circle, heroes and HereO users nearby have been alerted and can see where you are.'}
            </Body>
            {counting ? (
              <Button label="Cancel, I pressed by mistake" variant="outline" tall onPress={onCancelWindow} />
            ) : (
              <>
                <Button
                  label="Call 911"
                  variant="alert"
                  tall
                  icon={<Phone color={colors.paper} size={20} />}
                  onPress={onCall911}
                />
                <Button label="I'm OK" variant="safe" tall onPress={onImOk} />
                <Button label="Hide this screen" variant="ghost" onPress={() => {
                    onHide();
                    setHidden(true);
                  }} />
              </>
            )}
          </View>
        </SafeAreaView>
      </Animated.View>
    </Modal>
  );
}

/** Asks for her PIN to end the request. The duress PIN is accepted here too, and looks the same. */
export function PinSheet({
  visible,
  title,
  onSubmit,
  onClose,
}: {
  visible: boolean;
  title: string;
  onSubmit: (pin: string) => Promise<string | null>;
  onClose: () => void;
}) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    const message = await onSubmit(pin);
    setBusy(false);
    setPin('');
    setError(message);
  };

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <KeyboardAvoidingView style={styles.sheetWrap} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.sheet}>
          <Text style={styles.sheetTitle}>{title}</Text>
          <TextInput
            value={pin}
            onChangeText={(t) => setPin(t.replace(/\D/g, '').slice(0, 8))}
            keyboardType="number-pad"
            secureTextEntry
            autoFocus
            accessibilityLabel="PIN"
            placeholder="PIN"
            placeholderTextColor={colors.muted}
            style={styles.pin}
            onSubmitEditing={submit}
          />
          {error && <Body style={{ color: colors.alert }}>{error}</Body>}
          <Button label="Confirm" loading={busy} disabled={pin.length < 4} onPress={submit} />
          <Button
            label="Back"
            variant="ghost"
            onPress={() => {
              setPin('');
              setError(null);
              onClose();
            }}
          />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fill: { flex: 1 },
  inner: { flex: 1, justifyContent: 'flex-end', padding: space.lg },
  panel: { backgroundColor: colors.paper, borderRadius: radius.card, padding: space.lg, gap: space.md },
  big: { fontFamily: fonts.display, fontSize: 28, color: colors.ink },
  copy: { color: colors.ink },
  sheetWrap: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(11,11,15,0.4)' },
  sheet: { backgroundColor: colors.paper, padding: space.lg, gap: space.md, borderTopLeftRadius: 20, borderTopRightRadius: 20 },
  sheetTitle: { fontFamily: fonts.display, fontSize: 22, color: colors.ink },
  pin: {
    fontFamily: fonts.display,
    fontSize: 32,
    letterSpacing: 12,
    textAlign: 'center',
    borderWidth: 2,
    borderColor: colors.ink,
    borderRadius: radius.card,
    paddingVertical: space.md,
    color: colors.ink,
  },
});
