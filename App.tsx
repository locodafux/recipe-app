// Three tabs (Dishes · List · History); Recipe detail and Shopping open over them, Shopping with no tab bar.
// ponytail: state-based navigation, no router. Move to expo-router when invites need deep links.
import { Ionicons } from '@expo/vector-icons';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import { BackHandler, Pressable, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { BY_ID, INDEX } from './src/data.ts';
import { merge } from './src/merge.ts';
import { Browse } from './src/screens/Browse.tsx';
import { ListTab, type Segment } from './src/screens/ListTab.tsx';
import { RecipeDetail } from './src/screens/RecipeDetail.tsx';
import { Shopping } from './src/screens/Shopping.tsx';
import { hydrate, useStore } from './src/store.ts';
import { C, Header, s } from './src/ui.tsx';

type Tab = 'dishes' | 'list' | 'history';

export default function App() {
  const [ready, setReady] = useState(false);
  useEffect(() => { hydrate().then(() => setReady(true)); }, []);
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <SafeAreaView style={{ flex: 1, backgroundColor: C.paper }} edges={['top', 'left', 'right']}>
        {ready && <Main />}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

function Main() {
  const { week } = useStore();
  const [tab, setTab] = useState<Tab>('dishes');
  const [segment, setSegment] = useState<Segment>('dishes');
  const [detail, setDetail] = useState<string | null>(null);
  const [shopping, setShopping] = useState(false);

  const lines = useMemo(() => merge(week.map((id) => BY_ID.get(id)).filter((r) => r !== undefined), INDEX), [week]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (shopping) return setShopping(false), true;
      if (detail) return setDetail(null), true;
      return false;
    });
    return () => sub.remove();
  }, [shopping, detail]);

  if (shopping) return <SafeBottom><Shopping lines={lines} onClose={() => setShopping(false)} /></SafeBottom>;
  if (detail) return <SafeBottom><RecipeDetail id={detail} onBack={() => setDetail(null)} /></SafeBottom>;

  return (
    <View style={{ flex: 1 }}>
      <View style={{ flex: 1 }}>
        {tab === 'dishes' && (
          <Browse onOpen={setDetail} toBuy={lines.length} onSeeList={() => { setSegment('market'); setTab('list'); }} />
        )}
        {tab === 'list' && (
          <ListTab lines={lines} segment={segment} setSegment={setSegment} onBrowse={() => setTab('dishes')}
            onOpen={setDetail} onShop={() => setShopping(true)} />
        )}
        {tab === 'history' && (
          <View style={s.screen}>
            <Header title="History" />
            <View style={s.empty}><Text style={s.emptyText}>Finished trips will be kept here so you can repeat one.</Text></View>
          </View>
        )}
      </View>
      <SafeAreaView edges={['bottom']} style={{ flexDirection: 'row', borderTopWidth: 1, borderTopColor: C.line, backgroundColor: C.card, paddingTop: 7, paddingBottom: 9 }}>
        <TabButton icon="restaurant" label="Dishes" on={tab === 'dishes'} onPress={() => setTab('dishes')} />
        <TabButton icon="list" label="List" on={tab === 'list'} onPress={() => setTab('list')} badge={lines.length || undefined} />
        <TabButton icon="time" label="History" on={tab === 'history'} onPress={() => setTab('history')} />
      </SafeAreaView>
    </View>
  );
}

function SafeBottom({ children }: { children: React.ReactNode }) {
  return <SafeAreaView edges={['bottom']} style={{ flex: 1, backgroundColor: C.paper }}>{children}</SafeAreaView>;
}

function TabButton({ icon, label, on, onPress, badge }: {
  icon: 'restaurant' | 'list' | 'time'; label: string; on: boolean; onPress: () => void; badge?: number;
}) {
  const color = on ? C.dahon : C.ink2;
  return (
    <Pressable onPress={onPress} style={{ flex: 1, alignItems: 'center', gap: 3 }}
      accessibilityRole="tab" accessibilityState={{ selected: on }} accessibilityLabel={badge ? `${label}, ${badge} to buy` : label}>
      <Ionicons name={on ? icon : `${icon}-outline`} size={24} color={color} />
      <Text style={{ fontSize: 11, fontWeight: '700', color }}>{label}</Text>
      {badge != null && (
        <View style={{ position: 'absolute', top: -3, left: '50%', marginLeft: 5, height: 17, minWidth: 17, paddingHorizontal: 5, borderRadius: 999, backgroundColor: C.achuete, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ color: '#fff', fontSize: 10, fontWeight: '800' }}>{badge}</Text>
        </View>
      )}
    </Pressable>
  );
}
