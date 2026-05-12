import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="dark" />
        <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="login" />
          <Stack.Screen name="otp" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="booking/estimate" />
          <Stack.Screen name="booking/[id]" />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
