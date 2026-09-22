// Screen 6: History. 6A archived trips, newest first, each with Repeat; 6B the "Repeat this list?" sheet.
// Tapping a trip shows what was bought, fully as it ended: ticked lines ticked, the rest not.
import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, ScrollView, Text, View } from 'react-native';
import { BY_ID, ID_BY_NAME, INDEX } from '../data.ts';
import { dishSummary, repeatIds, tripDate, tripDishes, type Trip } from '../history.ts';
import { byAisle, merge } from '../merge.ts';
import { refreshHistory } from '../remote.ts';
import { repeatTrip, useStore } from '../store.ts';
import { Button, C, Cta, Header, Section, s } from '../ui.tsx';
import { LineRow } from './LineRow.tsx';

const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;

export function History({ onOpen, onRepeated }: { onOpen: (id: string) => void; onRepeated: () => void }) {
  const { history } = useStore();
  const [asking, setAsking] = useState<Trip | null>(null);
  useEffect(() => { refreshHistory(); }, []);

  if (history.length === 0) {
    return (
      <View style={s.screen}>
        <Header title="History" />
        <View style={s.empty}>
          <Text style={{ fontSize: 40 }}>🧾</Text>
          <Text style={s.emptyText}>Finish a shopping trip and it is kept here, so next week you can repeat it.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={s.screen}>
      <Header title="History" sub={plural(history.length, 'trip')} />
      <ScrollView contentContainerStyle={{ paddingBottom: 12 }}>
        {history.map((t) => {
          const dishes = tripDishes(t);
          return (
            <View key={t.id} style={{ backgroundColor: C.card, borderWidth: 1, borderColor: C.line, borderRadius: 14, padding: 14, marginHorizontal: 16, marginBottom: 10, flexDirection: 'row', gap: 12, alignItems: 'center' }}>
              <Pressable onPress={() => onOpen(t.id)} accessibilityRole="button" accessibilityHint="Shows what was bought" style={{ flex: 1 }}>
                <Text style={{ fontSize: 17, fontWeight: '700', color: C.ink }}>{tripDate(t.at)}</Text>
                <Text style={s.mt}>{plural(t.lines.length, 'item')} · {plural(dishes.length, 'dish', 'dishes')}</Text>
                <Text style={[s.mt, { color: C.ink }]} numberOfLines={1}>{dishSummary(dishes)}</Text>
              </Pressable>
              <Button small kind="secondary" icon="repeat" title="Repeat" onPress={() => setAsking(t)} style={{ paddingHorizontal: 14 }} />
            </View>
          );
        })}
      </ScrollView>
      <RepeatSheet trip={asking} onClose={() => setAsking(null)} onRepeated={onRepeated} />
    </View>
  );
}

export function TripDetail({ id, onBack, onRepeated }: { id: string; onBack: () => void; onRepeated: () => void }) {
  const { history } = useStore();
  const [asking, setAsking] = useState(false);
  const t = history.find((h) => h.id === id);
  if (!t) return null;
  const bought = new Set(t.bought);
  return (
    <View style={s.screen}>
      <Header onBack={onBack} title={tripDate(t.at)} sub={`${plural(t.lines.length, 'item')} · ${bought.size} bought`} />
      <ScrollView>
        {byAisle(t.lines).map((g) => (
          <View key={String(g.aisle)}>
            <Section aisle={g.aisle} count={g.items.length} />
            {g.items.map((l) => <LineRow key={l.key} line={l} checked={bought.has(l.key)} />)}
          </View>
        ))}
      </ScrollView>
      <Cta><Button icon="repeat" title="Repeat this list" onPress={() => setAsking(true)} /></Cta>
      <RepeatSheet trip={asking ? t : null} onClose={() => setAsking(false)} onRepeated={onRepeated} />
    </View>
  );
}

/** 6B: new, nothing ticked, the old trip unchanged. Counts are the new list's, from today's catalogue. */
function RepeatSheet({ trip, onClose, onRepeated }: { trip: Trip | null; onClose: () => void; onRepeated: () => void }) {
  const { week } = useStore();
  const ids = useMemo(() => (trip ? repeatIds(trip, ID_BY_NAME) : []), [trip]);
  const n = useMemo(() => merge(ids.map((id) => BY_ID.get(id)!), INDEX).length, [ids]);
  const make = () => { repeatTrip(trip!, ID_BY_NAME); onClose(); onRepeated(); };
  return (
    <Modal visible={trip != null} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={{ flex: 1, backgroundColor: 'rgba(31,26,19,0.35)' }} onPress={onClose} accessibilityLabel="Cancel" />
      <View style={{ backgroundColor: C.paper, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 28, gap: 10 }}>
        <Text style={[s.h1, s.h1small]} accessibilityRole="header">Repeat this list?</Text>
        {ids.length > 0 ? (
          <Text style={s.emptyText}>
            This makes a <Text style={{ fontWeight: '800', color: C.ink }}>new list</Text> with {plural(n, 'item')} from{' '}
            {plural(ids.length, 'dish', 'dishes')} — nothing ticked, ready to buy again. The old trip will not change.
            {week.length > 0 && ` It replaces the ${plural(week.length, 'dish', 'dishes')} on this week's list.`}
          </Text>
        ) : (
          <Text style={s.emptyText}>None of this trip's dishes are in the recipe book any more, so there is nothing to repeat.</Text>
        )}
        {ids.length > 0 && <Button title="Make it a new list" onPress={make} />}
        <Button kind="secondary" title="Cancel" onPress={onClose} />
      </View>
    </Modal>
  );
}
