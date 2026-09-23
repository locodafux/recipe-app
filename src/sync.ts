// Pure sync rules for the shared list (README section 4). No network and no React Native here,
// so `npm test` runs them; src/remote.ts wires them to Supabase.
import type { Aisle, Line } from './merge.ts';

/** A `list_items` row. One row per unit of a line, so "1 kg + 350 g" is two rows sharing `item`. */
export type Row = {
  id?: string;
  list_id: string;
  item: string; // the Line key (Filipino merge key); ticks are keyed on it
  label: string | null;
  qty: number | null;
  unit: string | null;
  aisle: Aisle | null;
  dishes: string[];
  position: number;
  checked: boolean;
  checked_by?: string | null;
  checked_at?: string | null;
};

/** `by` is the partner's user id; absent means this phone ticked it. */
export type Tick = { at: number; synced: boolean; by?: string };
export type Ticks = Record<string, Tick>;
/** A queued "not bought": `by` is who ticked what was unchecked, so it can only undo that tick (see flush). */
export type Untick = { at: number; by?: string };
export type Unticks = Record<string, Untick>;
/** One entry of the pending queue: send `checked` for `key`. */
export type Pending = { key: string; at: number; checked: boolean; by?: string };

/**
 * A tap on a row: ticks it, or unchecks a ticked one. Local and immediate either way; the change joins the
 * pending queue, replacing any unsent change to the same item, so the queue holds each item's latest tap.
 */
export function toggle({ ticks, unticks }: { ticks: Ticks; unticks: Unticks }, key: string, at: number) {
  const { [key]: t, ...restTicks } = ticks;
  const { [key]: _, ...restUnticks } = unticks;
  return t
    ? { ticks: restTicks, unticks: { ...restUnticks, [key]: { at, by: t.by } } }
    : { ticks: { ...ticks, [key]: { at, synced: false } }, unticks: restUnticks };
}

/** The pending queue, oldest first: ticks and unchecks this phone has not yet sent. */
export function pending(ticks: Ticks, unticks: Unticks): Pending[] {
  return [
    ...Object.entries(ticks).filter(([, t]) => !t.synced).map(([key, t]) => ({ key, at: t.at, checked: true })),
    ...Object.entries(unticks).map(([key, u]) => ({ key, at: u.at, checked: false, by: u.by })),
  ].sort((a, b) => a.at - b.at);
}

/** These reached the server. An item tapped again since (a different `at`) stays queued. */
export function markSent({ ticks, unticks }: { ticks: Ticks; unticks: Unticks }, sent: Pending[]) {
  const t = { ...ticks };
  const u = { ...unticks };
  for (const p of sent) {
    if (p.checked && t[p.key]?.at === p.at) t[p.key] = { ...t[p.key], synced: true };
    if (!p.checked && u[p.key]?.at === p.at) delete u[p.key];
  }
  return { ticks: t, unticks: u };
}

/** `start` continues the numbering when lines are added to a list that already has rows. */
export function linesToRows(lines: Line[], listId: string, start = 0): Row[] {
  return lines.flatMap((l) => l.parts.map((p) => ({ l, p }))).map(({ l, p }, i) => ({
    list_id: listId, item: l.key, label: l.label, qty: p.qty, unit: p.unit, aisle: l.aisle,
    dishes: [...new Set(l.from.map((f) => f.dish))], position: start + i, checked: false,
  }));
}

/** The shared list as market-list lines, so both phones render the same thing. */
export function rowsToLines(rows: Row[]): Line[] {
  const lines = new Map<string, Line>();
  for (const r of [...rows].sort((a, b) => a.position - b.position)) {
    let line = lines.get(r.item);
    if (!line) {
      line = { key: r.item, label: r.label || r.item, aisle: r.aisle, parts: [],
        from: r.dishes.map((dish) => ({ dish, item: r.item, qty: null, unit: null })) };
      lines.set(r.item, line);
    }
    line.parts.push({ qty: r.qty, unit: r.unit });
  }
  return [...lines.values()];
}

/**
 * Merge of server rows into local ticks. A checked row ticks the item, credited to whoever the server says
 * reached it first, and marks a local tick of it sent. An unchecked row clears a sent tick (someone unchecked
 * it) but never a queued one: that tick is still on its way. A checked row never brings back an item whose
 * uncheck is still queued here; once the uncheck is sent, the server has the final say.
 */
export function applyRemote(ticks: Ticks, rows: Row[], me: string | undefined, unticks: Unticks = {}): Ticks {
  let next = ticks;
  for (const r of rows) {
    const t = next[r.item];
    if (!r.checked) {
      if (t?.synced) {
        const { [r.item]: _, ...rest } = next;
        next = rest;
      }
      continue;
    }
    if (t?.synced || unticks[r.item]) continue;
    const by = r.checked_by && r.checked_by !== me ? r.checked_by : undefined;
    next = { ...next, [r.item]: { at: t?.at ?? (r.checked_at ? Date.parse(r.checked_at) : Date.now()), synced: true, by } };
  }
  return next;
}

/**
 * Sends the queue oldest first, one at a time, and returns the entries that reached the server.
 * Stops at the first failure so a later change is never marked sent while an older one is still queued.
 */
export async function flush(queue: Pending[], send: (p: Pending) => Promise<void>): Promise<Pending[]> {
  const sent: Pending[] = [];
  for (const p of queue) {
    try {
      await send(p);
    } catch {
      break;
    }
    sent.push(p);
  }
  return sent;
}

/** "ana@gmail.com" -> "Ana". */
export function firstName(email: string | undefined): string {
  const n = (email ?? '').split('@')[0].split(/[._+-]/)[0];
  return n ? n[0].toUpperCase() + n.slice(1) : 'Your partner';
}
