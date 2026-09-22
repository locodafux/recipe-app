// Screen 5: Shopping, a full-screen mode. Local-first ticks (README 4).
// D4: bought items stay in place, struck through. D5: undo only while the tick is still queued.
import { Alert, Platform, ScrollView, Text, View } from 'react-native';
import { byAisle, type Line } from '../merge.ts';
import { canUndo, finishShopping, tick, undo, useStore } from '../store.ts';
import { Button, C, Cta, Header, Section, s } from '../ui.tsx';
import { LineRow } from './LineRow.tsx';

export function Shopping({ lines, onClose }: { lines: Line[]; onClose: () => void }) {
  const { ticks } = useStore();
  const bought = lines.filter((l) => ticks[l.key]).length;
  const queued = lines.filter((l) => ticks[l.key]?.synced === false).length;
  const pct = lines.length ? bought / lines.length : 0;

  const finish = () => {
    const done = () => { finishShopping(); onClose(); };
    const msg = `${bought} of ${lines.length} bought. This clears the ticks.`;
    if (Platform.OS === 'web') { if (window.confirm(`Finish shopping?\n${msg}`)) done(); return; }
    Alert.alert('Finish shopping?', msg, [{ text: 'Keep shopping', style: 'cancel' }, { text: 'Finish', onPress: done }]);
  };

  return (
    <View style={s.screen}>
      <Header onBack={onClose} title="Shopping" sub={`${bought} of ${lines.length} bought`} />
      <View style={{ marginHorizontal: 16, marginBottom: 12 }}>
        <View style={{ height: 9, borderRadius: 999, backgroundColor: 'rgba(31,26,19,0.1)', overflow: 'hidden' }}>
          <View style={{ height: '100%', width: `${pct * 100}%`, backgroundColor: C.dahon }} />
        </View>
        <View style={{ flexDirection: 'row', gap: 12, marginTop: 7, flexWrap: 'wrap' }}>
          <Legend color={C.dahon} text={`You · ${bought}`} />
          {queued > 0 && <Legend color={C.tanso} text={`${queued} queued`} />}
          <Legend color="rgba(31,26,19,0.2)" text={`Left · ${lines.length - bought}`} />
        </View>
      </View>
      <ScrollView>
        {byAisle(lines).map((g) => (
          <View key={String(g.aisle)}>
            <Section aisle={g.aisle} count={`${g.items.filter((l) => ticks[l.key]).length}/${g.items.length}`} />
            {g.items.map((l) => {
              const t = ticks[l.key];
              const undoable = canUndo(l.key);
              return (
                <LineRow key={l.key} line={l} big checked={!!t} queued={undoable}
                  onPress={!t ? () => tick(l.key) : undoable ? () => undo(l.key) : undefined}
                  a11yHint={!t ? 'Marks it bought' : undoable ? 'Not sent yet, tap to undo' : 'Already shared, cannot be undone'} />
              );
            })}
          </View>
        ))}
        <Text style={[s.hint, { padding: 16 }]}>A tick can be undone while it is still queued on this phone.</Text>
      </ScrollView>
      <Cta><Button small kind="secondary" title="Finish shopping" onPress={finish} /></Cta>
    </View>
  );
}

function Legend({ color, text }: { color: string; text: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
      <View style={{ width: 9, height: 9, borderRadius: 3, backgroundColor: color }} />
      <Text style={{ fontSize: 12, fontWeight: '600', color: C.ink2 }}>{text}</Text>
    </View>
  );
}
