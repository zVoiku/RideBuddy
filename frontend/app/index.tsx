import { useEffect } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { getToken } from '../src/api';
import { theme } from '../src/theme';

export default function Index() {
  const router = useRouter();
  useEffect(() => {
    (async () => {
      const t = await getToken();
      router.replace(t ? '/(tabs)/home' : '/login');
    })();
  }, []);
  return (
    <View style={styles.c} testID="splash-screen">
      <Text style={styles.brand}>RideBuddy</Text>
      <ActivityIndicator color={theme.colors.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  c: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.background, gap: 16 },
  brand: { fontSize: 32, fontWeight: '800', color: theme.colors.primary, letterSpacing: -0.8 },
});
