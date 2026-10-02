import * as Location from 'expo-location';

export interface Coords {
  lat: number;
  lng: number;
}

/**
 * Best position we can get quickly. In an emergency a slightly stale fix now
 * beats a perfect one in 20 seconds, so this tries the cached fix first and
 * caps the fresh lookup.
 */
export async function getQuickPosition(timeoutMs = 4000): Promise<Coords | null> {
  try {
    const perm = await Location.requestForegroundPermissionsAsync();
    if (perm.status !== 'granted') return null;
    const last = await Location.getLastKnownPositionAsync({ maxAge: 120_000, requiredAccuracy: 200 });
    if (last) return { lat: last.coords.latitude, lng: last.coords.longitude };
    const fresh = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs)),
    ]);
    return fresh ? { lat: fresh.coords.latitude, lng: fresh.coords.longitude } : null;
  } catch {
    return null;
  }
}

/** Streams position updates while an incident is open. */
export async function watchPosition(onUpdate: (c: Coords) => void): Promise<() => void> {
  const perm = await Location.getForegroundPermissionsAsync();
  if (perm.status !== 'granted') return () => {};
  const sub = await Location.watchPositionAsync(
    { accuracy: Location.Accuracy.High, distanceInterval: 15, timeInterval: 10_000 },
    (loc) => onUpdate({ lat: loc.coords.latitude, lng: loc.coords.longitude }),
  );
  return () => sub.remove();
}
