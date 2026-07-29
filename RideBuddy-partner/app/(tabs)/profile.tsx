import React from 'react';
import { View, Text, ScrollView, Pressable, StyleSheet, Alert } from 'react-native';
import { useRouter } from 'expo-router';
import { useRB } from '../../src/store';
import { theme, fmtDate, money } from '../../src/theme';
import { Header, Avatar, RatingInline, SectionLabel, Stars } from '../../src/ui';
import { Ico } from '../../src/icons';

export default function Profile() {
  const router = useRouter();
  const { partner, trips, signOut, showToast } = useRB();

  const history = trips
    .filter((t) => t.status === 'completed')
    .sort((a, b) => +new Date(b.completed_at || b.created_at) - +new Date(a.completed_at || a.created_at));
  const lifetime = history.reduce((s, t) => s + t.earnings, 0);

  const confirmSignOut = () => {
    Alert.alert('Sign out?', "You'll need your phone number and a code to sign back in.", [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign out',
        style: 'destructive',
        onPress: async () => {
          await signOut();
          router.replace('/login');
        },
      },
    ]);
  };

  const soon = (what: string) =>
    showToast({ type: 'info', title: what, body: 'Coming in a later release.' });

  const Row = ({ label, value }: { label: string; value: string }) => (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );

  const Stat = ({ value, label, icon }: { value: string | number; label: string; icon: React.ReactNode }) => (
    <View style={styles.stat}>
      <View style={{ marginBottom: 5 }}>{icon}</View>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );

  const LinkRow = ({
    icon, label, sub, onPress, last,
  }: { icon: React.ReactNode; label: string; sub?: string; onPress: () => void; last?: boolean }) => (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={[
        styles.linkRow,
        !last && { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.borderHairline },
      ]}
    >
      <View style={{ width: 30, alignItems: 'center' }}>{icon}</View>
      <View style={{ flex: 1 }}>
        <Text style={styles.linkLabel}>{label}</Text>
        {!!sub && <Text style={styles.linkSub}>{sub}</Text>}
      </View>
      <Ico.ChevronRight size={16} color="#bbb" />
    </Pressable>
  );

  const phone = (partner?.phone || '').replace('+91', '');
  const prettyPhone = phone.length === 10 ? `+91 ${phone.slice(0, 5)} ${phone.slice(5)}` : partner?.phone || '—';

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.surfacePage }}>
      <Header tone="green" title="Profile" />

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.hero}>
          <Avatar name={partner?.name} photo={partner?.photo} size={88} />
          <Text style={styles.name}>{partner?.name || 'Your profile'}</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={styles.roleChip}>
              <Text style={styles.roleTxt}>Buddy</Text>
            </View>
            {!!partner && <RatingInline value={partner.rating} trips={partner.trips} size={15} />}
          </View>
        </View>

        <View style={styles.statRow}>
          <Stat
            value={partner?.trips ?? 0}
            label="Lifetime trips"
            icon={<Ico.Navigation size={17} color={theme.colors.green500} />}
          />
          <Stat
            value={(partner?.rating ?? 0).toFixed(1)}
            label="Rating"
            icon={<Ico.Star size={17} color={theme.colors.star} fill={theme.colors.star} />}
          />
          <Stat
            value={money(lifetime)}
            label="Earned here"
            icon={<Ico.Wallet size={17} color={theme.colors.green500} />}
          />
        </View>

        <View>
          <SectionLabel>Account</SectionLabel>
          <View style={styles.card}>
            <Row label="Phone" value={prettyPhone} />
            <Row label="Licence number" value={partner?.licence || 'Not on file'} />
            <View style={[styles.row, { borderBottomWidth: 0 }]}>
              <Text style={styles.rowLabel}>Buddy since</Text>
              <Text style={styles.rowValue}>{fmtDate(partner?.joined, true)}</Text>
            </View>
          </View>
        </View>

        <View style={styles.card}>
          <LinkRow
            icon={<Ico.Wallet size={18} color={theme.colors.green500} />}
            label="Earnings & payouts"
            sub="Weekly settlement to your account"
            onPress={() => router.push('/(tabs)/earnings')}
          />
          <LinkRow
            icon={<Ico.FileText size={18} color={theme.colors.green500} />}
            label="Documents"
            sub="Licence, ID, vehicle papers"
            onPress={() => soon('Documents')}
          />
          <LinkRow
            icon={<Ico.Bell size={18} color={theme.colors.green500} />}
            label="Notifications"
            sub="Trip alerts & reminders"
            onPress={() => soon('Notifications')}
          />
          <LinkRow
            icon={<Ico.Phone size={18} color={theme.colors.green500} />}
            label="Help & support"
            sub="Reach RideBuddy Ops"
            onPress={() => soon('Help & support')}
            last
          />
        </View>

        <View style={styles.privacy}>
          <Ico.Shield size={18} color={theme.colors.green700} />
          <Text style={styles.privacyTxt}>
            Your verification documents are held securely by RideBuddy Ops and are never shown to customers.
          </Text>
        </View>

        {history.length > 0 && (
          <View>
            <SectionLabel right={<Text style={styles.count}>{history.length} completed</Text>}>Gigs</SectionLabel>
            <View style={{ gap: 8 }}>
              {history.map((t) => {
                const from = (t.pickup_address || '').split(',').slice(-1)[0].trim();
                const to = (t.drop_area || '').split(',').slice(-1)[0].trim();
                return (
                  <Pressable
                    key={t.id}
                    onPress={() => router.push(`/trip/${t.id}`)}
                    style={styles.gig}
                    accessibilityRole="button"
                  >
                    <View style={{ flex: 1 }}>
                      <Text style={styles.gigRoute}>
                        {from} → {to}
                      </Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 }}>
                        <Text style={styles.gigMeta}>
                          {fmtDate(t.completed_at)} · {t.customer}
                        </Text>
                        {!!t.rating && <Stars value={t.rating} size={11} />}
                      </View>
                    </View>
                    <Text style={styles.gigMoney}>{money(t.earnings)}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}

        <Pressable onPress={confirmSignOut} style={styles.signOut} accessibilityRole="button">
          <Ico.LogOut size={17} color={theme.colors.error} />
          <Text style={styles.signOutTxt}>Sign out</Text>
        </Pressable>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: theme.spacing.lg, paddingBottom: 40, gap: 18 },
  hero: { alignItems: 'center', gap: 10, paddingTop: 8 },
  name: { fontFamily: theme.fonts.displayExtra, fontSize: 24, color: theme.colors.textPrimary },
  roleChip: { backgroundColor: theme.colors.green50, borderRadius: theme.radius.pill, paddingHorizontal: 12, paddingVertical: 4 },
  roleTxt: { fontFamily: theme.fonts.bodySemi, fontSize: 12, color: theme.colors.green700 },

  statRow: { flexDirection: 'row', gap: 10 },
  stat: {
    flex: 1, backgroundColor: theme.colors.surfaceCard, borderRadius: 14,
    borderWidth: StyleSheet.hairlineWidth, borderColor: theme.colors.borderHairline,
    paddingVertical: 14, paddingHorizontal: 8, alignItems: 'center', ...theme.shadow.md,
  },
  statValue: { fontFamily: theme.fonts.displayExtra, fontSize: 17, color: theme.colors.textPrimary },
  statLabel: { fontFamily: theme.fonts.body, fontSize: 11, color: theme.colors.textSecondary, marginTop: 3 },

  card: {
    backgroundColor: theme.colors.surfaceCard, borderRadius: theme.radius.lg,
    borderWidth: StyleSheet.hairlineWidth, borderColor: theme.colors.borderHairline,
    paddingHorizontal: theme.spacing.lg, ...theme.shadow.md,
  },
  row: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: theme.colors.borderHairline,
  },
  rowLabel: { fontFamily: theme.fonts.body, fontSize: 13.5, color: theme.colors.textSecondary },
  rowValue: { fontFamily: theme.fonts.bodySemi, fontSize: 14, color: theme.colors.textPrimary },

  linkRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 13 },
  linkLabel: { fontFamily: theme.fonts.bodySemi, fontSize: 14, color: theme.colors.textPrimary },
  linkSub: { fontFamily: theme.fonts.body, fontSize: 12, color: theme.colors.textSecondary, marginTop: 1 },

  privacy: {
    flexDirection: 'row', gap: 9, alignItems: 'flex-start',
    backgroundColor: theme.colors.green50, borderRadius: theme.radius.lg, padding: 14,
  },
  privacyTxt: { flex: 1, fontFamily: theme.fonts.body, fontSize: 13, color: theme.colors.green800, lineHeight: 19 },

  count: { fontFamily: theme.fonts.body, fontSize: 12, color: theme.colors.textSecondary },
  gig: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: theme.colors.surfaceCard, borderRadius: theme.radius.lg, padding: 14,
    borderWidth: StyleSheet.hairlineWidth, borderColor: theme.colors.borderHairline,
  },
  gigRoute: { fontFamily: theme.fonts.display, fontSize: 14.5, color: theme.colors.textPrimary },
  gigMeta: { fontFamily: theme.fonts.body, fontSize: 12.5, color: theme.colors.textSecondary },
  gigMoney: { fontFamily: theme.fonts.display, fontSize: 14.5, color: theme.colors.textPrimary },

  signOut: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 1.5, borderColor: theme.colors.borderHairline,
    backgroundColor: theme.colors.surfaceCard, borderRadius: theme.radius.lg, paddingVertical: 13,
  },
  signOutTxt: { fontFamily: theme.fonts.bodySemi, fontSize: 14, color: theme.colors.error },
});
