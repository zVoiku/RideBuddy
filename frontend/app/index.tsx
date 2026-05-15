import { useEffect } from 'react';
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { getToken } from '../src/api';
import { theme } from '../src/theme';

export default function Index() {
  const router = useRouter();
  useEffect(() => {
    (async () => {
      const t = await getToken();
      router.replace(t ? '/home' : '/login');
    })();
  }, []);
  return (
    <View style={styles.c} testID="splash-screen">
      <View style={styles.icon}>
        <Ionicons name="car-sport" size={48} color={theme.colors.inverse} />
      </View>
      <Text style={styles.brand}>Ride Buddy</Text>
      <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 16 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  c: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.background },
  icon: { width: 88, height: 88, borderRadius: 22, backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center' },
  brand: { fontSize: 32, fontWeight: '900', color: theme.colors.textPrimary, letterSpacing: -0.6, marginTop: 16 },
});
