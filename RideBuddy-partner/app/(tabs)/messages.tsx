// Messages — the tab exists so the design's four-tab bar is intact, but in-app
// chat is deferred to phase 2. The backend has no messages collection yet; when
// it lands, this screen grows the Active/Closed thread lists from the design and
// a thread route at app/thread/[id].tsx.
import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import { useRB } from '../../src/store';
import { theme } from '../../src/theme';
import { Header, Empty } from '../../src/ui';
import { Ico } from '../../src/icons';
import { DONE_STATES } from '../../src/theme';

export default function Messages() {
  const { trips } = useRB();
  const live = trips.filter((t) => !DONE_STATES.includes(t.status));

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.surfacePage }}>
      <Header tone="green" subtitle="In-app chat" title="Messages" />

      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.card}>
          <Empty
            icon={<Ico.Message size={30} color={theme.colors.green300} />}
            title="Chat is coming soon."
            body={
              live.length
                ? `A conversation will open here for each of your ${live.length} active ${
                    live.length === 1 ? 'trip' : 'trips'
                  }.`
                : 'A chat opens with each customer when a trip is assigned to you.'
            }
          />
        </View>

        <View style={styles.note}>
          <Ico.Phone size={18} color={theme.colors.green700} />
          <Text style={styles.noteTxt}>
            Until chat ships, reach the customer through RideBuddy Ops if you need to pass on a message.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  scroll: { padding: theme.spacing.lg, gap: 16 },
  card: {
    backgroundColor: theme.colors.surfaceCard,
    borderRadius: theme.radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: theme.colors.borderHairline,
  },
  note: {
    flexDirection: 'row',
    gap: 9,
    alignItems: 'flex-start',
    backgroundColor: theme.colors.green50,
    borderRadius: theme.radius.lg,
    padding: 14,
  },
  noteTxt: { flex: 1, fontFamily: theme.fonts.body, fontSize: 13, color: theme.colors.green800, lineHeight: 19 },
});
