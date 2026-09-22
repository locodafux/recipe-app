// Screens 3 and 4: the List tab. Two segments of one list: this week's dishes, and the merged market list.
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { BY_ID, categoryIcon, categoryLabel } from '../data.ts';
import { byAisle, type Line } from '../merge.ts';
import { toggleDish, useStore } from '../store.ts';
import { Badge, Button, C, Cta, Header, Section, s } from '../ui.tsx';
import { LineRow, dishCount } from './LineRow.tsx';

export type Segment = 'dishes' | 'market';

export function ListTab({ lines, segment, setSegment, onBrowse, onOpen, onShop, onShared }: {
  lines: Line[]; segment: Segment; setSegment: (s: Segment) => void; onBrowse: () => void; onOpen: (id: string) => void;
  onShop: () => void; onShared: () => void;
}) {
  const { week, ticks, shared } = useStore();
  const [open, setOpen] = useState<string | null>(null);
  const dishes = week.map((id) => BY_ID.get(id)).filter((r) => r !== undefined);
  const merged = lines.filter((l) => dishCount(l) > 1).length;
  const nDishes = `${dishes.length} dish${dishes.length === 1 ? '' : 'es'}`;
  const nBuy = `${lines.length} to buy`;

  if (dishes.length === 0) {
    return (
      <View style={s.screen}>
        <Header title="This week's list" sub="Nothing picked yet" />
        <View style={s.empty}>
          <Text style={{ fontSize: 40 }}>🧺</Text>
          <Text style={s.emptyText}>Pick the dishes you want to cook this week and their ingredients land here as one market list.</Text>
          {shared && <Button small icon="cart" title={`Open ${shared.name}`} onPress={onShared} style={{ alignSelf: 'stretch', marginTop: 8 }} />}
          <Button small kind={shared ? 'secondary' : 'primary'} title="Browse dishes" onPress={onBrowse} style={{ alignSelf: 'stretch', marginTop: 8 }} />
        </View>
      </View>
    );
  }

  return (
    <View style={s.screen}>
      {segment === 'dishes' ? (
        <Header title="This week's list" sub={`${nDishes} · ${nBuy}`} />
      ) : (
        <Header title="Market list" sub={`${nBuy} · merged from ${nDishes}`}
          right={merged > 0 ? <View style={{ marginTop: 8 }}><Badge text={`${merged} merged`} fg={C.achuete} bg={C.achueteSoft} /></View> : undefined} />
      )}
      <View style={s.seg} accessibilityRole="tablist">
        {([['dishes', nDishes], ['market', nBuy]] as const).map(([key, label]) => (
          <Pressable key={key} onPress={() => setSegment(key)} style={[s.segItem, segment === key && s.segOn]}
            accessibilityRole="tab" accessibilityState={{ selected: segment === key }}>
            <Text style={[s.segText, segment === key && { color: C.ink }]}>{label}</Text>
          </Pressable>
        ))}
      </View>

      {segment === 'dishes' ? (
        <>
          <ScrollView contentContainerStyle={{ paddingBottom: 12 }}>
            {dishes.map((r) => (
              <View key={r.id}
                style={{ backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 14, paddingVertical: 13, paddingHorizontal: 14, marginHorizontal: 16, marginBottom: 10, flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                <Pressable onPress={() => onOpen(r.id)} accessibilityRole="button" style={{ flex: 1, flexDirection: 'row', gap: 12, alignItems: 'center' }}>
                  <View style={{ width: 46, height: 46, borderRadius: 11, backgroundColor: C.dahonSoft, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: 19 }}>{categoryIcon(r.category)}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 17, fontWeight: '700', color: C.ink }}>{r.name}</Text>
                    <Text style={s.mt}>{categoryLabel(r.category)} · {r.ingredients.length} ingredients</Text>
                  </View>
                </Pressable>
                <Pressable onPress={() => toggleDish(r.id)} hitSlop={8} accessibilityRole="button" accessibilityLabel={`Remove ${r.name}`}
                  style={{ width: 34, height: 34, borderRadius: 10, backgroundColor: 'rgba(31,26,19,0.06)', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="close" size={18} color={C.ink} />
                </Pressable>
              </View>
            ))}
            <View style={{ paddingHorizontal: 16 }}>
              <Button small kind="secondary" icon="add" title="Add another dish" onPress={onBrowse} />
              <Text style={s.hint}>Tap × to remove a dish.</Text>
            </View>
          </ScrollView>
          <Cta><Button title={`Make the list · ${nBuy}`} onPress={() => setSegment('market')} /></Cta>
        </>
      ) : (
        <>
          <ScrollView>
            {byAisle(lines).map((g) => (
              <View key={String(g.aisle)}>
                <Section aisle={g.aisle} count={g.items.length} />
                {g.items.map((l) => (
                  <LineRow key={l.key} line={l} checked={!!ticks[l.key]} expanded={open === l.key}
                    onPress={dishCount(l) > 1 ? () => setOpen(open === l.key ? null : l.key) : undefined}
                    a11yHint="Shows which dishes this was merged from" />
                ))}
              </View>
            ))}
          </ScrollView>
          <Cta>
            <Button icon="cart" title="Start shopping" onPress={onShop} />
            <Text style={s.hint}>Ticks are saved on this phone, even with no signal</Text>
          </Cta>
        </>
      )}
    </View>
  );
}
