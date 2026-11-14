import { Text, View } from 'react-native';
import Svg, { Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

import { colors, fonts } from '@/lib/theme';

/** The HereO mark from the Figma welcome screen: a gradient square tucked into a shadowed block. */
export function LogoMark({ size = 32, inverted }: { size?: number; inverted?: boolean }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 32 32">
      <Defs>
        <LinearGradient id="g" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={colors.heroStart} />
          <Stop offset="1" stopColor={colors.heroEnd} />
        </LinearGradient>
      </Defs>
      <Path d="M8 4h20v20l-4 4H4V8z" fill={inverted ? colors.paper : colors.ink} />
      <Rect x="0" y="0" width="16" height="16" fill="url(#g)" />
    </Svg>
  );
}

export function Logo({ inverted, size = 28 }: { inverted?: boolean; size?: number }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }} accessibilityLabel="HereO">
      <LogoMark size={size} inverted={inverted} />
      <Text style={{ fontFamily: fonts.displayMedium, fontSize: size, color: inverted ? colors.paper : colors.ink }}>
        Here-O
      </Text>
    </View>
  );
}
