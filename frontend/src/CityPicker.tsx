import { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, FlatList, Modal, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { theme } from './theme';
import { placesAutocomplete, getPlaceDetails, PlaceSuggestion } from './maps';

export interface SelectedPlace {
  description: string;
  lat: number;
  lng: number;
  place_id: string;
}

interface Props {
  visible: boolean;
  title: string;
  selected?: string;
  onClose: () => void;
  onSelect: (p: SelectedPlace) => void;
}

export default function CityPicker({ visible, title, selected, onClose, onSelect }: Props) {
  const [q, setQ] = useState('');
  const [suggestions, setSuggestions] = useState<PlaceSuggestion[]>([]);
  const [loading, setLoading] = useState(false);
  const [resolving, setResolving] = useState<string | null>(null);

  useEffect(() => {
    if (!visible) { setQ(''); setSuggestions([]); return; }
  }, [visible]);

  useEffect(() => {
    if (!q || q.length < 2) { setSuggestions([]); return; }
    const t = setTimeout(async () => {
      setLoading(true);
      const list = await placesAutocomplete(q);
      setSuggestions(list);
      setLoading(false);
    }, 250);
    return () => clearTimeout(t);
  }, [q]);

  const choose = async (p: PlaceSuggestion) => {
    setResolving(p.place_id);
    const det = await getPlaceDetails(p.place_id);
    setResolving(null);
    if (!det) { return; }
    onSelect({ description: p.description, lat: det.lat, lng: det.lng, place_id: p.place_id });
    onClose();
  };

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
              placeholder="Search any city, area or landmark in India…"
              placeholderTextColor={theme.colors.textSecondary}
              autoFocus
            />
            {q.length > 0 && <TouchableOpacity onPress={() => setQ('')}><Ionicons name="close-circle" size={18} color={theme.colors.textSecondary} /></TouchableOpacity>}
          </View>
          {loading && <ActivityIndicator color={theme.colors.primary} style={{ marginTop: 12 }} />}
          <FlatList
            data={suggestions}
            keyExtractor={(p) => p.place_id}
            contentContainerStyle={{ padding: 16, paddingBottom: 40 }}
            keyboardShouldPersistTaps="handled"
            renderItem={({ item }) => (
              <TouchableOpacity
                testID={`city-${item.main_text}`}
                style={styles.row}
                onPress={() => choose(item)}
                disabled={!!resolving}
              >
                <Ionicons name="location-outline" size={20} color={theme.colors.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.rowMain}>{item.main_text}</Text>
                  {item.secondary_text ? <Text style={styles.rowSub}>{item.secondary_text}</Text> : null}
                </View>
                {resolving === item.place_id ? <ActivityIndicator color={theme.colors.primary} /> : <Ionicons name="chevron-forward" size={18} color={theme.colors.textTertiary} />}
              </TouchableOpacity>
            )}
            ListEmptyComponent={
              !loading && q.length >= 2 ? <Text style={styles.empty}>No matches for "{q}"</Text> :
              q.length < 2 ? <Text style={styles.empty}>Start typing to search Indian cities & landmarks</Text> : null
            }
          />
          <View style={styles.poweredBy}>
            <Text style={styles.poweredText}>Powered by Google</Text>
          </View>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  head: { backgroundColor: theme.colors.primary, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 },
  back: { width: 40, height: 40, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' },
  title: { color: theme.colors.inverse, fontSize: 22, fontWeight: '900' },
  searchWrap: { flexDirection: 'row', alignItems: 'center', gap: 10, margin: 16, paddingHorizontal: 14, height: 52, borderRadius: theme.radius.pill, backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.borderLight },
  search: { flex: 1, fontSize: 15, color: theme.colors.textPrimary, fontWeight: '500' },
  row: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14, paddingHorizontal: 14, borderRadius: theme.radius.md, marginBottom: 6, backgroundColor: theme.colors.card },
  rowMain: { fontSize: 15, color: theme.colors.textPrimary, fontWeight: '700' },
  rowSub: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 },
  empty: { color: theme.colors.textSecondary, textAlign: 'center', padding: 30 },
  poweredBy: { padding: 10, alignItems: 'center' },
  poweredText: { fontSize: 11, color: theme.colors.textTertiary, fontWeight: '600' },
});
