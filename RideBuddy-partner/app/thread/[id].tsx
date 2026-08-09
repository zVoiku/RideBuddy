// One conversation, keyed by booking id — the booking *is* the thread.
//
// The partner never sees the owner's number here: chat is the only channel to
// them, so a failed send has to be recoverable rather than silently dropped.
import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, Pressable,
  KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter, useFocusEffect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { api, ChatConversation, ChatMessage } from '../../src/api';
import { theme } from '../../src/theme';
import { Avatar } from '../../src/ui';
import { Ico } from '../../src/icons';

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

function Bubble({ m, mine }: { m: ChatMessage; mine: boolean }) {
  return (
    <View style={[styles.bubbleRow, mine ? styles.rowMine : styles.rowTheirs]}>
      <View style={[styles.bubble, mine ? styles.mine : styles.theirs]}>
        <Text style={[styles.body, mine && { color: '#fff' }]}>{m.body}</Text>
        <Text style={[styles.stamp, mine && { color: 'rgba(255,255,255,0.72)' }]}>
          {new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
        </Text>
      </View>
    </View>
  );
}

export default function Thread() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const scroller = useRef<ScrollView>(null);

  const [conv, setConv] = useState<ChatConversation | null>(null);
  const [draft, setDraft] = useState('');
  const [sending, setSending] = useState(false);
  const [err, setErr] = useState<string | null>(null);

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

  // Keep the newest message in view as the thread grows. Keyed on the count
  // alone: polling replaces `conv` every few seconds, and depending on the
  // object would re-scroll (and fight the user) on every unchanged response.
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
      // Put the text back rather than losing it — this is their only channel.
      setDraft(text);
      setErr(e?.message || 'Message not sent.');
    } finally {
      setSending(false);
    }
  };

  const thread = conv?.thread;
  const closed = !!thread?.closed;
  const route = [thread?.pickup_address, thread?.drop_address]
    .filter(Boolean)
    .map((a) => (a || '').split(',').slice(-1)[0].trim())
    .join(' → ');

  let lastDay = '';

  return (
    <KeyboardAvoidingView
      style={{ flex: 1, backgroundColor: theme.colors.surfacePage }}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={0}
    >
      <View style={[styles.header, { paddingTop: insets.top + 8 }]}>
        <Pressable onPress={() => router.back()} accessibilityLabel="Back" style={styles.back}>
          <Ico.ArrowLeft size={20} color={theme.colors.textPrimary} />
        </Pressable>
        <Avatar name={thread?.with.name} photo={thread?.with.photo} size={38} />
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={styles.hName} numberOfLines={1}>{thread?.with.name || 'Conversation'}</Text>
          <Text style={styles.hSub} numberOfLines={1}>{route || ' '}</Text>
        </View>
      </View>

      {!conv && !err && (
        <View style={styles.center}><ActivityIndicator color={theme.colors.brandPrimary} /></View>
      )}

      {conv && (
        <ScrollView ref={scroller} contentContainerStyle={styles.scroll}>
          {!conv.messages.length && (
            <Text style={styles.hint}>
              No messages yet. The customer sees these straight away.
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

      {err && <Text style={styles.err}>{err}</Text>}

      {closed ? (
        <View style={[styles.closed, { paddingBottom: Math.max(insets.bottom, 14) }]}>
          <Ico.Check size={16} color={theme.colors.textSecondary} />
          <Text style={styles.closedTxt}>This trip is over — the conversation is closed.</Text>
        </View>
      ) : (
        <View style={[styles.composer, { paddingBottom: Math.max(insets.bottom, 10) }]}>
          <TextInput
            testID="chat-input"
            value={draft}
            onChangeText={setDraft}
            placeholder="Message the customer"
            placeholderTextColor={theme.colors.grey400}
            style={styles.input}
            multiline
            maxLength={2000}
            onSubmitEditing={send}
          />
          <Pressable
            testID="chat-send"
            onPress={send}
            disabled={!draft.trim() || sending}
            accessibilityRole="button"
            accessibilityLabel="Send"
            style={[styles.send, (!draft.trim() || sending) && { opacity: 0.4 }]}
          >
            <Ico.Navigation size={18} color="#fff" fill="#fff" />
          </Pressable>
        </View>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row', alignItems: 'center', gap: 11,
    paddingHorizontal: 14, paddingBottom: 12,
    backgroundColor: theme.colors.surfaceCard,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(100,100,100,0.13)',
  },
  back: {
    width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center',
    backgroundColor: theme.colors.surfaceSoft,
  },
  hName: { fontFamily: theme.fonts.display, fontSize: 15.5, color: theme.colors.textPrimary },
  hSub: { fontFamily: theme.fonts.body, fontSize: 12, color: theme.colors.textSecondary, marginTop: 1 },

  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { padding: 14, paddingBottom: 20, gap: 2 },
  hint: {
    fontFamily: theme.fonts.body, fontSize: 13, color: theme.colors.textSecondary,
    textAlign: 'center', marginTop: 24, paddingHorizontal: 30, lineHeight: 19,
  },
  day: {
    fontFamily: theme.fonts.bodySemi, fontSize: 11.5, color: theme.colors.textSecondary,
    textAlign: 'center', marginVertical: 12,
  },

  bubbleRow: { flexDirection: 'row', marginVertical: 2 },
  rowMine: { justifyContent: 'flex-end' },
  rowTheirs: { justifyContent: 'flex-start' },
  bubble: { maxWidth: '78%', borderRadius: 16, paddingHorizontal: 13, paddingVertical: 9 },
  mine: { backgroundColor: theme.colors.brandPrimary, borderBottomRightRadius: 5 },
  theirs: { backgroundColor: theme.colors.surfaceCard, borderBottomLeftRadius: 5, ...theme.shadow.sm },
  body: { fontFamily: theme.fonts.body, fontSize: 14.5, color: theme.colors.textPrimary, lineHeight: 20 },
  stamp: { fontFamily: theme.fonts.body, fontSize: 10.5, color: theme.colors.textSecondary, marginTop: 3, alignSelf: 'flex-end' },

  err: {
    fontFamily: theme.fonts.body, fontSize: 12.5, color: theme.colors.error,
    paddingHorizontal: 16, paddingBottom: 6,
  },
  composer: {
    flexDirection: 'row', alignItems: 'flex-end', gap: 9,
    paddingHorizontal: 12, paddingTop: 10,
    backgroundColor: theme.colors.surfaceCard,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(100,100,100,0.13)',
  },
  input: {
    flex: 1, maxHeight: 110, minHeight: 42,
    backgroundColor: theme.colors.surfaceInput,
    borderRadius: 21, paddingHorizontal: 15, paddingTop: 11, paddingBottom: 11,
    fontFamily: theme.fonts.body, fontSize: 14.5, color: theme.colors.textPrimary,
  },
  send: {
    width: 42, height: 42, borderRadius: 21,
    backgroundColor: theme.colors.brandPrimary, alignItems: 'center', justifyContent: 'center',
  },
  closed: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    paddingHorizontal: 16, paddingTop: 14,
    backgroundColor: theme.colors.surfaceCard,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(100,100,100,0.13)',
  },
  closedTxt: { fontFamily: theme.fonts.body, fontSize: 13, color: theme.colors.textSecondary },
});
