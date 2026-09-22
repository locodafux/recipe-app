// One merged market-list line, used by the Market list (screen 4) and Shopping (screen 5).
import { Pressable, Text, View, type LayoutChangeEvent } from 'react-native';
import { formatParts, type Line } from '../merge.ts';
import { Badge, C, Checkbox, s } from '../ui.tsx';

export function dishCount(l: Line) {
  return new Set(l.from.map((f) => f.dish)).size;
}

/** `by` is the partner's name when they ticked it (D3: ube band, avatar, "Ticked by Ana"); `fresh` washes the row. */
export function LineRow({ line, checked, queued, big, expanded, onPress, a11yHint, by, fresh, onLayout }: {
  line: Line; checked: boolean; queued?: boolean; big?: boolean; expanded?: boolean; onPress?: () => void; a11yHint?: string;
  by?: string; fresh?: boolean; onLayout?: (e: LayoutChangeEvent) => void;
}) {
  const n = dishCount(line);
  const qty = formatParts(line.parts);
  return (
    <>
      <Pressable onPress={onPress} disabled={!onPress} accessibilityHint={a11yHint} onLayout={onLayout}
        accessibilityRole={big ? 'checkbox' : 'button'} accessibilityState={big ? { checked } : { expanded }}
        style={[s.row, big && { minHeight: 66 }, checked && s.rowDone,
          by != null && { borderLeftWidth: 4, borderLeftColor: C.ube, paddingLeft: 12 }, fresh && { backgroundColor: C.ubeSoft }]}>
        <Checkbox checked={checked} big={big} />
        <View style={s.main}>
          <Text style={[s.nm, checked && s.nmDone]}>{line.label}</Text>
          <Text style={[s.mt, by != null && { color: C.ube, fontWeight: '700' }]} numberOfLines={1}>
            {by != null ? `Ticked by ${by}` : n > 1 ? `from ${n} dishes` : line.from[0]?.dish}
          </Text>
        </View>
        <View style={{ alignItems: 'flex-end', gap: 4, flexShrink: 0, maxWidth: '40%' }}>
          {qty !== '' && <Text style={[s.qty, checked && { color: C.ink2, fontWeight: '600' }]}>{qty}</Text>}
          {queued ? <Badge text="queued" fg={C.tanso} bg={C.tansoSoft} />
            : by != null ? <Avatar name={by} />
            : !big && n > 1 && <Badge text={`${n} dishes`} fg={C.achuete} bg={C.achueteSoft} />}
        </View>
      </Pressable>
      {expanded && <MergedFrom line={line} />}
    </>
  );
}

export function Avatar({ name, me }: { name: string; me?: boolean }) {
  return (
    <View style={{ width: 24, height: 24, borderRadius: 999, backgroundColor: me ? C.dahon : C.ube, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ color: '#fff', fontSize: 12, fontWeight: '800' }}>{name[0]?.toUpperCase()}</Text>
    </View>
  );
}

/** "Merged from N dishes": each dish's own amount, and the spellings the synonym map joined. */
function MergedFrom({ line }: { line: Line }) {
  const spellings = [...new Set(line.from.map((f) => f.item))];
  return (
    <View style={{ backgroundColor: C.achueteSoft, borderBottomWidth: 1, borderBottomColor: C.line, paddingTop: 11, paddingBottom: 13, paddingLeft: 57, paddingRight: 16 }}>
      <Text style={{ fontSize: 11, fontWeight: '800', letterSpacing: 1, textTransform: 'uppercase', color: C.achuete }}>
        Merged from {dishCount(line)} dishes
      </Text>
      {line.from.map((f, k) => (
        <Text key={k} style={{ fontSize: 14, lineHeight: 21, marginTop: k ? 0 : 4, fontWeight: '500', color: C.ink }}>
          {f.dish}: {formatParts([f]) || 'to taste'}
        </Text>
      ))}
      {spellings.length > 1 && (
        <Text style={{ fontSize: 12.5, lineHeight: 18, marginTop: 8, paddingTop: 8, color: C.ink2, borderTopWidth: 1, borderStyle: 'dashed', borderTopColor: 'rgba(181,67,20,0.35)' }}>
          Merged by the synonym map. The recipes wrote {spellings.join(', ')} — these are all one item.
        </Text>
      )}
    </View>
  );
}
