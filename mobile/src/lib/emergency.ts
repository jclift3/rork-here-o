import * as Location from 'expo-location';
import { useEffect, useState } from 'react';

export type EmergencyNumber = '999' | '911';

// Time zones where the phone should dial 999 (UK, Crown dependencies, Ireland).
const ZONES_999 = new Set([
  'Europe/London',
  'Europe/Belfast',
  'Europe/Dublin',
  'Europe/Guernsey',
  'Europe/Jersey',
  'Europe/Isle_of_Man',
]);

/** Same rule as the server: UK and Ireland dial 999, everywhere else in our plan 911. */
export function numberForCoords(lat: number, lng: number): EmergencyNumber {
  return lat > 49.8 && lat < 61 && lng > -11 && lng < 2.1 ? '999' : '911';
}

/** Best guess with no location: the phone's time zone. */
function numberForTimeZone(): EmergencyNumber {
  try {
    const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    return zone && ZONES_999.has(zone) ? '999' : '911';
  } catch {
    return '911';
  }
}

let current: EmergencyNumber = numberForTimeZone();
const listeners = new Set<(n: EmergencyNumber) => void>();

/** The number to show and dial right now. Never waits on anything. */
export function currentEmergencyNumber(): EmergencyNumber {
  return current;
}

/**
 * Refines the guess from the last known position, if location is already
 * allowed. Never prompts, never waits for a fresh fix.
 */
export async function refreshEmergencyNumber(): Promise<EmergencyNumber> {
  try {
    const perm = await Location.getForegroundPermissionsAsync();
    if (perm.status === 'granted') {
      const last = await Location.getLastKnownPositionAsync({ maxAge: 24 * 3600_000 });
      if (last) setCurrent(numberForCoords(last.coords.latitude, last.coords.longitude));
    }
  } catch {
    // Keep the time zone guess.
  }
  return current;
}

/** Records a fresh position from anywhere in the app (help request, trip, presence). */
export function noteEmergencyPosition(lat: number, lng: number) {
  setCurrent(numberForCoords(lat, lng));
}

function setCurrent(n: EmergencyNumber) {
  if (n === current) return;
  current = n;
  listeners.forEach((l) => l(n));
}

/** "999" in the UK, "911" in the US; updates if the phone moves between them. */
export function useEmergencyNumber(): EmergencyNumber {
  const [n, setN] = useState(current);
  useEffect(() => {
    listeners.add(setN);
    refreshEmergencyNumber();
    return () => {
      listeners.delete(setN);
    };
  }, []);
  return n;
}
