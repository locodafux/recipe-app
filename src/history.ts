// M5 rules for finished trips (README section 4, "After shopping"): what a trip keeps, how phones'
// copies merge, and how Repeat turns one back into a week. No network and no React Native here.
import type { Line } from './merge.ts';
import { rowsToLines, type Row } from './sync.ts';

/** A finished trip. `id` is the Supabase list id, or `local-…` for a list that was never shared. */
export type Trip = { id: string; at: string; lines: Line[]; bought: string[] };

/** A trip as it ended on this phone: the lines shopped from and the keys ticked. */
export function tripFromLines(id: string, at: Date, lines: Line[], ticked: string[]): Trip {
  const keys = new Set(ticked);
  return { id, at: at.toISOString(), lines, bought: lines.filter((l) => keys.has(l.key)).map((l) => l.key) };
}

/** A trip as the server keeps it: an archived list's rows, with both phones' ticks. */
export function tripFromRows(id: string, archivedAt: string, rows: Row[]): Trip {
  return { id, at: archivedAt, lines: rowsToLines(rows), bought: [...new Set(rows.filter((r) => r.checked).map((r) => r.item))] };
}

/** One history, newest first. The server's copy of a shared trip replaces this phone's. */
export function mergeHistory(local: Trip[], remote: Trip[]): Trip[] {
  const byId = new Map(local.map((t) => [t.id, t]));
  for (const t of remote) byId.set(t.id, t);
  return [...byId.values()].sort((a, b) => b.at.localeCompare(a.at));
}

/** The trip's dishes, in list order. */
export const tripDishes = (t: Trip) => [...new Set(t.lines.flatMap((l) => l.from.map((f) => f.dish)))];

/**
 * Repeat (6B): the recipe ids to start a new week from. Rows only keep dish names, so they are looked up
 * by name; a dish no longer in the catalogue is dropped.
 */
export function repeatIds(t: Trip, idByName: Map<string, string>): string[] {
  return tripDishes(t).map((d) => idByName.get(d)).filter((id) => id !== undefined);
}

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** "Saturday, 19 Sep", in the phone's time zone. */
export function tripDate(at: string): string {
  const d = new Date(at);
  return `${DAYS[d.getDay()]}, ${d.getDate()} ${MONTHS[d.getMonth()]}`;
}

/** "Sinigang na Baboy, Adobong Manok, +2" */
export function dishSummary(dishes: string[]): string {
  return dishes.length > 2 ? `${dishes.slice(0, 2).join(', ')}, +${dishes.length - 2}` : dishes.join(', ');
}
