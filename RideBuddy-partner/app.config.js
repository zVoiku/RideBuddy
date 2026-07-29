// Dynamic Expo app config.
//
// Keeps the Google Maps API key OUT of source control: it is injected at build
// time from EXPO_PUBLIC_GOOGLE_MAPS_KEY (loaded from this app's own .env locally,
// or from an EAS secret in cloud builds) into the react-native-maps config plugin,
// which links the native Google Maps SDK and sets the key on both iOS and Android.
//
// The same env var is read by src/maps.ts for the Places/Directions/Static REST
// APIs, so a single variable powers the whole Google Maps integration.
module.exports = ({ config }) => {
  const googleMapsApiKey = process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY || '';

  return {
    ...config,
    plugins: [
      ...(config.plugins || []),
      [
        'react-native-maps',
        {
          iosGoogleMapsApiKey: googleMapsApiKey,
          androidGoogleMapsApiKey: googleMapsApiKey,
        },
      ],
    ],
  };
};
