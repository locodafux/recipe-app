// Local-first state: this week's dishes and shopping ticks, persisted on the phone.
// No network code. A later sync task flushes ticks via pendingTicks()/markSynced().
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

export type Tick = { at: number; synced: boolean };

type State = {
  week: string[]; // recipe ids, in the order they were added
  ticks: Record<string, Tick>; // keyed by merge key (Line.key)
};

const KEY = 'recipe-app/state/v1';
let state: State = { week: [], ticks: {} };
const listeners = new Set<() => void>();

function set(next: State) {
  state = next;
  listeners.forEach((l) => l());
  AsyncStorage.setItem(KEY, JSON.stringify(state)).catch((e) => console.warn('save failed', e));
}

export async function hydrate() {
  try {
    const saved = await AsyncStorage.getItem(KEY);
    if (saved) set({ ...state, ...JSON.parse(saved) });
  } catch (e) {
    console.warn('load failed', e);
  }
}

export function useStore(): State {
  return useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    () => state,
  );
}

export function toggleDish(id: string) {
  const week = state.week.includes(id) ? state.week.filter((d) => d !== id) : [...state.week, id];
  set({ ...state, week });
}

/** Tick an item bought. Writes locally at once and joins the pending queue. */
export function tick(key: string) {
  if (state.ticks[key]) return;
  set({ ...state, ticks: { ...state.ticks, [key]: { at: Date.now(), synced: false } } });
}

/** D5: undo is only allowed while the tick is still queued locally. Once synced, OR wins (README 4). */
export const canUndo = (key: string) => state.ticks[key]?.synced === false;

export function undo(key: string) {
  if (!canUndo(key)) return;
  const { [key]: _, ...ticks } = state.ticks;
  set({ ...state, ticks });
}

/** The pending queue, oldest first: ticks this phone has not yet sent. */
export function pendingTicks(): { key: string; at: number }[] {
  return Object.entries(state.ticks)
    .filter(([, t]) => !t.synced)
    .map(([key, t]) => ({ key, at: t.at }))
    .sort((a, b) => a.at - b.at);
}

/** Called by the sync task once these ticks have reached the server; they can no longer be undone. */
export function markSynced(keys: string[]) {
  const ticks = { ...state.ticks };
  for (const k of keys) if (ticks[k]) ticks[k] = { ...ticks[k], synced: true };
  set({ ...state, ticks });
}

/** Ends the trip. Archiving to History (M5) hooks in here. */
export function finishShopping() {
  set({ ...state, ticks: {} });
}
