import { StyleSheet, View } from 'react-native';
import MapView, { Marker } from 'react-native-maps';

import { colors, radius } from '@/lib/theme';

/**
 * The person's live location. Guardian positions are deliberately not shown:
 * the brief and status chips say who is coming without exposing where
 * volunteers are.
 */
export function IncidentMap({ lat, lng, label }: { lat: number | null; lng: number | null; label: string }) {
  if (lat == null || lng == null) return null;
  return (
    <View style={styles.wrap}>
      <MapView
        style={StyleSheet.absoluteFill}
        region={{ latitude: lat, longitude: lng, latitudeDelta: 0.008, longitudeDelta: 0.008 }}
        showsUserLocation
        pitchEnabled={false}>
        <Marker coordinate={{ latitude: lat, longitude: lng }} title={label} pinColor={colors.alert} />
      </MapView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { height: 200, borderRadius: radius.card, overflow: 'hidden', backgroundColor: colors.mist },
});
