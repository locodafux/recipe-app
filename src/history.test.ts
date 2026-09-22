/// <reference types="node" />
// M5 with no network: what a finished trip keeps, how phones' histories merge, and what Repeat picks.
// Run: npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { dishSummary, mergeHistory, repeatIds, tripDate, tripDishes, tripFromLines, tripFromRows, type Trip } from './history.ts';
import type { Line } from './merge.ts';
import { linesToRows } from './sync.ts';

const line = (key: string, ...dishes: string[]): Line => ({
  key, label: key, aisle: 'gulay', parts: [{ qty: 1, unit: null }], from: dishes.map((dish) => ({ dish, item: key, qty: 1, unit: null })),
});
const LINES = [line('bawang', 'Adobong Manok', 'Pinakbet'), line('kangkong', 'Sinigang na Baboy'), line('ampalaya', 'Pinakbet')];
const trip = (id: string, at: string): Trip => ({ id, at, lines: [], bought: [] });

test('a trip keeps every line and only the ticked ones as bought', () => {
  const t = tripFromLines('local-1', new Date('2026-09-19T02:42:00Z'), LINES, ['kangkong', 'tomatoes']);
  assert.equal(t.at, '2026-09-19T02:42:00.000Z');
  assert.equal(t.lines.length, 3); // not everything was bought, and it is still a finished trip
  assert.deepEqual(t.bought, ['kangkong']); // a tick for a line not on the list is ignored
});

test("the server's archived rows give the same trip, with both phones' ticks", () => {
  const rows = linesToRows(LINES, 'L').map((r) => ({ ...r, checked: r.item !== 'ampalaya' }));
  const t = tripFromRows('L', '2026-09-19T02:42:00Z', rows);
  assert.deepEqual(t.lines.map((l) => l.key), ['bawang', 'kangkong', 'ampalaya']);
  assert.deepEqual(t.bought, ['bawang', 'kangkong']);
  assert.deepEqual(tripDishes(t), ['Adobong Manok', 'Pinakbet', 'Sinigang na Baboy']);
});

test('history is newest first and the server copy of a shared trip wins', () => {
  const mine = { ...trip('L', '2026-09-19T02:42:00Z'), bought: ['bawang'] };
  const server = { ...trip('L', '2026-09-19T02:43:00Z'), bought: ['bawang', 'kangkong'] };
  const h = mergeHistory([trip('local-1', '2026-09-12T03:00:00Z'), mine], [server, trip('M', '2026-08-29T03:00:00Z')]);
  assert.deepEqual(h.map((t) => t.id), ['L', 'local-1', 'M']);
  assert.deepEqual(h[0].bought, ['bawang', 'kangkong']);
  assert.deepEqual(mergeHistory(h, []), h); // offline refresh keeps what the phone has
});

test('Repeat starts from the dishes by name and skips ones no longer in the catalogue', () => {
  const t = tripFromLines('L', new Date(), LINES, []);
  const ids = new Map([['Adobong Manok', 'adobong-manok'], ['Sinigang na Baboy', 'sinigang-baboy']]);
  assert.deepEqual(repeatIds(t, ids), ['adobong-manok', 'sinigang-baboy']);
});

test('cards read "Saturday, 19 Sep" and the first two dishes', () => {
  assert.equal(tripDate(new Date(2026, 8, 19, 10, 42).toISOString()), 'Saturday, 19 Sep');
  assert.equal(dishSummary(['Sinigang na Baboy', 'Adobong Manok', 'Pinakbet', 'Leche Flan']), 'Sinigang na Baboy, Adobong Manok, +2');
  assert.equal(dishSummary(['Bulalo']), 'Bulalo');
});
