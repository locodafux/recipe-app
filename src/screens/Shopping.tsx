// Screen 5: Shopping, a full-screen mode. Local-first ticks (README 4), shared with the partner when a list is.
// D3: a partner's tick washes the row, then keeps an ube band and avatar; off-screen ones raise a pill.
// D4: bought items stay in place, struck through. D5 (revised): tap a ticked item to uncheck it.
import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { byAisle, type Line } from '../merge.ts';
import { flushArchives, useOnline, useSession } from '../remote.ts';
import { finishShopping, toggleTick, useStore } from '../store.ts';
import { firstName } from '../sync.ts';
import { Button, C, Cta, Header, Section, Sheet, s } from '../ui.tsx';
import { Avatar, LineRow } from './LineRow.tsx';

export function Shopping({ lines, onClose, onInvite }: { lines: Line[]; onClose: () => void; onInvite?: () => void }) {
  const { ticks, shared } = useStore();
  const online = useOnline();
  const session = useSession();
  const partner = firstName(shared?.partner?.email);
  const bought = lines.filter((l) => ticks[l.key]).length;
  const theirs = lines.filter((l) => ticks[l.key]?.by).length;
  const queued = lines.filter((l) => ticks[l.key]?.synced === false).length;
  const pct = lines.length ? bought / lines.length : 0;

  // D3: partner ticks that arrived while this screen is open. `fresh` washes for 1.2 s; `unseen` feeds the pill.
  const seen = useRef(new Set(Object.keys(ticks).filter((k) => ticks[k].by)));
  const [fresh, setFresh] = useState<Set<string>>(new Set());
  const [unseen, setUnseen] = useState<string[]>([]);
  const ys = useRef(new Map<string, number>());
  const groupY = useRef(new Map<string, number>());
  const view = useRef({ y: 0, h: 0 });
  const scroller = useRef<ScrollView>(null);

  const visible = (k: string) => {
    const y = ys.current.get(k);
    return y == null || (y + 40 > view.current.y && y + 20 < view.current.y + view.current.h);
  };
  useEffect(() => {
    const arrived = Object.keys(ticks).filter((k) => ticks[k].by && !seen.current.has(k));
    if (!arrived.length) return;
    arrived.forEach((k) => seen.current.add(k));
    setFresh((f) => new Set([...f, ...arrived]));
    setUnseen((u) => [...u, ...arrived.filter((k) => !visible(k))]);
    setTimeout(() => setFresh((f) => new Set([...f].filter((k) => !arrived.includes(k)))), 1200);
  }, [ticks]);
  const onScroll = (y: number) => {
    view.current.y = y;
    setUnseen((u) => (u.some(visible) ? u.filter((k) => !visible(k)) : u));
  };
  const below = unseen.filter((k) => (ys.current.get(k) ?? 0) > view.current.y).length;

  const [finishing, setFinishing] = useState(false);
  const finish = () => { setFinishing(false); finishShopping(lines); flushArchives(); onClose(); };

  return (
    <View style={s.screen}>
      <Header onBack={onClose} title="Shopping" sub={`${bought} of ${lines.length} bought`}
        right={onInvite && (
          <Pressable onPress={onInvite} accessibilityRole="button" accessibilityLabel={shared?.partner ? `Shared with ${partner}` : 'Invite someone'}
            style={{ flexDirection: 'row', gap: 4, marginTop: 6, alignItems: 'center' }}>
            <Avatar name={session?.user.email ?? 'You'} me />
            {shared?.partner ? <Avatar name={partner} /> : <Ionicons name="person-add-outline" size={20} color={C.ink} />}
          </Pressable>
        )} />
      {shared && !online && (
        <View style={{ marginHorizontal: 16, marginBottom: 12, padding: 12, borderRadius: 13, backgroundColor: C.tansoSoft, flexDirection: 'row', gap: 10 }}
          accessibilityRole="alert">
          <Ionicons name="cloud-offline-outline" size={20} color={C.tanso} />
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 15, fontWeight: '800', color: C.tanso }}>No signal — keep going</Text>
            <Text style={{ fontSize: 13, lineHeight: 18, color: C.ink, marginTop: 2 }}>
              {queued > 0 ? `Your ${queued} tick${queued === 1 ? ' is' : 's are'} saved on this phone. ` : 'Your ticks are saved on this phone. '}
              {shared.partner ? `They will reach ${partner} when the signal comes back.` : 'They will be shared when the signal comes back.'}
            </Text>
          </View>
        </View>
      )}
      <View style={{ marginHorizontal: 16, marginBottom: 12 }}>
        <View style={{ height: 9, borderRadius: 999, backgroundColor: 'rgba(31,26,19,0.1)', overflow: 'hidden', flexDirection: 'row' }}>
          <View style={{ height: '100%', width: `${(pct - (lines.length ? theirs / lines.length : 0)) * 100}%`, backgroundColor: C.dahon }} />
          <View style={{ height: '100%', width: `${(lines.length ? theirs / lines.length : 0) * 100}%`, backgroundColor: C.ube }} />
        </View>
        <View style={{ flexDirection: 'row', gap: 12, marginTop: 7, flexWrap: 'wrap' }}>
          <Legend color={C.dahon} text={`You · ${bought - theirs}`} />
          {theirs > 0 && <Legend color={C.ube} text={`${partner} · ${theirs}`} />}
          {queued > 0 && <Legend color={C.tanso} text={`${queued} queued`} />}
          <Legend color="rgba(31,26,19,0.2)" text={`Left · ${lines.length - bought}`} />
        </View>
      </View>
      <View style={{ flex: 1 }}>
        <ScrollView ref={scroller} scrollEventThrottle={100}
          onLayout={(e) => { view.current.h = e.nativeEvent.layout.height; }}
          onScroll={(e) => onScroll(e.nativeEvent.contentOffset.y)}>
          {byAisle(lines).map((g) => (
            <View key={String(g.aisle)} onLayout={(e) => groupY.current.set(String(g.aisle), e.nativeEvent.layout.y)}>
              <Section aisle={g.aisle} count={`${g.items.filter((l) => ticks[l.key]).length}/${g.items.length}`} />
              {g.items.map((l) => {
                const t = ticks[l.key];
                return (
                  <LineRow key={l.key} line={l} big checked={!!t} queued={t?.synced === false}
                    by={t?.by ? partner : undefined} fresh={fresh.has(l.key)}
                    onLayout={(e) => ys.current.set(l.key, (groupY.current.get(String(g.aisle)) ?? 0) + e.nativeEvent.layout.y)}
                    onPress={() => toggleTick(l.key)}
                    a11yHint={t ? 'Marks it not bought' : 'Marks it bought'} />
                );
              })}
            </View>
          ))}
          <Text style={[s.hint, { padding: 16 }]}>Ticked by mistake? Tap it again to mark it not bought.</Text>
        </ScrollView>
        {unseen.length > 0 && (
          <Pressable onPress={() => scroller.current?.scrollTo({ y: Math.max(0, (ys.current.get(unseen[0]) ?? 0) - 60) })}
            accessibilityRole="button" accessibilityLiveRegion="polite"
            style={{ position: 'absolute', bottom: 12, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 6,
              paddingHorizontal: 14, height: 36, borderRadius: 999, backgroundColor: C.ube, boxShadow: '0 3px 10px rgba(0,0,0,0.2)' }}>
            <Ionicons name={below ? 'arrow-down' : 'arrow-up'} size={16} color="#fff" />
            <Text style={{ color: '#fff', fontSize: 14, fontWeight: '700' }}>
              {partner} ticked {unseen.length} more {below ? 'below' : 'above'}
            </Text>
          </Pressable>
        )}
      </View>
      <Cta><Button small kind="secondary" title="Finish shopping" onPress={() => setFinishing(true)} /></Cta>
      <Sheet visible={finishing} onClose={() => setFinishing(false)}>
        <Text style={[s.h1, s.h1small]} accessibilityRole="header">Finish shopping?</Text>
        <Text style={s.emptyText}>
          {`${bought} of ${lines.length} bought. The trip moves to History${shared?.partner ? ' for both of you' : ''} and this list can no longer change.`}
        </Text>
        <Button title="Finish" onPress={finish} />
        <Button kind="secondary" title="Keep shopping" onPress={() => setFinishing(false)} />
      </Sheet>
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
