import type { BottomTabBarProps } from 'expo-router/tabs';
import { router } from 'expo-router';
import { Compass, House, MessageCircle, User } from 'lucide-react-native';
import { Alert, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { HoldToHelp } from './HoldToHelp';
import { raiseAlert } from '@/lib/incidents';
import { useMode } from '@/lib/mode';
import { useUserId } from '@/lib/session';
import { friendlyError } from '@/lib/supabase';
import { colors } from '@/lib/theme';

const ICONS = { home: House, discover: Compass, messages: MessageCircle, profile: User } as const;
const LABELS = { home: 'Home', discover: 'Discover', messages: 'Messages', profile: 'Profile' } as const;

/**
 * Figma's five-slot tab bar, with the center gradient button turned into the
 * help button: hold to send an alert from any tab, tap for the help sheet.
 */
export function HelpTabBar({ state, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  const userId = useUserId();
  const { mode } = useMode();

  const sendAlert = async () => {
    try {
      const id = await raiseAlert({ userId, mode, trigger: 'hold' });
      router.push({ pathname: '/incident/[id]', params: { id } });
    } catch (err) {
      Alert.alert("Couldn't send your alert", `${friendlyError(err)}\n\nIf you are in danger, call 911.`);
    }
  };

  return (
    <View style={[styles.bar, { paddingBottom: Math.max(insets.bottom, 10) }]}>
      {state.routes.map((route, index) => {
        const focused = state.index === index;
        if (route.name === 'help') {
          return (
            <View key={route.key} style={styles.center}>
              <HoldToHelp size={68} label={false} onComplete={sendAlert} onTap={() => navigation.navigate('help')} />
            </View>
          );
        }
        const name = route.name as keyof typeof ICONS;
        const Icon = ICONS[name];
        if (!Icon) return null;
        return (
          <Pressable
            key={route.key}
            accessibilityRole="tab"
            accessibilityState={{ selected: focused }}
            accessibilityLabel={LABELS[name]}
            onPress={() => {
              const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
              if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
            }}
            style={styles.tab}>
            <Icon size={26} strokeWidth={focused ? 2.4 : 1.6} color={focused ? colors.ink : colors.muted} />
            <Text style={[styles.label, { color: focused ? colors.ink : colors.muted }]}>{LABELS[name]}</Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: colors.paper,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.line,
    paddingTop: 8,
  },
  tab: { flex: 1, alignItems: 'center', gap: 2, minHeight: 48, justifyContent: 'center' },
  label: { fontSize: 11, fontWeight: '600' },
  center: { flex: 1, alignItems: 'center', marginTop: -28 },
});
