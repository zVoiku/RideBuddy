// Messages — one thread per trip that has this partner on it, split into
// Active and Closed per the design. A thread is the trip: there is nothing to
// start or accept, and a finished trip keeps its history but takes no replies.
import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, RefreshControl } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { api, ChatThread } from '../../src/api';
import { theme } from '../../src/theme';
import { Header, Empty, SectionLabel, Avatar } from '../../src/ui';
import { Ico } from '../../src/icons';

const POLL_MS = 4000;

function when(iso?: string | null) {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const sameDay = d.toDateString() === now.toDateString();
  if (sameDay) return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const yday = new Date(now);
  yday.setDate(now.getDate() - 1);
  if (d.toDateString() === yday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString([], { day: 'numeric', month: 'short' });
}

function ThreadRow({ t, onPress }: { t: ChatThread; onPress: () => void }) {
  const last = t.last_message;
  const route = [t.pickup_address, t.drop_address]
    .filter(Boolean)
    .map((a) => (a || '').split(',').slice(-1)[0].trim())
    .join(' → ');

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Conversation with ${t.with.name}`}
      style={({ pressed }) => [styles.row, pressed && { backgroundColor: theme.colors.surfaceSoft }]}
    >
      <Avatar name={t.with.name} photo={t.with.photo} size={46} />
      <View style={{ flex: 1, minWidth: 0 }}>
        <View style={styles.rowTop}>
          <Text style={styles.name} numberOfLines={1}>{t.with.name}</Text>
          <Text style={styles.time}>{when(last?.created_at)}</Text>
        </View>
        <Text style={styles.route} numberOfLines={1}>{route || 'Trip'}</Text>
        <Text
          style={[styles.preview, t.unread > 0 && styles.previewUnread]}
          numberOfLines={1}
        >
          {last
            ? `${last.sender_role === 'driver' ? 'You: ' : ''}${last.body}`
            : t.closed
            ? 'No messages were exchanged.'
            : 'No messages yet — say hello.'}
        </Text>
      </View>
      {t.unread > 0 && (
        <View style={styles.pill}>
          <Text style={styles.pillTxt}>{t.unread > 9 ? '9+' : t.unread}</Text>
        </View>
      )}
    </Pressable>
  );
}

export default function Messages() {
  const router = useRouter();
  const [threads, setThreads] = useState<ChatThread[] | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      setThreads(await api.chatThreads());
      setErr(null);
    } catch (e: any) {
      setErr(e?.message || 'Could not load your conversations.');
    }
  }, []);

  // Poll only while this tab is focused — the tab badge already keeps the
  // global unread count fresh from the store's own poll.
  useFocusEffect(
    useCallback(() => {
      load();
      const t = setInterval(load, POLL_MS);
      return () => clearInterval(t);
    }, [load]),
  );

  const active = (threads || []).filter((t) => !t.closed);
  const closed = (threads || []).filter((t) => t.closed);

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.surfacePage }}>
      <Header tone="green" subtitle="In-app chat" title="Messages" />

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={async () => { setRefreshing(true); await load(); setRefreshing(false); }}
            tintColor={theme.colors.brandPrimary}
          />
        }
      >
        {err && <Text style={styles.err}>{err}</Text>}

        {threads && !threads.length && (
          <View style={styles.card}>
            <Empty
              icon={<Ico.Message size={30} color={theme.colors.green300} />}
              title="No conversations yet."
              body="A chat opens with each customer when a trip is assigned to you."
            />
          </View>
        )}

        {!!active.length && (
          <>
            <SectionLabel right={<Text style={styles.count}>{active.length}</Text>}>Active</SectionLabel>
            <View style={styles.card}>
              {active.map((t, i) => (
                <View key={t.booking_id}>
                  {i > 0 && <View style={styles.sep} />}
                  <ThreadRow t={t} onPress={() => router.push(`/thread/${t.booking_id}`)} />
                </View>
              ))}
            </View>
          </>
        )}

        {!!closed.length && (
          <>
            <SectionLabel right={<Text style={styles.count}>{closed.length}</Text>}>Closed</SectionLabel>
            <View style={[styles.card, { opacity: 0.75 }]}>
              {closed.map((t, i) => (
                <View key={t.booking_id}>
                  {i > 0 && <View style={styles.sep} />}
                  <ThreadRow t={t} onPress={() => router.push(`/thread/${t.booking_id}`)} />
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 16, paddingBottom: 28, gap: 4 },
  card: {
    backgroundColor: theme.colors.surfaceCard,
    borderRadius: theme.radius.lg,
    overflow: 'hidden',
    marginBottom: 14,
    ...theme.shadow.sm,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 13 },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  name: { fontFamily: theme.fonts.display, fontSize: 15, color: theme.colors.textPrimary, flexShrink: 1 },
  time: { fontFamily: theme.fonts.body, fontSize: 11.5, color: theme.colors.textSecondary },
  route: { fontFamily: theme.fonts.body, fontSize: 12, color: theme.colors.green700, marginTop: 1 },
  preview: { fontFamily: theme.fonts.body, fontSize: 13, color: theme.colors.textSecondary, marginTop: 3 },
  previewUnread: { fontFamily: theme.fonts.bodySemi, color: theme.colors.textPrimary },
  sep: { height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(100,100,100,0.13)', marginLeft: 71 },
  pill: {
    minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5,
    backgroundColor: theme.colors.error, alignItems: 'center', justifyContent: 'center',
  },
  pillTxt: { fontFamily: theme.fonts.bodySemi, fontSize: 10.5, color: '#fff' },
  count: { fontFamily: theme.fonts.body, fontSize: 12.5, color: theme.colors.textSecondary },
  err: { fontFamily: theme.fonts.body, fontSize: 13, color: theme.colors.error, marginBottom: 10 },
});
