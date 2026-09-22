// Screen 1: Browse + search. D1: search stays primary, category chips filter the same list.
import { Ionicons } from '@expo/vector-icons';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, SectionList, Text, TextInput, View } from 'react-native';
import { normalize } from '../canonicalize.ts';
import { CATEGORIES, RECIPES, categoryLabel } from '../data.ts';
import type { Recipe } from '../merge.ts';
import { toggleDish, useStore } from '../store.ts';
import { Badge, Button, C, Cta, Header, Section, s } from '../ui.tsx';

const COUNTS = new Map(CATEGORIES.map((c) => [c.key, RECIPES.filter((r) => r.category === c.key).length]));
const HAYSTACK = new Map(RECIPES.map((r) => [r.id, normalize([r.name, ...r.alt].join(' '))]));

export function Browse({ onOpen, toBuy, onSeeList }: { onOpen: (id: string) => void; toBuy: number; onSeeList: () => void }) {
  const { week } = useStore();
  const [query, setQuery] = useState('');
  const [cat, setCat] = useState<string | null>(null);
  const [focused, setFocused] = useState(false);

  const q = normalize(query);
  const hits = useMemo(
    () => RECIPES.filter((r) => (!cat || r.category === cat) && (!q || HAYSTACK.get(r.id)!.includes(q))),
    [q, cat],
  );
  // Browsing groups by first letter; a search shows one "N results" band.
  const sections = useMemo(() => {
    if (q) return [{ title: `${hits.length} result${hits.length === 1 ? '' : 's'} of ${RECIPES.length}`, data: hits }];
    const groups = new Map<string, Recipe[]>();
    for (const r of hits) {
      const letter = r.name[0].toUpperCase();
      groups.set(letter, [...(groups.get(letter) ?? []), r]);
    }
    return [...groups].map(([title, data]) => ({ title, data }));
  }, [q, hits]);

  return (
    <View style={s.screen}>
      <Header title="What are we cooking?" sub={`${RECIPES.length} dishes · all of it works with no signal`} />
      <View style={[s.search, focused && s.searchOn]}>
        <Ionicons name="search" size={18} color={C.ink2} />
        <TextInput value={query} onChangeText={setQuery} placeholder="Search for a dish…" placeholderTextColor={C.ink2}
          style={s.searchInput} autoCorrect={false} returnKeyType="search" clearButtonMode="while-editing" accessibilityLabel="Search dishes"
          onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} />
      </View>
      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 16, paddingBottom: 12 }}>
          <Chip label="All" n={RECIPES.length} on={!cat} onPress={() => setCat(null)} />
          {CATEGORIES.map((c) => (
            <Chip key={c.key} label={c.label} n={COUNTS.get(c.key)!} on={cat === c.key} onPress={() => setCat(cat === c.key ? null : c.key)} />
          ))}
        </ScrollView>
      </View>
      <SectionList
        sections={sections}
        keyExtractor={(r) => r.id}
        stickySectionHeadersEnabled
        keyboardShouldPersistTaps="handled"
        renderSectionHeader={({ section }) => <Section label={section.title} />}
        ListEmptyComponent={<View style={s.empty}><Text style={s.emptyText}>No dish matches “{query}”.</Text></View>}
        renderItem={({ item: r }) => {
          const picked = week.includes(r.id);
          return (
            <Pressable style={s.row} onPress={() => onOpen(r.id)} accessibilityRole="button" accessibilityLabel={r.name}>
              <View style={s.main}>
                <Text style={s.nm}>{r.name}</Text>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 2 }}>
                  <Text style={[s.mt, { marginTop: 0, flexShrink: 1 }]} numberOfLines={1}>
                    {[categoryLabel(r.category), q ? r.alt.join(', ') : ''].filter(Boolean).join(' · ')}
                  </Text>
                  {picked && <Badge text="On list" fg={C.dahon} bg={C.dahonSoft} />}
                </View>
              </View>
              <Pressable onPress={() => toggleDish(r.id)} hitSlop={10} accessibilityRole="checkbox"
                accessibilityState={{ checked: picked }} accessibilityLabel={picked ? `Remove ${r.name} from this week` : `Add ${r.name} to this week`}
                style={[{ width: 28, height: 28, borderRadius: 999, borderWidth: 2, alignItems: 'center', justifyContent: 'center', borderColor: 'rgba(20,97,60,0.45)' },
                  picked && { backgroundColor: C.dahon, borderColor: C.dahon }]}>
                <Ionicons name={picked ? 'checkmark' : 'add'} size={18} color={picked ? '#fff' : C.dahon} />
              </Pressable>
            </Pressable>
          );
        }}
      />
      {week.length > 0 && (
        <Cta>
          <Button small title={`${week.length} dish${week.length === 1 ? '' : 'es'} picked · see the ${toBuy} to buy`} onPress={onSeeList} />
        </Cta>
      )}
    </View>
  );
}

function Chip({ label, n, on, onPress }: { label: string; n: number; on: boolean; onPress: () => void }) {
  return (
    <Pressable onPress={onPress} style={[s.chip, on && s.chipOn]} accessibilityRole="button" accessibilityState={{ selected: on }}>
      <Text style={[s.chipText, on && { color: '#fff' }]}>{label}</Text>
      <Text style={[s.chipN, on && { color: 'rgba(255,255,255,0.72)' }]}>{n}</Text>
    </Pressable>
  );
}
