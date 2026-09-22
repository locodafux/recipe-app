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
 * OR merge of server rows into local ticks. A checked row ticks the item (credited to whoever the server
 * says reached it first) and ends undo for a local tick of the same item. An unchecked row never
 * removes a local tick: that tick is simply still queued.
 */
export function applyRemote(ticks: Ticks, rows: Row[], me: string | undefined): Ticks {
  let next = ticks;
  for (const r of rows) {
    if (!r.checked) continue;
    const t = next[r.item];
    if (t?.synced) continue;
    const by = r.checked_by && r.checked_by !== me ? r.checked_by : undefined;
    next = { ...next, [r.item]: t ? { ...t, synced: true } : { at: r.checked_at ? Date.parse(r.checked_at) : Date.now(), synced: true, by } };
  }
  return next;
}

/**
 * Sends queued ticks oldest first, one at a time, and returns the keys that reached the server.
 * Stops at the first failure so a later tick is never marked sent while an older one is still queued.
 * Only ever sends "checked"; an undone tick left the queue before this runs.
 */
export async function flush(pending: { key: string }[], send: (key: string) => Promise<void>): Promise<string[]> {
  const sent: string[] = [];
  for (const { key } of pending) {
    try {
      await send(key);
    } catch {
      break;
    }
    sent.push(key);
  }
  return sent;
}

/** "ana@gmail.com" -> "Ana". */
export function firstName(email: string | undefined): string {
  const n = (email ?? '').split('@')[0].split(/[._+-]/)[0];
  return n ? n[0].toUpperCase() + n.slice(1) : 'Your partner';
}
