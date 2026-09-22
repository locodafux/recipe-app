// Which What's new entries to show at launch. Pure, so npm test covers it with no device.
import type { Entry } from './changelog.ts';

/**
 * `seen` is the newest entry id this phone has shown (src/store.ts seeds it on a fresh install,
 * so a new user sees no changelog). Entries newer than it are shown, covering skipped builds.
 * undefined means the app was updated from a build before What's new existed: show the newest only.
 */
export function unseen(log: Entry[], seen: string | undefined): Entry[] {
  const i = seen === undefined ? -1 : log.findIndex((e) => e.id === seen);
  return i === -1 ? log.slice(0, 1) : log.slice(0, i);
}
