import { useState, useCallback } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api } from '../src/api';
import { theme } from '../src/theme';

const STATUS_PILL: Record<string, { bg: string; fg: string; label: string; spinner?: boolean }> = {
  searching: { bg: '#FFFFFF', fg: theme.colors.primary, label: 'Finding Partner', spinner: true },
  assigned: { bg: theme.colors.primary, fg: '#FFFFFF', label: 'Partner Assigned' },
  arrived: { bg: theme.colors.primary, fg: '#FFFFFF', label: 'Partner Arrived' },
  in_progress: { bg: theme.colors.onTripGreen, fg: '#FFFFFF', label: 'On Trip' },
  completed: { bg: theme.colors.completedGrey, fg: '#FFFFFF', label: 'Completed' },
  cancelled: { bg: theme.colors.error, fg: '#FFFFFF', label: 'Cancelled' },
};

export default function Bookings() {
  const router = useRouter();
  const [items, setItems] = useState<any[]>([]);
  const [tab, setTab] = useState<'upcoming' | 'completed'>('upcoming');
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => { try { setItems(await api.listBookings()); } catch {} };
  useFocusEffect(useCallback(() => { load(); }, []));

  const filtered = items.filter((b) => tab === 'upcoming' ? !['completed', 'cancelled'].includes(b.status) : ['completed', 'cancelled'].includes(b.status));

  const onRefresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  return (
    <View style={styles.c}>
      <SafeAreaView style={{ flex: 1 }} edges={['top']}>
        <View style={styles.head}>
          <TouchableOpacity testID="bookings-back" onPress={() => router.back()} style={styles.back}>
            <Ionicons name="arrow-back" size={22} color={theme.colors.inverse} />
          </TouchableOpacity>
          <Text style={styles.title}>My Bookings</Text>
          <View style={{ width: 44 }} />
        </View>

        <View style={styles.tabs}>
          <TouchableOpacity testID="tab-upcoming" style={[styles.tab, tab === 'upcoming' && styles.tabActive]} onPress={() => setTab('upcoming')}>
            <Text style={[styles.tabText, tab === 'upcoming' && styles.tabTextActive]}>Upcoming</Text>
          </TouchableOpacity>
          <TouchableOpacity testID="tab-completed" style={[styles.tab, tab === 'completed' && styles.tabActive]} onPress={() => setTab('completed')}>
            <Text style={[styles.tabText, tab === 'completed' && styles.tabTextActive]}>Completed</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.sheet}
          contentContainerStyle={{ padding: 20, paddingBottom: 60 }}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={theme.colors.primary} />}
        >
          {filtered.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons name="car-outline" size={56} color={theme.colors.textSecondary} />
              <Text style={styles.emptyT}>No {tab} bookings</Text>
              <Text style={styles.emptyS}>{tab === 'upcoming' ? 'Book your first ride from the home screen' : 'Your completed trips will appear here'}</Text>
            </View>
          ) : filtered.map((b) => {
            const meta = STATUS_PILL[b.status] || { bg: '#999', fg: '#fff', label: b.status };
            const dt = new Date(b.scheduled_at || b.created_at);
            return (
              <TouchableOpacity key={b.id} testID={`booking-${b.id}`} style={styles.card} onPress={() => router.push(`/booking/${b.id}`)}>
                <View style={styles.cardTop}>
                  <View style={styles.pinDot}><Ionicons name="location" size={20} color={theme.colors.primary} /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.route}>
                      <Text style={{ fontWeight: '900' }}>{b.pickup_address.split(',')[0]}</Text>  <Ionicons name="arrow-forward" size={14} color={theme.colors.textPrimary} />  <Text style={{ fontWeight: '900' }}>{(b.drop_address || '').split(',')[0]}</Text>
                    </Text>
                    <Text style={styles.meta}>{dt.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} · {dt.toLocaleString('en-US', { hour: '2-digit', minute: '2-digit' })}</Text>
                  </View>
                </View>
                <View style={[styles.pill, { backgroundColor: meta.bg }]}>
                  {meta.spinner && <Ionicons name="sync" size={12} color={meta.fg} />}
                  <Text style={[styles.pillText, { color: meta.fg }]}>{meta.label}</Text>
                </View>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  c: { flex: 1, backgroundColor: theme.colors.primary },
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 14 },
  back: { width: 44, height: 44, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  title: { color: theme.colors.inverse, fontSize: 22, fontWeight: '900' },
  tabs: { flexDirection: 'row', marginHorizontal: 16, marginBottom: 16, borderRadius: theme.radius.pill, backgroundColor: 'rgba(0,0,0,0.15)', padding: 4 },
  tab: { flex: 1, paddingVertical: 14, alignItems: 'center', borderRadius: theme.radius.pill },
  tabActive: { backgroundColor: theme.colors.card },
  tabText: { color: 'rgba(255,255,255,0.85)', fontWeight: '800' },
  tabTextActive: { color: theme.colors.primary },
  sheet: { flex: 1, backgroundColor: theme.colors.card, borderTopLeftRadius: 28, borderTopRightRadius: 28 },
  card: { backgroundColor: theme.colors.softCard, borderRadius: theme.radius.lg, padding: 16, marginBottom: 14 },
  cardTop: { flexDirection: 'row', gap: 12, alignItems: 'center' },
  pinDot: { width: 40, height: 40, borderRadius: 20, backgroundColor: theme.colors.primarySoft, alignItems: 'center', justifyContent: 'center' },
  route: { fontSize: 15, color: theme.colors.textPrimary },
  meta: { color: theme.colors.textSecondary, fontSize: 13, marginTop: 4 },
  pill: { alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 14, paddingVertical: 6, borderRadius: theme.radius.pill, marginTop: 12 },
  pillText: { fontWeight: '800', fontSize: 13 },
  empty: { alignItems: 'center', paddingTop: 80, gap: 10 },
  emptyT: { fontSize: 18, fontWeight: '800', color: theme.colors.textPrimary },
  emptyS: { color: theme.colors.textSecondary, textAlign: 'center', paddingHorizontal: 40 },
});
