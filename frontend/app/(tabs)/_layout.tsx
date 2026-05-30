import { Tabs } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { View } from 'react-native';
import { theme } from '../../src/theme';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textTertiary,
        tabBarStyle: {
          backgroundColor: theme.colors.card,
          borderTopColor: theme.colors.borderHair,
          height: 86,
          paddingTop: 8,
          paddingBottom: 22,
          borderTopLeftRadius: theme.radius.xl,
          borderTopRightRadius: theme.radius.xl,
        },
        tabBarLabelStyle: { fontSize: 11, fontFamily: theme.fonts.bodyMed, marginTop: 2 },
        tabBarIcon: ({ color, focused }) => {
          const icon: any = route.name === 'home' ? 'car-sport' : route.name === 'trips' ? 'list' : 'person-circle';
          return (
            <View style={{ alignItems: 'center', gap: 3 }}>
              <Ionicons name={icon} size={22} color={color} />
              <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: focused ? theme.colors.primary : 'transparent' }} />
            </View>
          );
        },
      })}
    >
      <Tabs.Screen name="home" options={{ title: 'Home' }} />
      <Tabs.Screen name="trips" options={{ title: 'Trips' }} />
      <Tabs.Screen name="account" options={{ title: 'Account' }} />
    </Tabs>
  );
}
