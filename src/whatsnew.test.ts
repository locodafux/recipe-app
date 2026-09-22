/// <reference types="node" />
// Show-once rules for What's new. Run: npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { CHANGELOG, type Entry } from './changelog.ts';
import { unseen } from './whatsnew.ts';

const e = (id: string): Entry => ({ id, title: id, items: [] });
const LOG = [e('c'), e('b'), e('a')]; // newest first

test('shows the new build once, then never again', () => {
  assert.deepEqual(unseen(LOG, 'b').map((x) => x.id), ['c']);
  assert.deepEqual(unseen(LOG, 'c'), []); // after dismissing, seen = newest id
});

test('a fresh install, seeded with the newest id, shows nothing', () => {
  assert.deepEqual(unseen(LOG, LOG[0].id), []);
});

test('skipped builds are all shown, newest first', () => {
  assert.deepEqual(unseen(LOG, 'a').map((x) => x.id), ['c', 'b']);
});

test('an update from before What\'s new, or an unknown id, shows only the newest', () => {
  assert.deepEqual(unseen(LOG, undefined).map((x) => x.id), ['c']);
  assert.deepEqual(unseen(LOG, 'gone').map((x) => x.id), ['c']);
});

test('the bundled changelog has unique ids and something to say', () => {
  assert.ok(CHANGELOG.length > 0);
  assert.equal(new Set(CHANGELOG.map((x) => x.id)).size, CHANGELOG.length);
  for (const x of CHANGELOG) assert.ok(x.title && x.items.length, x.id);
});
