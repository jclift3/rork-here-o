import Constants from 'expo-constants';
import { Platform } from 'react-native';

/**
 * Google Maps on Android needs an API key baked into the build
 * (GOOGLE_MAPS_ANDROID_API_KEY, see app.config.ts). Without one, mounting a
 * MapView crashes the app, so map screens show a plain backdrop instead.
 */
export const mapsAvailable =
  Platform.OS !== 'android' || !!Constants.expoConfig?.android?.config?.googleMaps?.apiKey;
