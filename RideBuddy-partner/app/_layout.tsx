import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import * as SplashScreen from 'expo-splash-screen';
import { useFonts } from 'expo-font';
import {
  Urbanist_600SemiBold, Urbanist_700Bold, Urbanist_800ExtraBold,
} from '@expo-google-fonts/urbanist';
import {
  DMSans_400Regular, DMSans_500Medium, DMSans_600SemiBold,
} from '@expo-google-fonts/dm-sans';
import { Provider, useRB } from '../src/store';
import { Toast } from '../src/ui';
import { theme } from '../src/theme';

SplashScreen.preventAutoHideAsync().catch(() => {});

function ToastHost() {
  const { toast, hideToast } = useRB();
  if (!toast) return null;
  return <Toast key={toast.key} type={toast.type} title={toast.title} body={toast.body} onDone={hideToast} />;
}

export default function RootLayout() {
  const [loaded] = useFonts({
    Urbanist_600SemiBold, Urbanist_700Bold, Urbanist_800ExtraBold,
    DMSans_400Regular, DMSans_500Medium, DMSans_600SemiBold,
  });

  useEffect(() => {
    if (loaded) SplashScreen.hideAsync().catch(() => {});
  }, [loaded]);

  if (!loaded) return null;

  return (
    <SafeAreaProvider>
      <Provider>
        <StatusBar style="auto" />
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: theme.colors.surfacePage },
            animation: 'slide_from_right',
          }}
        >
          <Stack.Screen name="index" />
          <Stack.Screen name="login" options={{ animation: 'fade' }} />
          <Stack.Screen name="otp" />
          <Stack.Screen name="(tabs)" options={{ animation: 'fade' }} />
          <Stack.Screen name="trip/[id]" />
          <Stack.Screen name="nav/[id]" options={{ animation: 'slide_from_bottom' }} />
        </Stack>
        <ToastHost />
      </Provider>
    </SafeAreaProvider>
  );
}
