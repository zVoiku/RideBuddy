import { useState, useMemo } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { theme } from './theme';
import { INDIAN_CITIES } from './cities';

interface Props {
  visible: boolean;
  title: string;
  selected?: string;
  onClose: () => void;
  onSelect: (city: string) => void;
}

export default function CityPicker({ visible, title, selected, onClose, onSelect }: Props) {
  const [q, setQ] = useState('');
  const filtered = useMemo(() => INDIAN_CITIES.filter((c) => c.toLowerCase().includes(q.toLowerCase())), [q]);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
        <SafeAreaView style={{ flex: 1 }} edges={['top']}>
          <View style={styles.head}>
            <TouchableOpacity testID="city-close" onPress={onClose} style={styles.back}>
              <Ionicons name="arrow-back" size={22} color={theme.colors.inverse} />
            </TouchableOpacity>
            <Text style={styles.title}>{title}</Text>
          </View>
          <View style={styles.searchWrap}>
            <Ionicons name="search" size={18} color={theme.colors.textSecondary} />
            <TextInput
              testID="city-search"
              style={styles.search}
              value={q}
              onChangeText={setQ}
              placeholder="Search cities…"
              placeholderTextColor={theme.colors.textSecondary}
            />
            {q.length > 0 && <TouchableOpacity onPress={() => setQ('')}><Ionicons name="close-circle" size={18} color={theme.colors.textSecondary} /></TouchableOpacity>}
          </View>
          <FlatList
            data={filtered}
            keyExtractor={(c) => c}
            contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => {
              const active = item === selected;
              return (
                <TouchableOpacity
                  testID={`city-${item.split(',')[0]}`}
                  style={[styles.row, active && styles.rowActive]}
                  onPress={() => { onSelect(item); onClose(); }}
                >
                  <Ionicons name="location-outline" size={20} color={active ? theme.colors.primary : theme.colors.textSecondary} />
                  <Text style={[styles.rowText, active && { color: theme.colors.primary, fontWeight: '900' }]}>{item}</Text>
                  {active && <Ionicons name="checkmark-circle" size={20} color={theme.colors.primary} />}
                </TouchableOpacity>
              );
            }}
            ListEmptyComponent={<Text style={styles.empty}>No cities match "{q}"</Text>}
          />
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  head: { backgroundColor: theme.colors.primary, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  back: { width: 40, height: 40, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  title: { color: theme.colors.inverse, fontSize: 22, fontWeight: '900' },
  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, margin: 16, paddingHorizontal: 14, height: 50, borderRadius: theme.radius.pill, backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.softCard },
  search: { flex: 1, fontSize: 15, color: theme.colors.textPrimary, fontWeight: '600' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingHorizontal: 16, borderRadius: theme.radius.md, marginBottom: 6, backgroundColor: theme.colors.card },
  rowActive: { backgroundColor: theme.colors.softCard, borderWidth: 1.5, borderColor: theme.colors.primary },
  rowText: { flex: 1, fontSize: 15, color: theme.colors.textPrimary, fontWeight: '600' },
  empty: { color: theme.colors.textSecondary, textAlign: 'center', padding: 40 },
});
