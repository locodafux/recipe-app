// Is there a newer APK than the one running? Pure, so node:test can run it; src/appUpdate.ts does the I/O.
// Releases reuse one rolling `latest` tag (AGENTS.md, Releasing the APK), so there is no version to compare.
// Instead: an APK uploaded after this app was last installed on the phone (Android's lastUpdateTime) is newer.
// A fresh install from the release page, or an install through the banner itself (Android kills the process
// mid-install, so no JS runs afterwards), both bump lastUpdateTime and so read as up to date.
export const ASSET_NAME_PREFERENCE = ['palengke-list.apk'];

export type AvailableUpdate = { downloadUrl: string; assetName: string };
export type GithubAsset = { name: string; browser_download_url: string; updated_at: string };

export function newerApk(assets: GithubAsset[], installedAt: Date): AvailableUpdate | null {
  const asset = ASSET_NAME_PREFERENCE.map((n) => assets.find((a) => a.name === n)).find((a) => a)
    ?? assets.find((a) => a.name.endsWith('.apk'));
  if (!asset || new Date(asset.updated_at) <= installedAt) return null;
  return { downloadUrl: asset.browser_download_url, assetName: asset.name };
}
