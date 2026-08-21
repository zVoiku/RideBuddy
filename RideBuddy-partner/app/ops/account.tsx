// Ops account. Carries the one-way switch into partner mode: useful for testing
// the Buddy app as yourself without a second number or a second device.
import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, Pressable, ActivityIndicator } from 'react-native';
import { useRouter, useFocusEffect } from 'expo-router';
import { api, OpsMetrics, saveToken } from '../../src/api';
import { useRB } from '../../src/store';
import { theme } from '../../src/theme';
import { Ico } from '../../src/icons';
import { OpsHeader, OpsCard, Section, StatTile, ConfirmSheet, money } from '../../src/ops-ui';

export default function OpsAccount() {
  const router = useRouter();
  const { ops, signIn, signOut, showToast } = useRB();
  const [m, setM] = useState<OpsMetrics | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirm, setConfirm] = useState<'partner' | 'signout' | null>(null);

  const load = useCallback(async () => {
    try { setM(await api.opsMetrics()); } catch {}
  }, []);
  useFocusEffect(useCallback(() => { load(); }, [load]));

  const toPartner = async () => {
    setBusy(true);
    try {
      const res = await api.opsSwitchToPartner();
      // Replacing the stored token is what actually changes role; the Ops
      // session is dropped so nothing here stays reachable.
      await saveToken(res.token);
      signIn(res.partner);
      setConfirm(null);
      router.replace('/(tabs)/home');
    } catch (e: any) {
      showToast({ type: 'error', title: e?.message || 'Could not switch to partner mode.' });
      setBusy(false);
    }
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.surfacePage }}>
      <OpsHeader title="Account" subtitle="Ops console" onBack={() => router.back()} />

      <ScrollView contentContainerStyle={styles.scroll}>
        <OpsCard style={{ padding: 16 }}>
          <View style={styles.top}>
            <View style={styles.avatar}>
              <Text style={styles.avatarTxt}>{(ops?.name || 'O').slice(0, 1).toUpperCase()}</Text>
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.name}>{ops?.name || 'Ops'}</Text>
              <Text style={styles.sub}>{ops?.phone}</Text>
              <Text style={styles.role}>Operations · full access</Text>
            </View>
          </View>
        </OpsCard>

        {!!m && (
          <>
            <Section title="System" right={
              <Pressable onPress={() => router.push('/ops/completed')} accessibilityRole="button">
                <Text style={styles.link}>Completed trips</Text>
              </Pressable>
            } />
            <View style={styles.grid}>
              <StatTile label="Total trips" value={m.total} hint="In system" />
              <StatTile label="Completed" value={m.completed} hint="All time" />
              <StatTile label="Revenue" value={money(m.revenue)} hint="Collected" />
            </View>
          </>
        )}

        <Section title="Testing" />
        <OpsCard>
          <Pressable onPress={() => setConfirm('partner')} disabled={busy} style={styles.action}
            accessibilityRole="button" accessibilityLabel="Open the partner app">
            <View style={styles.actionIcon}><Ico.Car size={18} color={theme.colors.green700} /></View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.actionTitle}>Open the partner app</Text>
              <Text style={styles.actionSub}>
                Sign in as a Buddy on your own number. One way — sign out to come back.
              </Text>
            </View>
            {busy ? <ActivityIndicator color={theme.colors.brandPrimary} />
              : <Ico.ChevronRight size={17} color={theme.colors.grey400} />}
          </Pressable>
        </OpsCard>

        <Pressable onPress={() => setConfirm('signout')} style={styles.signOut} accessibilityRole="button">
          <Ico.LogOut size={17} color={theme.colors.error} />
          <Text style={styles.signOutTxt}>Sign out</Text>
        </Pressable>
      </ScrollView>

      <ConfirmSheet
        visible={confirm === 'partner'}
        title="Open the partner app"
        body={'You will be signed in as a Buddy on your own number. There is no way back from '
          + 'there — to return here, sign out and sign in again with the same number.'}
        confirmLabel="Open partner app"
        busy={busy}
        onConfirm={toPartner}
        onCancel={() => setConfirm(null)}
      />
      <ConfirmSheet
        visible={confirm === 'signout'}
        title="Sign out"
        body="Sign out of the Ops console?"
        confirmLabel="Sign out"
        destructive
        onConfirm={async () => { setConfirm(null); await signOut(); router.replace('/login'); }}
        onCancel={() => setConfirm(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: 16, paddingBottom: 40 },
  top: { flexDirection: 'row', gap: 13, alignItems: 'center' },
  avatar: {
    width: 56, height: 56, borderRadius: 28, backgroundColor: theme.colors.green100,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarTxt: { fontFamily: theme.fonts.display, fontSize: 21, color: theme.colors.green700 },
  name: { fontFamily: theme.fonts.display, fontSize: 18, color: theme.colors.textPrimary },
  sub: { fontFamily: theme.fonts.body, fontSize: 13, color: theme.colors.textSecondary, marginTop: 2 },
  role: { fontFamily: theme.fonts.bodySemi, fontSize: 11.5, color: theme.colors.green700, marginTop: 4 },

  link: { fontFamily: theme.fonts.bodySemi, fontSize: 12.5, color: theme.colors.green700 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: 9 },

  action: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 14 },
  actionIcon: {
    width: 38, height: 38, borderRadius: 19, backgroundColor: theme.colors.green50,
    alignItems: 'center', justifyContent: 'center',
  },
  actionTitle: { fontFamily: theme.fonts.display, fontSize: 14.5, color: theme.colors.textPrimary },
  actionSub: { fontFamily: theme.fonts.body, fontSize: 12, color: theme.colors.textSecondary, marginTop: 2, lineHeight: 17 },

  signOut: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    marginTop: 22, paddingVertical: 14,
    backgroundColor: theme.colors.surfaceCard, borderRadius: theme.radius.lg,
  },
  signOutTxt: { fontFamily: theme.fonts.bodySemi, fontSize: 14, color: theme.colors.error },
});
