// Ops console primitives. Deliberately built from the same theme tokens as the
// Buddy app rather than a second design language — this is an internal console,
// so consistency beats bespoke styling.
import React from 'react';
import { View, Text, StyleSheet, Pressable, ViewStyle, Modal, ActivityIndicator } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { theme } from './theme';
import { Ico } from './icons';

export const money = (n: number) => `₹${Math.round(n || 0).toLocaleString('en-IN')}`;

/** Status pill using the design's Ops vocabulary (Received, Confirmed, …). */
export function OpsBadge({ label }: { label: string }) {
  const tone: Record<string, { bg: string; fg: string }> = {
    Received: { bg: 'rgba(230,81,0,0.10)', fg: theme.colors.warning },
    Confirmed: { bg: theme.colors.green50, fg: theme.colors.green700 },
    'Left for Pickup': { bg: theme.colors.green50, fg: theme.colors.green700 },
    'Arrived at Pickup': { bg: theme.colors.green50, fg: theme.colors.green700 },
    'In Progress': { bg: 'rgba(21,101,192,0.10)', fg: theme.colors.info },
    Complete: { bg: 'rgba(46,125,50,0.10)', fg: theme.colors.success },
    Cancelled: { bg: 'rgba(198,40,40,0.08)', fg: theme.colors.error },
    Closed: { bg: theme.colors.fillSoft, fg: theme.colors.textSecondary },
  };
  const t = tone[label] || { bg: theme.colors.fillSoft, fg: theme.colors.textSecondary };
  return (
    <View style={[styles.badge, { backgroundColor: t.bg }]}>
      <Text style={[styles.badgeTxt, { color: t.fg }]}>{label}</Text>
    </View>
  );
}

/** How close a trip is to its pickup — the console's triage signal. */
export function Urgency({ at }: { at?: string | null }) {
  if (!at) return null;
  const hrs = (new Date(at).getTime() - Date.now()) / 3600000;
  const [txt, color] =
    hrs < 0 ? ['Overdue', theme.colors.error]
    : hrs < 24 ? [`In ${Math.max(1, Math.round(hrs))}h`, theme.colors.error]
    : hrs < 72 ? [`In ${Math.round(hrs / 24)}d`, theme.colors.warning]
    : [`In ${Math.round(hrs / 24)}d`, theme.colors.textSecondary];
  return <Text style={[styles.urg, { color }]}>{txt}</Text>;
}

export function StatTile({
  label, value, hint, tone, onPress,
}: {
  label: string; value: string | number; hint?: string;
  tone?: 'warn' | 'good' | 'bad'; onPress?: () => void;
}) {
  const fg =
    tone === 'warn' ? theme.colors.warning
    : tone === 'bad' ? theme.colors.error
    : tone === 'good' ? theme.colors.success
    : theme.colors.textPrimary;
  const Wrap: any = onPress ? Pressable : View;
  return (
    <Wrap onPress={onPress} style={styles.tile} accessibilityRole={onPress ? 'button' : undefined}>
      <Text style={styles.tileLabel}>{label}</Text>
      <Text style={[styles.tileValue, { color: fg }]}>{value}</Text>
      {!!hint && <Text style={styles.tileHint} numberOfLines={1}>{hint}</Text>}
    </Wrap>
  );
}

export function Section({ title, right }: { title: string; right?: React.ReactNode }) {
  return (
    <View style={styles.sectionRow}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {right}
    </View>
  );
}

export function OpsCard({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return <View style={[styles.card, style]}>{children}</View>;
}

/** Two-segment proportion bar (completed vs cancelled, Punjab vs Himachal…). */
export function SplitBar({ a, b, aColor, bColor }: {
  a: number; b: number; aColor?: string; bColor?: string;
}) {
  const total = Math.max(1, a + b);
  return (
    <View style={styles.splitTrack}>
      <View style={{ flex: a / total, backgroundColor: aColor || theme.colors.brandPrimary }} />
      <View style={{ flex: b / total, backgroundColor: bColor || theme.colors.green100 }} />
    </View>
  );
}

export function OpsHeader({ title, subtitle, onBack, right }: {
  title: string; subtitle?: string; onBack?: () => void; right?: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
      {!!onBack && (
        <Pressable onPress={onBack} style={styles.back} accessibilityLabel="Back">
          <Ico.ArrowLeft size={20} color="#fff" />
        </Pressable>
      )}
      <View style={{ flex: 1, minWidth: 0 }}>
        {!!subtitle && <Text style={styles.hSub}>{subtitle}</Text>}
        <Text style={styles.hTitle} numberOfLines={1}>{title}</Text>
      </View>
      {right}
    </View>
  );
}

/**
 * Confirmation sheet.
 *
 * Deliberately not React Native's Alert: Alert is native-only, so on
 * react-native-web every confirm silently resolves to nothing and the action
 * never fires. A Modal behaves the same on both, which also makes these flows
 * testable in the web build.
 */
export function ConfirmSheet({
  visible, title, body, confirmLabel, destructive, busy, onConfirm, onCancel,
}: {
  visible: boolean;
  title: string;
  body?: string;
  confirmLabel: string;
  destructive?: boolean;
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onCancel}>
      <Pressable style={styles.scrim} onPress={onCancel} accessibilityLabel="Close" />
      <View style={[styles.sheet, { paddingBottom: insets.bottom + 20 }]}>
        <View style={styles.grabber} />
        <Text style={styles.sheetTitle}>{title}</Text>
        {!!body && <Text style={styles.sheetBody}>{body}</Text>}
        <Pressable
          onPress={onConfirm}
          disabled={busy}
          accessibilityRole="button"
          accessibilityLabel={confirmLabel}
          style={[
            styles.confirmBtn,
            destructive && { backgroundColor: theme.colors.error },
            busy && { opacity: 0.5 },
          ]}
        >
          {busy
            ? <ActivityIndicator color="#fff" />
            : <Text style={styles.confirmTxt}>{confirmLabel}</Text>}
        </Pressable>
        <Pressable onPress={onCancel} style={styles.cancelBtn} accessibilityRole="button">
          <Text style={styles.cancelTxt}>Cancel</Text>
        </Pressable>
      </View>
    </Modal>
  );
}

const TABS = [
  { id: 'dashboard', label: 'Dashboard', icon: Ico.Dashboard },
  { id: 'bookings', label: 'Bookings', icon: Ico.FileText },
  { id: 'buddies', label: 'Buddies', icon: Ico.Users },
] as const;

export function OpsNav() {
  const router = useRouter();
  const path = usePathname();
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.nav, { paddingBottom: Math.max(insets.bottom, 12) }]}>
      {TABS.map((t) => {
        const on = path.startsWith(`/ops/${t.id}`);
        const color = on ? theme.colors.brandPrimary : theme.colors.greyNav;
        const Icon = t.icon;
        return (
          <Pressable
            key={t.id}
            onPress={() => router.replace(`/ops/${t.id}` as any)}
            style={styles.tab}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
            accessibilityLabel={t.label}
          >
            <Icon size={23} color={color} />
            <Text style={[styles.tabLabel, {
              color, fontFamily: on ? theme.fonts.bodySemi : theme.fonts.body,
            }]}>{t.label}</Text>
            <View style={[styles.dot, { opacity: on ? 1 : 0 }]} />
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { paddingHorizontal: 9, paddingVertical: 3.5, borderRadius: theme.radius.pill, alignSelf: 'flex-start' },
  badgeTxt: { fontFamily: theme.fonts.bodySemi, fontSize: 11 },
  urg: { fontFamily: theme.fonts.bodySemi, fontSize: 11.5 },

  tile: {
    flexGrow: 1, flexBasis: '30%',
    backgroundColor: theme.colors.surfaceCard,
    borderRadius: theme.radius.lg, padding: 12, ...theme.shadow.sm,
  },
  tileLabel: { fontFamily: theme.fonts.body, fontSize: 11.5, color: theme.colors.textSecondary },
  tileValue: { fontFamily: theme.fonts.display, fontSize: 22, marginTop: 3 },
  tileHint: { fontFamily: theme.fonts.body, fontSize: 10.5, color: theme.colors.grey400, marginTop: 1 },

  sectionRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: 20, marginBottom: 9,
  },
  sectionTitle: {
    fontFamily: theme.fonts.bodySemi, fontSize: 11.5, letterSpacing: 1,
    color: theme.colors.textSecondary, textTransform: 'uppercase',
  },

  card: {
    backgroundColor: theme.colors.surfaceCard, borderRadius: theme.radius.lg,
    overflow: 'hidden', ...theme.shadow.sm,
  },

  splitTrack: { flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden', backgroundColor: theme.colors.fillSoft },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: 11,
    paddingHorizontal: 16, paddingBottom: 16,
    backgroundColor: theme.colors.brandPrimary,
  },
  back: {
    width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  hSub: { fontFamily: theme.fonts.body, fontSize: 12.5, color: 'rgba(255,255,255,0.75)' },
  hTitle: { fontFamily: theme.fonts.displayExtra, fontSize: 23, color: '#fff' },

  nav: {
    flexDirection: 'row', backgroundColor: theme.colors.surfaceCard,
    borderTopLeftRadius: theme.radius.xxl, borderTopRightRadius: theme.radius.xxl,
    borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: 'rgba(100,100,100,0.12)',
    paddingTop: 8,
    shadowColor: '#1A2110', shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06, shadowRadius: 16, elevation: 12,
  },
  tab: { flex: 1, alignItems: 'center', gap: 3, paddingVertical: 6 },
  tabLabel: { fontSize: 10.5 },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: theme.colors.brandPrimary },

  scrim: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(19,26,12,0.45)' },
  sheet: {
    position: 'absolute', left: 0, right: 0, bottom: 0,
    backgroundColor: theme.colors.surfaceCard,
    borderTopLeftRadius: theme.radius.xxl, borderTopRightRadius: theme.radius.xxl,
    paddingHorizontal: 20, paddingTop: 10,
  },
  grabber: {
    width: 40, height: 4, borderRadius: 2, alignSelf: 'center',
    backgroundColor: 'rgba(100,100,100,0.25)', marginBottom: 16,
  },
  sheetTitle: { fontFamily: theme.fonts.display, fontSize: 18, color: theme.colors.textPrimary },
  sheetBody: {
    fontFamily: theme.fonts.body, fontSize: 13.5, color: theme.colors.textSecondary,
    marginTop: 8, lineHeight: 20,
  },
  confirmBtn: {
    marginTop: 18, backgroundColor: theme.colors.brandPrimary,
    borderRadius: theme.radius.pill, paddingVertical: 14, alignItems: 'center',
  },
  confirmTxt: { fontFamily: theme.fonts.display, fontSize: 15, color: '#fff' },
  cancelBtn: { marginTop: 8, paddingVertical: 13, alignItems: 'center' },
  cancelTxt: { fontFamily: theme.fonts.bodySemi, fontSize: 14, color: theme.colors.textSecondary },
});
