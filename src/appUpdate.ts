// Checks the rolling `latest` GitHub release for a newer APK and installs it. Android only; the rule is in src/update.ts.
import * as Application from 'expo-application';
import { Directory, File, Paths } from 'expo-file-system';
import { getContentUriAsync } from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import { Platform } from 'react-native';
import { newerApk, type AvailableUpdate, type GithubAsset } from './update.ts';

const RELEASE = 'https://api.github.com/repos/locodafux/recipe-app/releases/tags/latest';

export async function checkForUpdate(): Promise<AvailableUpdate | null> {
  if (Platform.OS !== 'android') return null;
  const res = await fetch(RELEASE);
  if (!res.ok) return null;
  const release: { assets?: GithubAsset[] } = await res.json();
  const installedAt = await Application.getLastUpdateTimeAsync();
  return newerApk(release.assets ?? [], installedAt);
}

// Downloads the APK to the cache dir and hands it to Android's package installer. The install intent needs a
// content:// URI (not file://) on API 24+, so convert via the FileProvider that expo-file-system registers.
export async function downloadAndInstall(update: AvailableUpdate, onProgress?: (fraction: number) => void) {
  const destination = new File(new Directory(Paths.cache), update.assetName);
  if (destination.exists) destination.delete();

  const task = File.createDownloadTask(update.downloadUrl, destination, {
    onProgress: ({ bytesWritten, totalBytes }) => { if (totalBytes > 0) onProgress?.(bytesWritten / totalBytes); },
  });
  const file = await task.downloadAsync();
  if (!file) throw new Error('Download was cancelled');

  // Nothing to record afterwards: a finished install bumps lastUpdateTime, so checkForUpdate sees it is current;
  // a cancelled or permission-blocked one leaves it unchanged, so the banner comes back.
  await IntentLauncher.startActivityAsync('android.intent.action.VIEW', {
    data: await getContentUriAsync(file.uri),
    flags: 1, // FLAG_GRANT_READ_URI_PERMISSION
    type: 'application/vnd.android.package-archive',
  });
}
