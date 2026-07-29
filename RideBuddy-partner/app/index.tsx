// Auth gate: sends the partner to the tabs or to login once the stored session
// has been checked.
import React from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Redirect } from 'expo-router';
import { useRB } from '../src/store';
import { theme } from '../src/theme';

export default function Index() {
  const { ready, partner } = useRB();

  if (!ready) {
    return (
      <View style={styles.splash}>
        <ActivityIndicator color={theme.colors.brandPrimary} />
      </View>
    );
  }

  return <Redirect href={partner ? '/(tabs)/home' : '/login'} />;
}

const styles = StyleSheet.create({
  splash: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: theme.colors.surfacePage,
  },
});
