import type { ConfigContext, ExpoConfig } from 'expo/config';

// app.json holds the config; this only adds the Android Google Maps key when
// it is set (locally in .env, or as an EAS environment variable). Without it
// the app hides its maps on Android rather than crash (src/lib/maps.ts).
export default ({ config }: ConfigContext): ExpoConfig => {
  const apiKey = process.env.GOOGLE_MAPS_ANDROID_API_KEY;
  if (!apiKey) return config as ExpoConfig;
  return {
    ...config,
    android: {
      ...config.android,
      config: { ...config.android?.config, googleMaps: { apiKey } },
    },
  } as ExpoConfig;
};
