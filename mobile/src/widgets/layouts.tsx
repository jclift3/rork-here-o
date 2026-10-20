// Lock-screen Live Activity and home-screen widget layouts for trips.
//
// Functions marked 'widget' are compiled to strings and run inside the iOS
// widget extension, where SwiftUI components and modifiers are globals. They
// can't use anything else from this file or the app, so colors and labels
// are written inline.
import { HStack, Image, Link, Spacer, Text, VStack } from '@expo/ui/swift-ui';
import { font, foregroundStyle, padding } from '@expo/ui/swift-ui/modifiers';
import type { LiveActivityComponent, WidgetEnvironment } from 'expo-widgets';

export type TripActivityProps = {
  /** "Walking home", "Running to the gym". */
  title: string;
  /** "Your circle is following". */
  subtitle: string;
  kind: 'walk' | 'run' | 'ride';
  /** Check-in deadline, epoch milliseconds. */
  dueAt: number;
  /** Set once the trip ends: "Home safe", "Trip ended". */
  ended?: string;
};

export const TripActivity: LiveActivityComponent<TripActivityProps> = (props) => {
  'widget';
  const symbol = props.kind === 'run' ? 'figure.run' : props.kind === 'ride' ? 'bicycle' : 'figure.walk';
  const pink = '#E8338B';
  const icon = <Image systemName={symbol} color={pink} size={22} />;
  const timer = props.ended ? (
    <Text modifiers={[font({ size: 15, weight: 'semibold' })]}>{props.ended}</Text>
  ) : (
    <Text
      date={new Date(props.dueAt)}
      dateStyle="timer"
      modifiers={[font({ size: 17, weight: 'semibold', design: 'rounded' }), foregroundStyle(pink)]}
    />
  );
  return {
    banner: (
      <HStack spacing={12} modifiers={[padding({ all: 16 })]}>
        {icon}
        <VStack alignment="leading" spacing={2}>
          <Text modifiers={[font({ size: 17, weight: 'semibold' })]}>{props.title}</Text>
          <Text modifiers={[font({ size: 13 }), foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}>
            {props.ended ? 'Your circle knows you arrived' : props.subtitle}
          </Text>
        </VStack>
        <Spacer />
        <VStack alignment="trailing" spacing={2}>
          {props.ended ? null : (
            <Text modifiers={[font({ size: 11 }), foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}>
              Check in
            </Text>
          )}
          {timer}
        </VStack>
      </HStack>
    ),
    compactLeading: icon,
    compactTrailing: timer,
    minimal: icon,
    expandedLeading: icon,
    expandedCenter: <Text modifiers={[font({ size: 15, weight: 'semibold' })]}>{props.title}</Text>,
    expandedTrailing: timer,
  };
};

export type StartTripWidgetProps = {
  /** The trip in progress, if any. Omit it rather than null: null can't be saved. */
  active?: { title: string; dueAt: number; url: string };
};

export const StartTripWidget = (props: StartTripWidgetProps, env: WidgetEnvironment) => {
  'widget';
  const pink = '#E8338B';
  if (props.active) {
    return (
      <Link destination={props.active.url}>
        <VStack alignment="leading" spacing={4}>
          <Text modifiers={[font({ size: 13 }), foregroundStyle(pink)]}>Trip in progress</Text>
          <Text modifiers={[font({ size: 17, weight: 'semibold' })]}>{props.active.title}</Text>
          <Text
            date={new Date(props.active.dueAt)}
            dateStyle="timer"
            modifiers={[font({ size: 22, weight: 'semibold', design: 'rounded' })]}
          />
        </VStack>
      </Link>
    );
  }
  const option = (kind: string, label: string, symbol: 'figure.walk' | 'figure.run' | 'bicycle') => (
    <Link destination={'hereo://walk?go=1&kind=' + kind}>
      <VStack spacing={6}>
        <Image systemName={symbol} color={pink} size={26} />
        <Text modifiers={[font({ size: 13, weight: 'semibold' })]}>{label}</Text>
      </VStack>
    </Link>
  );
  if (env.widgetFamily === 'systemSmall') {
    return (
      <Link destination="hereo://walk?go=1&kind=walk">
        <VStack alignment="leading" spacing={6}>
          <Image systemName="figure.walk" color={pink} size={30} />
          <Text modifiers={[font({ size: 17, weight: 'semibold' })]}>Walk home</Text>
          <Text modifiers={[font({ size: 12 }), foregroundStyle({ type: 'hierarchical', style: 'secondary' })]}>
            Your circle follows along
          </Text>
        </VStack>
      </Link>
    );
  }
  return (
    <VStack alignment="leading" spacing={10}>
      <Text modifiers={[font({ size: 15, weight: 'semibold' })]}>Start a trip</Text>
      <HStack spacing={24}>
        {option('walk', 'Walk', 'figure.walk')}
        {option('run', 'Run', 'figure.run')}
        {option('ride', 'Ride', 'bicycle')}
      </HStack>
    </VStack>
  );
};
