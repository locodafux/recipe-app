// Local-first state: this week's dishes, shopping ticks and the cached shared list, persisted on the phone.
// No network code: src/remote.ts flushes ticks and unchecks via pendingTicks()/markSynced() and feeds in applyRows().
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';
import { CHANGELOG } from './changelog.ts';
import { mergeHistory, repeatIds, tripFromLines, tripFromRows, type Trip } from './history.ts';
import type { Line } from './merge.ts';
import { applyRemote, markSent, pending, toggle, type Pending, type Row, type Tick, type Unticks } from './sync.ts';

export type { Tick };

/** The Supabase list this trip is shared on, cached so shopping still works with no signal. */
export type Shared = {
  id: string;
  name: string;
  rows: Row[];
  me: string; // this phone's user id
  owner: boolean; // this phone created the list (the other one joined by invite)
  partner?: { id?: string; email: string };
};

type State = {
  week: string[]; // recipe ids, in the order they were added
  ticks: Record<string, Tick>; // keyed by merge key (Line.key)
  unticks: Unticks; // queued unchecks, keyed like ticks
  shared: Shared | null;
  seen?: string; // newest What's new entry shown (src/whatsnew.ts)
  history: Trip[]; // finished trips, newest first
  archiving: { id: string; ticks: string[] }[]; // shared lists finished offline: archive them, and these ticks, on reconnect
};

const KEY = 'recipe-app/state/v1';
let state: State = { week: [], ticks: {}, unticks: {}, shared: null, history: [], archiving: [] };
const listeners = new Set<() => void>();

function set(next: State) {
  state = next;
  listeners.forEach((l) => l());
  AsyncStorage.setItem(KEY, JSON.stringify(state)).catch((e) => console.warn('save failed', e));
}

export async function hydrate() {
  try {
    const saved = await AsyncStorage.getItem(KEY);
    // A fresh install has nothing saved: mark the current notes seen so a new user gets no changelog.
    set(saved ? { ...state, ...JSON.parse(saved) } : { ...state, seen: CHANGELOG[0]?.id });
  } catch (e) {
    console.warn('load failed', e);
  }
}

export const getState = () => state;

export function useStore(): State {
  return useSyncExternalStore(
    (l) => (listeners.add(l), () => listeners.delete(l)),
    () => state,
  );
}

export function markSeen(id: string) {
  set({ ...state, seen: id });
}

export function toggleDish(id: string) {
  const week = state.week.includes(id) ? state.week.filter((d) => d !== id) : [...state.week, id];
  set({ ...state, week });
}

/**
 * A tap on a shopping row: ticks it bought, or unchecks it if it is ticked (D5, revised: any tick can be
 * unchecked, not only one still queued). Writes locally at once and joins the pending queue.
 */
export function toggleTick(key: string) {
  set({ ...state, ...toggle(state, key, Date.now()) });
}

/** The pending queue, oldest first: ticks and unchecks this phone has not yet sent. */
export const pendingTicks = (): Pending[] => pending(state.ticks, state.unticks);

/** Called by the sync task once these have reached the server. */
export function markSynced(sent: Pending[]) {
  set({ ...state, ...markSent(state, sent) });
}

/** Start sharing on a list. Joining someone else's list replaces this phone's own trip. */
export function setShared(shared: Shared | null, resetTicks = false) {
  const ticks = resetTicks ? {} : state.ticks;
  const unticks = resetTicks ? {} : state.unticks;
  set({ ...state, shared, unticks, ticks: shared ? applyRemote(ticks, shared.rows, shared.me, unticks) : ticks });
}

export function setPartner(partner: Shared['partner']) {
  if (state.shared) set({ ...state, shared: { ...state.shared, partner } });
}

/** Rows from the server (a fetch or a realtime event): update the cache and merge their ticks in (sync.ts applyRemote). */
export function applyRows(listId: string, rows: Row[]) {
  const shared = state.shared;
  if (!shared || shared.id !== listId) return;
  const byId = new Map(shared.rows.map((r) => [r.id, r]));
  for (const r of rows) byId.set(r.id, r);
  set({ ...state, shared: { ...shared, rows: [...byId.values()] }, ticks: applyRemote(state.ticks, rows, shared.me, state.unticks) });
}

/**
 * Finish shopping: the trip goes to History and sharing stops. The week that made the list starts empty
 * (an invitee's own week was never on it). A shared list joins the archive queue with the ticks that
 * never reached the server, so remote.ts can archive it at once or on reconnect.
 */
export function finishShopping(lines: Line[], now = new Date()) {
  const { shared, ticks } = state;
  const trip = tripFromLines(shared?.id ?? `local-${now.getTime()}`, now, lines, Object.keys(ticks));
  const archiving = shared ? [...state.archiving, { id: shared.id, ticks: pendingTicks().filter((p) => p.checked).map((p) => p.key) }] : state.archiving;
  set({ ...state, week: !shared || shared.owner ? [] : state.week, ticks: {}, unticks: {}, shared: null, archiving, history: mergeHistory(state.history, [trip]) });
}

/**
 * The partner finished the shared list on their phone: keep it as the server has it and stop sharing.
 * The owner's week was that list, so it ends too; an invitee's own week was never on it.
 */
export function closeArchived(listId: string, archivedAt: string, rows: Row[]) {
  const { shared } = state;
  if (shared?.id !== listId) return;
  set({ ...state, week: shared.owner ? [] : state.week, ticks: {}, unticks: {}, shared: null, history: mergeHistory(state.history, [tripFromRows(listId, archivedAt, rows)]) });
}

export function archived(listId: string) {
  set({ ...state, archiving: state.archiving.filter((a) => a.id !== listId) });
}

/** Archived lists from the server (both members' trips) join this phone's history. */
export function setRemoteHistory(trips: Trip[]) {
  set({ ...state, history: mergeHistory(state.history, trips) });
}

/**
 * 6B "Make it a new list": this week becomes the trip's dishes, nothing ticked. The old trip is untouched.
 * A shared list still in progress keeps its ticks; it takes the new dishes like any other edit.
 */
export function repeatTrip(trip: Trip, idByName: Map<string, string>) {
  set({ ...state, week: repeatIds(trip, idByName), ...(state.shared ? {} : { ticks: {}, unticks: {} }) });
}
