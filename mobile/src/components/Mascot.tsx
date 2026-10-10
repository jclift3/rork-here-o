import { Image } from 'expo-image';
import type { StyleProp } from 'react-native';
import type { ImageStyle } from 'expo-image';

const ART = require('../../assets/images/icon.png');

/** The HereO hero: a caped grandmother watching over the neighbourhood from a rooftop. */
export function Mascot({ size, radius = size / 6, style }: { size: number; radius?: number; style?: StyleProp<ImageStyle> }) {
  return (
    <Image
      source={ART}
      style={[{ width: size, height: size, borderRadius: radius }, style]}
      accessible
      accessibilityRole="image"
      accessibilityLabel="HereO hero watching over the neighbourhood"
    />
  );
}
