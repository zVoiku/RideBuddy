import { useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { api } from '../../src/api';
import { theme } from '../../src/theme';

export default function Finding() {
  const { id, polyline } = useLocalSearchParams<{ id: string; polyline?: string }>();
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    const poll = async () => {
      try {
        const b = await api.getBooking(id as string);
        if (cancelled) return;
        if (b.status !== 'searching') {
          router.replace({ pathname: `/booking/${id}`, params: { polyline: polyline || '' } });
          return;
        }
      } catch {}
      if (!cancelled) setTimeout(poll, 1500);
    };
    poll();
    return () => { cancelled = true; };
  }, [id]);

  return (
    <View style={styles.c} testID="finding-screen">
      <View style={styles.iconWrap}>
        <Text style={{ fontSize: 64 }}>🚗</Text>
      </View>
      <Text style={styles.title}>Finding a Ride Partner</Text>
      <Text style={styles.sub}>We&apos;re matching you with the best driver for your trip…</Text>
      <ActivityIndicator color={theme.colors.primary} size="large" style={{ marginTop: 30 }} />
    </View>
  );
}

const styles = StyleSheet.create({
  c: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: 30, backgroundColor: theme.colors.card },
  iconWrap: { width: 130, height: 130, borderRadius: 65, backgroundColor: theme.colors.softCard, alignItems: 'center', justifyContent: 'center', marginBottom: 30 },
  title: { fontSize: 26, fontWeight: '900', color: theme.colors.textPrimary, textAlign: 'center' },
  sub: { color: theme.colors.textSecondary, fontSize: 15, textAlign: 'center', marginTop: 10 },
});
