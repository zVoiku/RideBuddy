import React, { useEffect, useRef } from 'react';
import { View, Text, Pressable, StyleSheet, Animated, Easing } from 'react-native';
import { Tabs, useRouter, Redirect } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRB } from '../../src/store';
import { theme } from '../../src/theme';
import { Ico } from '../../src/icons';

const TABS = [
  { name: 'home', label: 'Home', icon: Ico.Home },
  { name: 'messages', label: 'Messages', icon: Ico.Message },
  { name: 'earnings', label: 'Earnings', icon: Ico.Wallet },
  { name: 'profile', label: 'Profile', icon: Ico.User },
] as const;

/** Pulsing dot on the active-trip banner. */
function Pulse() {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(
      Animated.timing(v, { toValue: 1, duration: 1800, easing: Easing.out(Easing.ease), useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, []);
  return (
    <View style={styles.pulseWrap}>
      <Animated.View
        style={[
          styles.pulseRing,
          {
            opacity: v.interpolate({ inputRange: [0, 0.7, 1], outputRange: [0.9, 0, 0] }),
            transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1.5] }) }],
          },
        ]}
      />
      <Ico.Navigation size={16} color="#fff" fill="#fff" />
    </View>
  );
}

/** Persistent banner shown above the tab bar whenever a trip is running. */
function ActiveTripBanner() {
  const { activeTrip } = useRB();
  const router = useRouter();
  if (!activeTrip) return null;

  const phase =
    activeTrip.status === 'in_progress'
      ? 'En route to drop'
      : activeTrip.status === 'arrived'
      ? 'At pickup point'
      : 'Heading to pickup';

  const from = (activeTrip.pickup_address || '').split(',').slice(-1)[0].trim();
  const to = (activeTrip.drop_area || activeTrip.drop_address || '').split(',').slice(-1)[0].trim();

  return (
    <Pressable
      onPress={() => router.push(`/nav/${activeTrip.id}`)}
      accessibilityRole="button"
      style={styles.banner}
    >
      <Pulse />
      <View style={{ flex: 1, minWidth: 0 }}>
        <Text style={styles.bannerTitle}>Trip in progress · {phase}</Text>
        <Text style={styles.bannerSub} numberOfLines={1}>
          {from} → {to}
        </Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Text style={styles.bannerOpen}>Open</Text>
        <Ico.ChevronRight size={15} color="#fff" />
      </View>
    </Pressable>
  );
}

function TabBar({ state, navigation }: any) {
  const insets = useSafeAreaInsets();
  return (
    <View>
      <ActiveTripBanner />
      <View style={[styles.nav, { paddingBottom: Math.max(insets.bottom, 12) }]}>
        {state.routes.map((route: any, i: number) => {
          const meta = TABS.find((t) => t.name === route.name);
          if (!meta) return null;
          const focused = state.index === i;
          const color = focused ? theme.colors.brandPrimary : theme.colors.greyNav;
          const Icon = meta.icon;
          return (
            <Pressable
              key={route.key}
              onPress={() => {
                const e = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                if (!focused && !e.defaultPrevented) navigation.navigate(route.name);
              }}
              accessibilityRole="button"
              accessibilityState={{ selected: focused }}
              accessibilityLabel={meta.label}
              style={styles.tab}
            >
              <Icon size={23} color={color} />
              <Text
                style={[
                  styles.tabLabel,
                  { color, fontFamily: focused ? theme.fonts.bodySemi : theme.fonts.body },
                ]}
              >
                {meta.label}
              </Text>
              <View style={[styles.dot, { opacity: focused ? 1 : 0 }]} />
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

export default function TabsLayout() {
  const { partner, ready } = useRB();
  if (ready && !partner) return <Redirect href="/login" />;
  return (
    <Tabs screenOptions={{ headerShown: false }} tabBar={(props) => <TabBar {...props} />}>
      {TABS.map((t) => (
        <Tabs.Screen key={t.name} name={t.name} options={{ title: t.label }} />
      ))}
    </Tabs>
  );
}

const styles = StyleSheet.create({
  nav: {
    flexDirection: 'row',
    backgroundColor: theme.colors.surfaceCard,
    borderTopLeftRadius: theme.radius.xxl,
    borderTopRightRadius: theme.radius.xxl,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(100,100,100,0.12)',
    paddingTop: 8,
    shadowColor: '#1A2110',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.06,
    shadowRadius: 16,
    elevation: 12,
  },
  tab: { flex: 1, alignItems: 'center', gap: 3, paddingVertical: 6 },
  tabLabel: { fontSize: 10.5 },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: theme.colors.brandPrimary },

  banner: {
    marginHorizontal: 10,
    marginBottom: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
    backgroundColor: theme.colors.brandPrimary,
    borderRadius: 14,
    paddingVertical: 11,
    paddingHorizontal: 14,
    shadowColor: '#1A2110',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.22,
    shadowRadius: 18,
    elevation: 8,
  },
  bannerTitle: { fontFamily: theme.fonts.display, fontSize: 13.5, color: '#fff' },
  bannerSub: { fontFamily: theme.fonts.body, fontSize: 12, color: 'rgba(255,255,255,0.8)', marginTop: 1 },
  bannerOpen: { fontFamily: theme.fonts.bodySemi, fontSize: 12.5, color: '#fff' },

  pulseWrap: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  pulseRing: {
    position: 'absolute', width: 30, height: 30, borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.22)',
  },
});
