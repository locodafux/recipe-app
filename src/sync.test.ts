/// <reference types="node" />
// The shared-list rules, with no network: flush order, the OR merge and D5 undo ending on sync.
// Run: npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';
import type { Line } from './merge.ts';
import { applyRemote, firstName, flush, linesToRows, rowsToLines, type Row, type Ticks } from './sync.ts';

const ME = 'user-leo';
const ANA = 'user-ana';
const row = (item: string, checked: boolean, by?: string): Row => ({
  id: item, list_id: 'L', item, label: item, qty: 1, unit: null, aisle: 'gulay', dishes: ['Pinakbet'], position: 0,
  checked, checked_by: checked ? by : null, checked_at: checked ? '2026-09-22T06:12:00Z' : null,
});

test('flush sends oldest first and stops at the first failure', async () => {
  const sent: string[] = [];
  const down = new Set(['tomatoes']);
  const ok = await flush([{ key: 'garlic' }, { key: 'tomatoes' }, { key: 'onions' }], async (key) => {
    sent.push(key);
    if (down.has(key)) throw new Error('no signal');
  });
  assert.deepEqual(sent, ['garlic', 'tomatoes']); // onions never jumps the queue
  assert.deepEqual(ok, ['garlic']); // only what reached the server gets markSynced
  assert.deepEqual(await flush([{ key: 'tomatoes' }, { key: 'onions' }], async () => {}), ['tomatoes', 'onions']);
});

test("a partner's tick is ORed in and credited to them", () => {
  const t = applyRemote({}, [row('kangkong', true, ANA), row('taro', false)], ME);
  assert.deepEqual(Object.keys(t), ['kangkong']);
  assert.equal(t.kangkong.by, ANA);
  assert.equal(t.kangkong.synced, true);
  assert.equal(t.kangkong.at, Date.parse('2026-09-22T06:12:00Z'));
  assert.equal(applyRemote({}, [row('garlic', true, ME)], ME).garlic.by, undefined); // my own tick, echoed back
});

test('an unchecked row never un-ticks anything', () => {
  const ticks: Ticks = { garlic: { at: 1, synced: false }, onions: { at: 2, synced: true } };
  assert.equal(applyRemote(ticks, [row('garlic', false), row('onions', false)], ME), ticks);
});

test('undo ends once the item is ticked on the server (D5)', () => {
  // My tick is still queued, but Ana's tick of the same item arrived first: it is shared now.
  const t = applyRemote({ garlic: { at: 5, synced: false } }, [row('garlic', true, ANA)], ME);
  assert.deepEqual(t.garlic, { at: 5, synced: true });
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
