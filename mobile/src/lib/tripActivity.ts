import { Platform } from 'react-native';

import type { TripKind } from './types';
import type { StartTripWidgetProps, TripActivityProps } from '../widgets/layouts';

/**
 * The lock-screen Live Activity and the home-screen "Start a trip" widget.
 *
 * Both need a development or store build on iOS. Expo Go has no widget
 * extension, so every call here quietly does nothing there and on Android.
 */

type Widgets = {
  activity: import('expo-widgets').LiveActivityFactory<TripActivityProps>;
  widget: import('expo-widgets').Widget<StartTripWidgetProps>;
};

let cached: Widgets | null | undefined;

function widgets(): Widgets | null {
  if (cached !== undefined) return cached;
  cached = null;
  if (Platform.OS !== 'ios') return cached;
  try {
    // Lazy: the native module throws when it's missing (Expo Go).
    /* eslint-disable @typescript-eslint/no-require-imports */
    const { createLiveActivity, createWidget } = require('expo-widgets') as typeof import('expo-widgets');
    const { StartTripWidget, TripActivity } = require('../widgets/layouts') as typeof import('../widgets/layouts');
    /* eslint-enable @typescript-eslint/no-require-imports */
    cached = {
      activity: createLiveActivity('TripActivity', TripActivity),
      widget: createWidget('StartTrip', StartTripWidget),
    };
  } catch {
    // No widget extension in this build.
  }
  return cached;
}

export type TripDisplay = { id: string; kind: TripKind; title: string; dueAt: Date };

/** Shows the trip on the lock screen and in the Dynamic Island, and on the widget. */
export async function showTrip(trip: TripDisplay) {
  const w = widgets();
  if (!w) return;
  const props: TripActivityProps = {
    title: trip.title,
    subtitle: 'Your circle is following',
    kind: trip.kind,
    dueAt: trip.dueAt.getTime(),
  };
  const url = `hereo://walk/${trip.id}`;
  try {
    const existing = w.activity.getInstances();
    if (existing.length) await Promise.all(existing.map((a) => a.update(props)));
    else w.activity.start(props, url);
  } catch (err) {
    console.warn('could not show trip Live Activity', err);
  }
  try {
    w.widget.updateSnapshot({ active: { title: trip.title, dueAt: props.dueAt, url } });
  } catch (err) {
    console.warn('could not update trip widget', err);
  }
}

/** Ends the Live Activity, showing `outcome` ("Home safe") briefly, and resets the widget. */
export async function hideTrip(outcome?: { kind: TripKind; title: string; label: string }) {
  const w = widgets();
  if (!w) return;
  try {
    await Promise.all(
      w.activity.getInstances().map((a) =>
        outcome
          ? a.end('default', { title: outcome.title, subtitle: '', kind: outcome.kind, dueAt: Date.now(), ended: outcome.label })
          : a.end('immediate'),
      ),
    );
  } catch (err) {
    console.warn('could not end trip Live Activity', err);
  }
  try {
    w.widget.updateSnapshot({ active: null });
  } catch (err) {
    console.warn('could not reset trip widget', err);
  }
}
