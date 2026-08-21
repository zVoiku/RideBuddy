// Ops console shell. A separate stack from the Buddy tabs — one session is one
// role, so an Ops user never sees the Buddy nav and vice versa.
import React from 'react';
import { Stack, Redirect } from 'expo-router';
import { useRB } from '../../src/store';

export default function OpsLayout() {
  const { ready, ops } = useRB();
  // Wait for the cold-start role check before deciding, or a refresh inside Ops
  // bounces to login for a frame.
  if (ready && !ops) return <Redirect href="/login" />;
  return <Stack screenOptions={{ headerShown: false, animation: 'fade' }} />;
}
