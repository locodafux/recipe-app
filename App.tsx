// Three tabs (Dishes · List · History); Recipe detail, a past trip, Feedback and Shopping open over them, with no tab bar.
// ponytail: state-based navigation, no router. The one deep link (a magic link, maybe carrying an invite)
// is read with expo-linking; move to expo-router if the app grows real routes.
import { Ionicons } from '@expo/vector-icons';
import * as Linking from 'expo-linking';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useMemo, useState } from 'react';
import { Alert, BackHandler, Platform, Pressable, Text, View } from 'react-native';
import { SafeAreaProvider, SafeAreaView } from 'react-native-safe-area-context';
import { CHANGELOG } from './src/changelog.ts';
import { BY_ID, INDEX } from './src/data.ts';
import { merge } from './src/merge.ts';
import { ensureList, flushArchives, flushFeedback, openLink, useSync, type InvitePreview } from './src/remote.ts';
import { Browse } from './src/screens/Browse.tsx';
import { Feedback } from './src/screens/Feedback.tsx';
import { History, TripDetail } from './src/screens/History.tsx';
import { Invite } from './src/screens/Invite.tsx';
import { Join } from './src/screens/Join.tsx';
import { ListTab, type Segment } from './src/screens/ListTab.tsx';
import { RecipeDetail } from './src/screens/RecipeDetail.tsx';
import { Shopping } from './src/screens/Shopping.tsx';
import { WhatsNew } from './src/screens/WhatsNew.tsx';
import { hydrate, markSeen, useStore } from './src/store.ts';
import { rowsToLines } from './src/sync.ts';
import { unseen } from './src/whatsnew.ts';
import { C } from './src/ui.tsx';

type Tab = 'dishes' | 'list' | 'history';

export default function App() {
  const [ready, setReady] = useState(false);
  useEffect(() => { hydrate().then(() => setReady(true)); }, []);
  return (
    <SafeAreaProvider>
      <StatusBar style="dark" />
      <SafeAreaView style={{ flex: 1, backgroundColor: C.paper }} edges={['top', 'left', 'right']}>
        {ready && <Main />}
        {ready && <News />}
      </SafeAreaView>
    </SafeAreaProvider>
  );
}

function Main() {
  const { week, shared } = useStore();
  const [tab, setTab] = useState<Tab>('dishes');
  const [segment, setSegment] = useState<Segment>('dishes');
  const [detail, setDetail] = useState<string | null>(null);
  const [shopping, setShopping] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [join, setJoin] = useState<InvitePreview | null>(null);
  const [trip, setTrip] = useState<string | null>(null);
  const [feedback, setFeedback] = useState(false);

  const lines = useMemo(() => merge(week.map((id) => BY_ID.get(id)).filter((r) => r !== undefined), INDEX), [week]);
  // While a list is shared, both phones shop from its rows, so they see the same items.
  const shopLines = useMemo(() => (shared?.rows.length ? rowsToLines(shared.rows) : lines), [shared?.rows, lines]);
  useSync(shared?.id);
  useEffect(() => { flushArchives(); flushFeedback(); }, []); // a trip finished or feedback written offline last time

  const url = Linking.useURL();
  useEffect(() => {
    if (!url) return;
    openLink(url).then((r) => {
      if (r?.error) return Platform.OS === 'web' ? window.alert(r.error) : Alert.alert('That link did not work', r.error);
      if (r?.invite) setJoin(r.invite);
    });
  }, [url]);
  const shop = () => { ensureList(lines); setShopping(true); };

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (join) return setJoin(null), true;
      if (inviting) return setInviting(false), true;
      if (shopping) return setShopping(false), true;
      if (detail) return setDetail(null), true;
      if (trip) return setTrip(null), true;
      if (feedback) return setFeedback(false), true;
      return false;
    });
    return () => sub.remove();
  }, [shopping, detail, inviting, join, trip, feedback]);
  const repeated = () => { setTrip(null); setSegment('dishes'); setTab('list'); };

  if (join) return <SafeBottom><Join invite={join} onBack={() => setJoin(null)} onJoined={() => { setJoin(null); setShopping(true); }} /></SafeBottom>;
  if (inviting) return <SafeBottom><Invite lines={shopLines} onBack={() => setInviting(false)} /></SafeBottom>;
  if (shopping) return <SafeBottom><Shopping lines={shopLines} onClose={() => setShopping(false)} onInvite={() => setInviting(true)} /></SafeBottom>;
  if (detail) return <SafeBottom><RecipeDetail id={detail} onBack={() => setDetail(null)} /></SafeBottom>;
  if (trip) return <SafeBottom><TripDetail id={trip} onBack={() => setTrip(null)} onRepeated={repeated} /></SafeBottom>;
  if (feedback) return <SafeBottom><Feedback onBack={() => setFeedback(false)} /></SafeBottom>;

  return (
    <View style={{ flex: 1 }}>
      <View style={{ flex: 1 }}>
        {tab === 'dishes' && (
          <Browse onOpen={setDetail} toBuy={lines.length} onSeeList={() => { setSegment('market'); setTab('list'); }} />
        )}
        {tab === 'list' && (
          <ListTab lines={lines} segment={segment} setSegment={setSegment} onBrowse={() => setTab('dishes')}
            onOpen={setDetail} onShop={shop} onShared={() => setShopping(true)} />
        )}
        {tab === 'history' && <History onOpen={setTrip} onRepeated={repeated} onFeedback={() => setFeedback(true)} />}
      </View>
      <SafeAreaView edges={['bottom']} style={{ flexDirection: 'row', borderTopWidth: 1, borderTopColor: C.line, backgroundColor: C.card, paddingTop: 7, paddingBottom: 9 }}>
        <TabButton icon="restaurant" label="Dishes" on={tab === 'dishes'} onPress={() => setTab('dishes')} />
        <TabButton icon="list" label="List" on={tab === 'list'} onPress={() => setTab('list')} badge={lines.length || undefined} />
        <TabButton icon="time" label="History" on={tab === 'history'} onPress={() => setTab('history')} />
      </SafeAreaView>
    </View>
  );
}

/** What's new, once per build: dismissing records the newest entry as seen. */
function News() {
  const { seen } = useStore();
  const entries = unseen(CHANGELOG, seen);
  return entries.length > 0 && <WhatsNew entries={entries} onClose={() => markSeen(CHANGELOG[0].id)} />;
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
