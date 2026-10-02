import { Linking, Pressable, Text } from 'react-native';

import { Card } from './ui';

/** react-native-maps has no web build; link out to a map instead. */
export function IncidentMap({ lat, lng, label }: { lat: number | null; lng: number | null; label: string }) {
  if (lat == null || lng == null) return null;
  return (
    <Pressable onPress={() => Linking.openURL(`https://maps.google.com/?q=${lat},${lng}`)}>
      <Card>
        <Text>Open {label} in Maps</Text>
      </Card>
    </Pressable>
  );
}
