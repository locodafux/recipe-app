/// <reference types="node" />
// The shared-list rules, with no network: the pending queue, flush order, the merge and D5 unchecking.
// Run: npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Line } from './merge.ts';
import { applyRemote, firstName, flush, linesToRows, markSent, pending, rowsToLines, toggle, type Pending, type Row, type Ticks, type Unticks } from './sync.ts';

const ME = 'user-leo';
const ANA = 'user-ana';
const row = (item: string, checked: boolean, by?: string): Row => ({
  id: item, list_id: 'L', item, label: item, qty: 1, unit: null, aisle: 'gulay', dishes: ['Pinakbet'], position: 0,
  checked, checked_by: checked ? by : null, checked_at: checked ? '2026-09-22T06:12:00Z' : null,
});

const q = (...keys: string[]): Pending[] => keys.map((key, at) => ({ key, at, checked: true }));

test('flush sends oldest first and stops at the first failure', async () => {
  const sent: string[] = [];
  const down = new Set(['tomatoes']);
  const ok = await flush(q('garlic', 'tomatoes', 'onions'), async (p) => {
    sent.push(p.key);
    if (down.has(p.key)) throw new Error('no signal');
  });
  assert.deepEqual(sent, ['garlic', 'tomatoes']); // onions never jumps the queue
  assert.deepEqual(ok.map((p) => p.key), ['garlic']); // only what reached the server gets markSynced
  assert.deepEqual((await flush(q('tomatoes', 'onions'), async () => {})).map((p) => p.key), ['tomatoes', 'onions']);
});

/**
 * Two phones against a stand-in for the server: `list_items` plus what guard_list_item and remote.ts's
 * update do (a tick keeps the first ticker; an uncheck only matches the tick it was tapped on).
 */
function world() {
  const server = new Map<string, Row>();
  const phone = (me: string) => {
    let s: { ticks: Ticks; unticks: Unticks } = { ticks: {}, unticks: {} };
    return {
      get ticks() { return s.ticks; },
      tap(key: string, at: number) { s = toggle(s, key, at); },
      async sync() {
        s = { ...s, ticks: applyRemote(s.ticks, [...server.values()], me, s.unticks) };
        const sent = await flush(pending(s.ticks, s.unticks), async (p) => {
          const r = server.get(p.key) ?? row(p.key, false);
          if (p.checked && !r.checked) server.set(p.key, { ...r, checked: true, checked_by: me, checked_at: new Date(p.at).toISOString() });
          if (!p.checked && r.checked && r.checked_by === (p.by ?? me)) server.set(p.key, row(p.key, false));
        });
        s = markSent(s, sent);
      },
      realtime(key: string) { s = { ...s, ticks: applyRemote(s.ticks, [server.get(key)!], me, s.unticks) }; },
    };
  };
  return { server, leo: phone(ME), ana: phone(ANA) };
}

test('an uncheck reaches the server and the other phone like a tick does (D5 revised)', async () => {
  const { server, leo, ana } = world();
  leo.tap('garlic', 1);
  await leo.sync();
  ana.realtime('garlic');
  assert.equal(ana.ticks.garlic.by, ME);
  leo.tap('garlic', 2); // a misclick, taken back after it was sent
  assert.ok(!('garlic' in leo.ticks)); // at once, before any network
  await leo.sync();
  assert.equal(server.get('garlic')!.checked, false);
  ana.realtime('garlic');
  assert.ok(!('garlic' in ana.ticks));
  ana.tap('garlic', 3); // Ana buys it after all: Leo's phone shows it ticked by her
  await ana.sync();
  leo.realtime('garlic');
  assert.equal(leo.ticks.garlic.by, ANA);
});

test('offline, the queue keeps the order of taps: tick-then-uncheck lands unchecked, uncheck-then-tick checked', async () => {
  const { server, leo } = world();
  leo.tap('onions', 1);
  await leo.sync(); // onions bought and sent
  leo.tap('garlic', 2); // offline from here: tick garlic, then take it back
  leo.tap('garlic', 3);
  leo.tap('onions', 4); // uncheck onions, then tick it again
  leo.tap('onions', 5);
  leo.tap('tomatoes', 6);
  await leo.sync(); // signal back
  assert.deepEqual([...server.values()].filter((r) => r.checked).map((r) => r.item).sort(), ['onions', 'tomatoes']);
  assert.deepEqual(Object.keys(leo.ticks).sort(), ['onions', 'tomatoes']);
  assert.deepEqual(pending(leo.ticks, {}), []);
});

test('a catch-up row does not bring back a tick whose uncheck is still queued', () => {
  const s = toggle({ ticks: { garlic: { at: 1, synced: true } }, unticks: {} }, 'garlic', 2);
  assert.deepEqual(pending(s.ticks, s.unticks), [{ key: 'garlic', at: 2, checked: false, by: undefined }]);
  assert.deepEqual(applyRemote(s.ticks, [row('garlic', true, ME)], ME, s.unticks), {});
  assert.equal(applyRemote(s.ticks, [row('garlic', true, ME)], ME).garlic.synced, true); // once sent, the server decides
});

test('an offline phone cannot un-buy what the partner bought meanwhile (README 4)', async () => {
  const { server, leo, ana } = world();
  leo.tap('garlic', 1);
  await leo.sync(); // Leo ticks, sent
  ana.realtime('garlic');
  ana.tap('garlic', 2); // Ana unchecks it...
  await ana.sync();
  ana.tap('garlic', 3); // ...then buys it herself
  await ana.sync();
  leo.tap('garlic', 4); // Leo, offline all along, unchecks his old tick
  await leo.sync(); // it matches no row: Ana's purchase stands and comes back on Leo's phone
  assert.equal(server.get('garlic')!.checked_by, ANA);
  await leo.sync();
  assert.equal(leo.ticks.garlic.by, ANA);
});

test("a partner's tick is ORed in and credited to them", () => {
  const t = applyRemote({}, [row('kangkong', true, ANA), row('taro', false)], ME);
  assert.deepEqual(Object.keys(t), ['kangkong']);
  assert.equal(t.kangkong.by, ANA);
  assert.equal(t.kangkong.synced, true);
  assert.equal(t.kangkong.at, Date.parse('2026-09-22T06:12:00Z'));
  assert.equal(applyRemote({}, [row('garlic', true, ME)], ME).garlic.by, undefined); // my own tick, echoed back
});

test('an unchecked row clears a sent tick but never a queued one', () => {
  const ticks: Ticks = { garlic: { at: 1, synced: false }, onions: { at: 2, synced: true } };
  assert.deepEqual(applyRemote(ticks, [row('garlic', false), row('onions', false)], ME), { garlic: ticks.garlic });
});

test('a queued tick of an item the partner already bought is theirs, sent', () => {
  const t = applyRemote({ garlic: { at: 5, synced: false } }, [row('garlic', true, ANA)], ME);
  assert.deepEqual(t.garlic, { at: 5, synced: true, by: ANA });
});

test('a tap made while its item was being sent stays queued', () => {
  const s = toggle({ ticks: { garlic: { at: 1, synced: false } }, unticks: {} }, 'garlic', 2); // unchecked mid-flight
  const after = markSent(s, [{ key: 'garlic', at: 1, checked: true }]);
  assert.deepEqual(pending(after.ticks, after.unticks).map((p) => [p.key, p.checked]), [['garlic', false]]);
});

test('rows round-trip to the same lines, in order, with units kept apart', () => {
  const lines: Line[] = [
    { key: 'liempo', label: 'pork belly', aisle: 'karne', parts: [{ qty: 1, unit: 'kg' }, { qty: 350, unit: 'g' }],
      from: [{ dish: 'Sinigang na Baboy', item: 'liempo', qty: 1, unit: 'kg' }, { dish: 'Pinakbet', item: 'liempo', qty: 350, unit: 'g' }] },
    { key: 'bawang', label: 'garlic', aisle: 'gulay', parts: [{ qty: 17, unit: 'clove' }],
      from: [{ dish: 'Adobong Manok', item: 'bawang', qty: 8, unit: 'clove' }] },
  ];
  const rows = linesToRows(lines, 'L', 10);
  assert.deepEqual(rows.map((r) => [r.item, r.position]), [['liempo', 10], ['liempo', 11], ['bawang', 12]]);
  const back = rowsToLines([...rows].reverse());
  assert.deepEqual(back.map((l) => [l.key, l.label, l.parts]), lines.map((l) => [l.key, l.label, l.parts]));
  assert.deepEqual(back[0].from.map((f) => f.dish), ['Sinigang na Baboy', 'Pinakbet']);
});

test('names come from the email', () => {
  assert.equal(firstName('ana@gmail.com'), 'Ana');
  assert.equal(firstName('leo.timkang@gmail.com'), 'Leo');
  assert.equal(firstName(undefined), 'Your partner');
});
