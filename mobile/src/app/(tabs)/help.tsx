import { router } from 'expo-router';
import { Phone } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';

import { HoldToHelp } from '@/components/HoldToHelp';
import { Body, Button, Screen, TextField, Title } from '@/components/ui';
import { alertSendFailed, call911, raiseAlert } from '@/lib/incidents';
import { useMode } from '@/lib/mode';
import { useUserId } from '@/lib/session';
import { colors } from '@/lib/theme';

/** What a tap on the center button opens: add a few words, then hold, or call 911. */
export default function Help() {
  const userId = useUserId();
  const { mode } = useMode();
  const [note, setNote] = useState('');

  const send = async () => {
    try {
      const id = await raiseAlert({ userId, mode, trigger: 'tap', note });
      setNote('');
      router.push({ pathname: '/incident/[id]', params: { id } });
    } catch (err) {
      alertSendFailed(err);
    }
  };

  return (
    <Screen>
      <Title>Get help</Title>
      <Body muted>
        Optional: say what’s happening. It helps HereO send the right people and tell them what to do.
      </Body>
      <TextField
        value={note}
        onChangeText={setNote}
        placeholder="e.g. Someone is following me on 5th St"
        multiline
        maxLength={500}
        style={{ minHeight: 96, paddingTop: 14, textAlignVertical: 'top' }}
      />
      <View style={{ alignItems: 'center', paddingVertical: 16 }}>
        <HoldToHelp size={180} onComplete={send} />
      </View>
      <Button
        label="Call 911"
        variant="alert"
        tall
        icon={<Phone color={colors.paper} size={20} />}
        onPress={() => call911(null, userId, true)}
      />
    </Screen>
  );
}
