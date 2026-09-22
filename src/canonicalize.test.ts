/// <reference types="node" />
// Mirrors tools/test_canonicalize.py so the TS port collapses exactly what the
// Python does. Run: npm test
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { test } from 'node:test';
import { buildIndex, normalize, resolve, type Synonyms } from './canonicalize.ts';
import { byAisle, formatParts, merge, type Recipe } from './merge.ts';

const SYNONYMS: Synonyms = JSON.parse(readFileSync(new URL('../data/synonyms.json', import.meta.url), 'utf8'));
const INDEX = buildIndex(SYNONYMS);
const r = (s: string | null) => resolve(s, INDEX);

test('the README example collapses to one name', () => {
  const spellings = ['sampalok', 'tamarind', 'sampaloc', 'tamarind mix', 'sampalok mix',
    'Sampalok Mix', '  TAMARIND  ', 'young tamarind', 'sinigang mix'];
  assert.deepEqual(new Set(spellings.map(r)), new Set(['sampalok']));
});

test('every shipped variant resolves to its canonical', () => {
  const bad = Object.entries(SYNONYMS).flatMap(([canonical, variants]) =>
    [canonical, ...variants].filter((v) => r(v) !== canonical).map((v) => [v, canonical, r(v)]));
  assert.deepEqual(bad, []);
});

test('longest variant wins', () => {
  const phrases = INDEX.map(([p]) => p);
  assert.deepEqual(phrases, [...phrases].sort((a, b) => b.length - a.length));
  assert.equal(r('coconut cream'), 'kakang gata');
  assert.equal(r('coconut milk'), 'gata');
});

test('resolves inside a longer line', () => {
  assert.equal(r('pork belly'), 'liempo');
  assert.equal(r('skinless chicken thighs'), 'hita ng manok');
  assert.equal(r('fresh malunggay leaves'), 'malunggay');
});

test('matches whole words only', () => {
  assert.notEqual(r('gingerbread'), 'luya');
  assert.notEqual(r('saltine crackers'), 'asin');
});

test('unknown ingredient is null', () => {
  assert.equal(r('unicorn tears'), null);
  assert.equal(r(''), null);
  assert.equal(r(null), null);
});

test('normalize is case and punctuation insensitive', () => {
  assert.equal(normalize('  Soy   Sauce!  '), 'soy sauce');
  assert.equal(r('Soy Sauce'), 'toyo');
  assert.equal(normalize('Nestlé'), 'nestlé');
});

const recipe = (name: string, ingredients: [string, number | null, string | null][]): Recipe => ({
  id: name, name, alt: [], category: 'sabaw', servings: 4, source: '',
  ingredients: ingredients.map(([item, qty, unit]) => ({ item, qty, unit, aisle: 'gulay' })),
});

test('same unit adds, different units are shown both ways (README 6)', () => {
  const lines = merge([
    recipe('A', [['tamarind', 1, 'pack'], ['garlic', 3, 'clove'], ['pork belly', 1, 'kg']]),
    recipe('B', [['sampalok mix', 1, 'pack'], ['cloves garlic', 5, 'clove'], ['liempo', 350, 'g']]),
  ], INDEX);
  const got = Object.fromEntries(lines.map((l) => [l.key, formatParts(l.parts)]));
  assert.deepEqual(got, { sampalok: '2 packs', bawang: '8 cloves', liempo: '1 kg + 350 g' });
  assert.equal(lines.find((l) => l.key === 'bawang')!.from.length, 2);
  assert.equal(formatParts([{ qty: 0.25, unit: 'cup' }, { qty: 3, unit: 'piece' }, { qty: null, unit: null }]), '¼ cup + 3 pcs');
  assert.equal(formatParts([{ qty: 1.5, unit: 'cup' }, { qty: 0.3, unit: 'kg' }]), '1½ cups + 0.3 kg');
});

test('aisles group dry before wet (D2)', () => {
  const groups = byAisle([{ aisle: 'karne' }, { aisle: 'isda' }, { aisle: null }, { aisle: 'dry goods' }, { aisle: 'gulay' }] as const);
  assert.deepEqual(groups.map((g) => g.aisle), ['gulay', 'dry goods', 'isda', 'karne', null]);
});
