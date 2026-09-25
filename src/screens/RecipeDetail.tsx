// Screen 2: Recipe detail. Ingredients grouped by aisle before you add the dish.
import { ScrollView, Text, View } from 'react-native';
import { BY_ID, categoryLabel } from '../data.ts';
import { byAisle, displayName, formatParts } from '../merge.ts';
import { toggleDish, useStore } from '../store.ts';
import { Button, C, Cta, Header, Section, s } from '../ui.tsx';

export function RecipeDetail({ id, onBack }: { id: string; onBack: () => void }) {
  const { week } = useStore();
  const r = BY_ID.get(id);
  if (!r) return null;
  const picked = week.includes(id);
  const n = r.ingredients.length;
  const host = r.source.replace(/^https?:\/\/(www\.)?/, '').split('/')[0];

  return (
    <View style={s.screen}>
      <Header onBack={onBack} title={r.name}
        sub={[categoryLabel(r.category), r.servings && `${r.servings} servings`, `${n} ingredients`].filter(Boolean).join(' · ')} />
      <ScrollView>
        {r.alt.length > 0 && (
          <Text style={[s.mt, { paddingHorizontal: 16, paddingBottom: 4, fontSize: 14 }]}>Also called: {r.alt.join(', ')}</Text>
        )}
        {byAisle(r.ingredients).map((g) => (
          <View key={String(g.aisle)}>
            <Section aisle={g.aisle} count={g.items.length} />
            {g.items.map((i, k) => (
              <View key={k} style={[s.row, { minHeight: 52 }, k === 0 && { borderTopWidth: 1, borderTopColor: C.line }]}>
                <View style={s.main}><Text style={s.nm}>{displayName(i)}</Text></View>
                <Text style={[s.qty, { fontSize: 15 }]}>{formatParts([i])}</Text>
              </View>
            ))}
          </View>
        ))}
        {r.steps.length > 0 && (
          <View>
            <Section label="Steps" count={r.steps.length} />
            {r.steps.map((step, k) => (
              <View key={k} style={[s.row, { minHeight: 0, alignItems: 'flex-start', paddingVertical: 12 }, k === 0 && { borderTopWidth: 1, borderTopColor: C.line }]}>
                <Text style={[s.qty, { fontSize: 15, width: 22 }]}>{k + 1}</Text>
                <View style={s.main}><Text style={[s.nm, { fontWeight: '400', lineHeight: 22 }]}>{step}</Text></View>
              </View>
            ))}
          </View>
        )}
        <Text style={[s.mt, { padding: 16, fontSize: 12.5, lineHeight: 18 }]}>
          Ingredient list from {host}. Steps are written for this app, not copied from any source.
        </Text>
      </ScrollView>
      <Cta>
        {picked ? (
          <Button kind="secondary" icon="checkmark" title="On this week's list · remove" onPress={() => toggleDish(id)} />
        ) : (
          <Button icon="add" title="Add to this week" onPress={() => toggleDish(id)} />
        )}
        <Text style={s.hint}>
          {picked ? 'Its ingredients are in the market list' : `${n} ingredients will go into one list`}
        </Text>
      </Cta>
    </View>
  );
}
