// Chat with the partner driving your car, keyed by booking id.
//
// Mirrors the partner app's thread screen, but this side sees them in full —
// name, photo and phone — so the header keeps a call button alongside. The
// partner has no number for you, which makes this their only way to reach you.
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Image,
  KeyboardAvoidingView, Platform, ActivityIndicator, Linking,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { api, ChatConversation, ChatMessage } from '../../src/api';
import { theme } from '../../src/theme';

const POLL_MS = 3000;

function dayLabel(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  if (d.toDateString() === now.toDateString()) return 'Today';
  const y = new Date(now);
  y.setDate(now.getDate() - 1);
  if (d.toDateString() === y.toDateString()) return 'Yesterday';
  return d.toLocaleDateString([], { day: 'numeric', month: 'long' });
}

function clock(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function Bubble({ m, mine }: { m: ChatMessage; mine: boolean }) {
  return (
    <View style={[styles.bubbleRow, { justifyContent: mine ? 'flex-end' : 'flex-start' }]}>
      <View style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
        <Text style={[styles.body, mine && { color: theme.colors.textOnPrimary }]}>{m.body}</Text>
        <Text style={[styles.stamp, mine && { color: 'rgba(245,240,232,0.7)' }]}>{clock(m.created_at)}</Text>
      </View>
    </View>
  );
}

export default function BookingChat() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scroller = useRef<ScrollView>(null);

  const [conv, setConv] = useState<ChatConversation | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [photoFailed, setPhotoFailed] = useState(false);

  const load = useCallback(async (markRead = false) => {
    if (!id) return;
    try {
      const data = await api.chatMessages(id);
      setConv(data);
      setErr(null);
      if (markRead && data.thread.unread > 0) await api.chatRead(id);
    } catch (e: any) {
      setErr(e?.message || 'Could not load this conversation.');
    }
  }, [id]);

  useFocusEffect(
    useCallback(() => {
      load(true);
      const t = setInterval(() => load(true), POLL_MS);
      return () => clearInterval(t);
    }, [load]),
  );

  const msgCount = conv?.messages.length ?? 0;
  useEffect(() => {
    if (msgCount) requestAnimationFrame(() => scroller.current?.scrollToEnd({ animated: false }));
  }, [msgCount]);

  const send = async () => {
    const text = draft.trim();
    if (!text || !id || sending) return;
    setSending(true);
    setDraft('');
    try {
      await api.chatSend(id, text);
      await load();
    } catch (e: any) {
      setDraft(text); // don't lose what they typed
      setErr(e?.message || 'Message not sent.');
    } finally {
      setSending(false);
    }
  };

  const thread = conv?.thread;
  const closed = !!thread?.closed;
  let lastDay = '';

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()} style={styles.back} accessibilityLabel="Back">
            <Ionicons name="chevron-back" size={22} color={theme.colors.textPrimary} />
          </TouchableOpacity>

          {/* Icon is the base layer, photo sits on top: a slow or broken URL
              then degrades to the fallback instead of an invisible gap. */}
          <View style={[styles.avatar, styles.avatarFallback]}>
            <Ionicons name="person" size={18} color={theme.colors.primary} />
            {!!thread?.with.photo && !photoFailed && (
              <Image
                source={{ uri: thread.with.photo }}
                style={StyleSheet.absoluteFill}
                onError={() => setPhotoFailed(true)}
              />
            )}
          </View>

          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.hName} numberOfLines={1}>{thread?.with.name || 'Your ride partner'}</Text>
            <Text style={styles.hSub} numberOfLines={1}>
              {closed ? 'Trip complete' : 'Your ride partner'}
            </Text>
          </View>

          {!!thread?.with.phone && (
            <TouchableOpacity
              testID="chat-call"
              onPress={() => Linking.openURL(`tel:${thread.with.phone}`)}
              style={styles.call}
              accessibilityLabel={`Call ${thread.with.name}`}
            >
              <Ionicons name="call" size={17} color={theme.colors.inverse} />
            </TouchableOpacity>
          )}
        </View>

        {!conv && !err && (
          <View style={styles.center}><ActivityIndicator color={theme.colors.primary} /></View>
        )}

        {conv && (
          <ScrollView ref={scroller} contentContainerStyle={styles.scroll}>
            {!conv.messages.length && (
              <Text style={styles.hint}>
                No messages yet. Your partner sees these straight away.
              </Text>
            )}
            {conv.messages.map((m) => {
              const d = dayLabel(m.created_at);
              const showDay = d !== lastDay;
              lastDay = d;
              return (
                <View key={m.id}>
                  {showDay && <Text style={styles.day}>{d}</Text>}
                  <Bubble m={m} mine={m.sender_role === conv.me} />
                </View>
              );
            })}
          </ScrollView>
        )}

        {!!err && <Text style={styles.err}>{err}</Text>}

        {closed ? (
          <View style={[styles.closed, { paddingBottom: Math.max(insets.bottom, 14) }]}>
            <Ionicons name="checkmark-circle-outline" size={16} color={theme.colors.textSecondary} />
            <Text style={styles.closedTxt}>This trip is over — the conversation is closed.</Text>
          </View>
        ) : (
          <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, 10) }]}>
            <TextInput
              testID="chat-input"
              value={draft}
              onChangeText={setDraft}
              placeholder="Message your partner"
              placeholderTextColor={theme.colors.textTertiary}
              style={styles.input}
              multiline
              maxLength={2000}
            />
            <TouchableOpacity
              testID="chat-send"
              onPress={send}
              disabled={!draft.trim() || sending}
              style={[styles.send, (!draft.trim() || sending) && { opacity: 0.4 }]}
              accessibilityLabel="Send"
            >
              <Ionicons name="send" size={17} color={theme.colors.inverse} />
            </TouchableOpacity>
          </View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.colors.background },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    paddingHorizontal: 12, paddingVertical: 10,
    backgroundColor: theme.colors.card,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.borderLight,
  },
  back: { padding: 4 },
  avatar: { width: 38, height: 38, borderRadius: 19 },
  avatarFallback: {
    backgroundColor: theme.colors.primarySoft, alignItems: 'center', justifyContent: 'center',
  },
  hName: { fontFamily: theme.fonts.heading, fontSize: 15.5, color: theme.colors.textPrimary },
  hSub: { fontFamily: theme.fonts.body, fontSize: 12, color: theme.colors.textSecondary, marginTop: 1 },
  call: {
    width: 36, height: 36, borderRadius: 18, backgroundColor: theme.colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: 14, paddingBottom: 20 },
  hint: {
    fontFamily: theme.fonts.body, fontSize: 13, color: theme.colors.textSecondary,
    textAlign: 'center', marginTop: 26, paddingHorizontal: 30, lineHeight: 19,
  },
  day: {
    fontFamily: theme.fonts.bodyMed, fontSize: 11.5, color: theme.colors.textSecondary,
    textAlign: 'center', marginVertical: 12,
  },

  bubbleRow: { flexDirection: 'row', marginVertical: 2 },
  bubble: { maxWidth: '78%', borderRadius: theme.radius.xl, paddingHorizontal: 13, paddingVertical: 9 },
  mine: { backgroundColor: theme.colors.primary, borderBottomRightRadius: 5 },
  theirs: { backgroundColor: theme.colors.card, borderBottomLeftRadius: 5, ...theme.shadow.soft },
  body: { fontFamily: theme.fonts.body, fontSize: 14.5, color: theme.colors.textPrimary, lineHeight: 20 },
  stamp: {
    fontFamily: theme.fonts.body, fontSize: 10.5, color: theme.colors.textSecondary,
    marginTop: 3, alignSelf: 'flex-end',
  },

  err: {
    fontFamily: theme.fonts.body, fontSize: 12.5, color: theme.colors.error,
    paddingHorizontal: 16, paddingBottom: 6,
  },
  composer: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 9,
    paddingHorizontal: 12, paddingTop: 10,
    backgroundColor: theme.colors.card,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.borderLight,
  },
  input: {
    flex: 1, maxHeight: 110, minHeight: 42,
    backgroundColor: theme.colors.softCard,
    borderRadius: theme.radius.pill, paddingHorizontal: 15, paddingVertical: 11,
    fontFamily: theme.fonts.body, fontSize: 14.5, color: theme.colors.textPrimary,
  },
  send: {
    width: 42, height: 42, borderRadius: 21, backgroundColor: theme.colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  closed: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingHorizontal: 16, paddingTop: 14,
    backgroundColor: theme.colors.card,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: theme.colors.borderLight,
  },
  closedTxt: { fontFamily: theme.fonts.body, fontSize: 13, color: theme.colors.textSecondary },
});
