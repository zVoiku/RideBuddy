import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar style="light" />
        <Stack screenOptions={{ headerShown: false, animation: 'fade' }}>
          <Stack.Screen name="index" />
          <Stack.Screen name="login" />
          <Stack.Screen name="otp" />
          <Stack.Screen name="onboarding/profile" />
          <Stack.Screen name="onboarding/car-make" />
          <Stack.Screen name="onboarding/car-model" />
          <Stack.Screen name="home" />
          <Stack.Screen name="bookings" />
          <Stack.Screen name="booking/summary" />
          <Stack.Screen name="booking/payment" />
          <Stack.Screen name="booking/finding" />
          <Stack.Screen name="booking/[id]" />
        </Stack>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}
