import { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../../src/api';
import { theme } from '../../src/theme';

const STATUS_META: Record<string, { color: string; label: string }> = {
  searching: { color: theme.colors.warning, label: 'Searching driver' },
  assigned: { color: theme.colors.primary, label: 'Driver assigned' },
  arrived: { color: theme.colors.primary, label: 'Driver arrived' },
  in_progress: { color: theme.colors.accentDark, label: 'In progress' },
  completed: { color: theme.colors.success, label: 'Completed' },
  cancelled: { color: theme.colors.error, label: 'Cancelled' },
};

export default function Bookings() {
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    try { setItems(await api.listBookings()); } catch {}
  };

  useFocusEffect(useCallback(() => { load(); }, []));

  const onRefresh = async () => {
    setRefreshing(true);
    await load();
    setRefreshing(false);
  };

  const downloadInvoice = (b: any) => {
    Alert.alert(
      'Invoice',
      `RideBuddy Invoice\nID: ${b.id.slice(0, 8)}\n${b.pickup_address} → ${b.drop_address || 'Hourly'}\nTotal: ₹${b.total_fare}`,
    );
  };

  return (
    <SafeAreaView style={styles.c} edges={['top']}>
      <View style={styles.header}>
        <Text style={styles.h1}>Your Trips</Text>
        <Text style={styles.sub}>Upcoming & past bookings</Text>
      </View>
      <FlatList
        testID="bookings-list"
        data={items}
        keyExtractor={(b) => b.id}
        contentContainerStyle={{ padding: 20, paddingBottom: 100, gap: 14 }}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Ionicons name="car-outline" size={56} color={theme.colors.textSecondary} />
            <Text style={styles.emptyT}>No trips yet</Text>
            <Text style={styles.emptyS}>Book your first ride from the Book tab</Text>
          </View>
        }
        renderItem={({ item }) => {
          const meta = STATUS_META[item.status] || { color: theme.colors.textSecondary, label: item.status };
          return (
            <TouchableOpacity
              testID={`booking-${item.id}`}
              style={styles.card}
              onPress={() => router.push(`/booking/${item.id}`)}
            >
              <View style={styles.cardTop}>
                <View style={[styles.statusDot, { backgroundColor: meta.color }]} />
                <Text style={[styles.statusText, { color: meta.color }]}>{meta.label}</Text>
                <Text style={styles.fare}>₹{item.total_fare}</Text>
              </View>
              <View style={{ marginTop: 10, gap: 6 }}>
                <View style={styles.line}>
                  <Ionicons name="ellipse" size={10} color={theme.colors.accent} />
                  <Text style={styles.addr} numberOfLines={1}>{item.pickup_address}</Text>
                </View>
                {item.drop_address && (
                  <View style={styles.line}>
                    <Ionicons name="location" size={12} color={theme.colors.error} />
                    <Text style={styles.addr} numberOfLines={1}>{item.drop_address}</Text>
                  </View>
                )}
                {item.trip_type === 'hourly' && (
                  <View style={styles.line}>
                    <Ionicons name="time" size={12} color={theme.colors.primary} />
                    <Text style={styles.addr}>{item.duration_hours} hours rental</Text>
                  </View>
                )}
              </View>
              <View style={styles.cardFoot}>
                <Text style={styles.date}>{new Date(item.created_at).toLocaleString()}</Text>
                {item.status === 'completed' && (
                  <TouchableOpacity testID={`invoice-${item.id}`} onPress={() => downloadInvoice(item)} style={styles.invBtn}>
                    <Ionicons name="download-outline" size={14} color={theme.colors.primary} />
                    <Text style={styles.invText}>Invoice</Text>
                  </TouchableOpacity>
                )}
              </View>
            </TouchableOpacity>
          );
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  c: { flex: 1, backgroundColor: theme.colors.background },
  header: { paddingHorizontal: 20, paddingTop: 16, paddingBottom: 4 },
  h1: { fontSize: 28, fontWeight: '800', color: theme.colors.textPrimary, letterSpacing: -0.6 },
  sub: { color: theme.colors.textSecondary, fontSize: 14, marginTop: 4 },
  card: { backgroundColor: theme.colors.card, borderRadius: theme.radius.lg, padding: 18, borderWidth: 1, borderColor: theme.colors.borderLight, ...theme.shadow.soft },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  statusDot: { width: 8, height: 8, borderRadius: 4 },
  statusText: { fontSize: 13, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.5 },
  fare: { marginLeft: 'auto', fontSize: 18, fontWeight: '800', color: theme.colors.textPrimary },
  line: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  addr: { color: theme.colors.textPrimary, fontSize: 14, flex: 1 },
  cardFoot: { flexDirection: 'row', alignItems: 'center', marginTop: 12, justifyContent: 'space-between' },
  date: { color: theme.colors.textSecondary, fontSize: 12 },
  invBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: theme.radius.pill, borderWidth: 1, borderColor: theme.colors.primary },
  invText: { color: theme.colors.primary, fontWeight: '700', fontSize: 12 },
  empty: { alignItems: 'center', padding: 60, gap: 10 },
  emptyT: { fontSize: 18, fontWeight: '700', color: theme.colors.textPrimary },
  emptyS: { color: theme.colors.textSecondary, textAlign: 'center' },
});
