// Buddy roster. Split by what Ops does with each group: the active roster, the
// onboarding pipeline waiting on a decision, and deactivated accounts.
import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, TextInput, RefreshControl, ActivityIndicator } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { api, OpsBuddy } from '../../src/api';
import { theme } from '../../src/theme';
import { Ico } from '../../src/icons';
import { Avatar } from '../../src/ui';
import { OpsNav, OpsHeader, OpsCard, Section, money } from '../../src/ops-ui';

export default function OpsBuddies() {
  const router = useRouter();
  const [rows, setRows] = useState<OpsBuddy[] | null>(null);
  const [q, setQ] = useState('');
  const [refreshing, setRefreshing] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setRows(await api.opsBuddies());
      setErr(null);
    } catch (e: any) {
      setErr(e?.message || 'Could not load the roster.');
    }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const [active, pipeline, dormant] = useMemo(() => {
    const term = q.trim().toLowerCase();
    const l = (rows || []).filter((b) =>
      !term || (b.name || '').toLowerCase().includes(term) || b.phone.includes(term));
    return [
      l.filter((b) => b.active && !b.onboarding),
      l.filter((b) => b.onboarding),
      l.filter((b) => !b.active && !b.onboarding),
    ];
  }, [rows, q]);

  const Group = ({ title, list, showStage }: { title: string; list: OpsBuddy[]; showStage?: boolean }) => {
    if (!list.length) return null;
    return (
      <>
        <Section title={title} right={<Text style={styles.count}>{list.length}</Text>} />
        <OpsCard>
          {list.map((b, i) => (
            <Pressable
              key={b.id}
              onPress={() => router.push(`/ops/buddy/${b.id}` as any)}
              style={[styles.row, i > 0 && styles.rowSep]}
              accessibilityRole="button"
              accessibilityLabel={b.name || b.phone}
            >
              <Avatar name={b.name} photo={b.photo} size={44} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.name} numberOfLines={1}>{b.name || b.phone}</Text>
                <Text style={styles.meta} numberOfLines={1}>
                  {b.region} · {b.rating ? `${b.rating}★` : 'unrated'} · {b.completed} trips
                </Text>
                {showStage
                  ? <Text style={styles.stage}>{b.stage}{b.applied_at ? ` · ${daysAgo(b.applied_at)}` : ''}</Text>
                  : <Text style={styles.earn}>{money(b.earnings)} earned</Text>}
              </View>
              {b.on_duty && <View style={styles.dutyDot} />}
              <Ico.ChevronRight size={17} color={theme.colors.grey400} />
            </Pressable>
          ))}
        </OpsCard>
      </>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.surfacePage }}>
      <OpsHeader
        title="Buddies"
        subtitle={rows ? `${rows.length} on file` : ' '}
        right={
          <Pressable onPress={() => router.push('/ops/add-buddy')} style={styles.add}
            accessibilityRole="button" accessibilityLabel="Add a Buddy">
            <Ico.Plus size={19} color="#fff" />
          </Pressable>
        }
      />

      <View style={styles.searchWrap}>
        <Ico.Search size={16} color={theme.colors.grey400} />
        <TextInput
          value={q}
          onChangeText={setQ}
          placeholder="Search name or number"
          placeholderTextColor={theme.colors.grey400}
          style={styles.search}
        />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={refreshing} tintColor={theme.colors.brandPrimary}
          onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }} />}
      >
        {!!err && <Text style={styles.err}>{err}</Text>}
        {!rows && !err && <ActivityIndicator color={theme.colors.brandPrimary} style={{ marginTop: 24 }} />}

        <Group title="Active roster" list={active} />
        <Group title="Onboarding" list={pipeline} showStage />
        <Group title="Deactivated" list={dormant} />
      </ScrollView>

      <OpsNav />
    </View>
  );
}

function daysAgo(iso: string) {
  const d = Math.round((Date.now() - new Date(iso).getTime()) / 86400000);
  return d <= 0 ? 'today' : `${d}d ago`;
}

const styles = StyleSheet.create({
  add: {
    width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.2)',
  },
  searchWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 9,
    margin: 16, marginBottom: 0, paddingHorizontal: 13,
    backgroundColor: theme.colors.surfaceCard, borderRadius: theme.radius.pill,
  },
  search: {
    flex: 1, paddingVertical: 11, fontFamily: theme.fonts.body,
    fontSize: 14, color: theme.colors.textPrimary,
  },
  scroll: { padding: 16, paddingBottom: 28 },
  err: { fontFamily: theme.fonts.body, fontSize: 13, color: theme.colors.error },
  count: { fontFamily: theme.fonts.body, fontSize: 12.5, color: theme.colors.textSecondary },

  row: { flexDirection: 'row', alignItems: 'center', gap: 11, padding: 12 },
  rowSep: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(100,100,100,0.13)' },
  name: { fontFamily: theme.fonts.display, fontSize: 14.5, color: theme.colors.textPrimary },
  meta: { fontFamily: theme.fonts.body, fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 },
  earn: { fontFamily: theme.fonts.body, fontSize: 11.5, color: theme.colors.grey400, marginTop: 1 },
  stage: { fontFamily: theme.fonts.bodySemi, fontSize: 11.5, color: theme.colors.warning, marginTop: 1 },
  dutyDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.colors.success },
});
