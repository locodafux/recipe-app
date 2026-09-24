/// <reference types="node" />
// "Is there a newer APK" rules, ported from taiwan-expenses' appUpdate tests. Run: npm test
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { newerApk, type GithubAsset } from './update.ts';

const UPLOADED_AT = '2026-09-18T04:19:47Z';
const apk = (name: string, updated_at = UPLOADED_AT): GithubAsset =>
  ({ name, browser_download_url: `https://example.com/${name}`, updated_at });
const ASSETS = [apk('notes.txt'), apk('palengke-list.apk'), apk('old-build.apk', '2026-09-14T00:35:23Z')];

// taiwan-expenses regression (2026-09-19): installing the exact published APK, or updating through the
// banner, still showed "A new version is available" when "current" was something the app stored itself.
test('reports nothing when the app was installed after the apk was uploaded', () => {
  assert.equal(newerApk(ASSETS, new Date('2026-09-19T05:13:43Z')), null);
  assert.equal(newerApk(ASSETS, new Date(UPLOADED_AT)), null);
});

test('reports palengke-list.apk when it was uploaded after the app was installed', () => {
  assert.deepEqual(newerApk(ASSETS, new Date('2026-09-17T00:00:00Z')), {
    downloadUrl: 'https://example.com/palengke-list.apk', assetName: 'palengke-list.apk',
  });
});

test('falls back to any .apk, and needs one', () => {
  assert.equal(newerApk([apk('notes.txt'), apk('app-release.apk')], new Date(0))?.assetName, 'app-release.apk');
  assert.equal(newerApk([apk('notes.txt')], new Date(0)), null);
  assert.equal(newerApk([], new Date(0)), null);
});
