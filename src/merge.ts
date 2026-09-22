// README section 6: turn the week's dishes into one market list, grouped by aisle.
import { normalize, resolve, type Index } from './canonicalize.ts';

export type Aisle = 'gulay' | 'dry goods' | 'isda' | 'karne';

export type Ingredient = {
  item: string;
  qty: number | null;
  unit: string | null;
  aisle: Aisle | null;
  /** English display label, added by the en-labels data task (field name not final, so both are read). */
  label?: string;
  en?: string;
};

export type Recipe = {
  id: string;
  name: string;
  alt: string[];
  category: string;
  servings: number | null;
  source: string;
  ingredients: Ingredient[];
};

export type Part = { qty: number | null; unit: string | null };

export type Line = {
  /** Canonical merge key (or the normalized text when the map has no entry). Ticks are keyed on it. */
  key: string;
  label: string;
  aisle: Aisle | null;
  /** One entry per distinct unit: same unit adds, different units are shown side by side. */
  parts: Part[];
  from: { dish: string; item: string; qty: number | null; unit: string | null }[];
};

/** D2: dry before wet. `null` (not yet tagged, M4 worklist) goes last. */
export const AISLE_ORDER: (Aisle | null)[] = ['gulay', 'dry goods', 'isda', 'karne', null];

export const AISLE_LABEL: Record<string, string> = {
  gulay: 'Vegetables',
  'dry goods': 'Dry goods',
  isda: 'Fish & seafood',
  karne: 'Meat',
  null: 'Not sorted yet',
};

export const displayName = (i: Ingredient) => i.label || i.en || i.item;

export function mergeKey(i: Ingredient, index: Index): string {
  return resolve(i.item, index) ?? normalize(i.item);
}

export function merge(recipes: Recipe[], index: Index): Line[] {
  const lines = new Map<string, Line>();
  for (const r of recipes) {
    for (const i of r.ingredients) {
      const key = mergeKey(i, index);
      let line = lines.get(key);
      if (!line) {
        line = { key, label: displayName(i), aisle: i.aisle, parts: [], from: [] };
        lines.set(key, line);
      }
      line.aisle ??= i.aisle;
      line.from.push({ dish: r.name, item: i.item, qty: i.qty, unit: i.unit });
      const part = line.parts.find((p) => p.unit === i.unit);
      if (!part) line.parts.push({ qty: i.qty, unit: i.unit });
      else if (i.qty != null) part.qty = (part.qty ?? 0) + i.qty;
    }
  }
  return [...lines.values()];
}

/** Group by aisle in D2 order; each group keeps first-seen order. */
export function byAisle<T extends { aisle: Aisle | null }>(items: T[]) {
  return AISLE_ORDER.map((aisle) => ({ aisle, items: items.filter((l) => l.aisle === aisle) })).filter(
    (g) => g.items.length > 0,
  );
}

const FRACTIONS: Record<string, string> = { '0.25': '¼', '0.50': '½', '0.75': '¾', '0.33': '⅓', '0.67': '⅔' };

export function formatQty(q: number): string {
  const whole = Math.floor(q);
  const frac = FRACTIONS[(q - whole).toFixed(2)];
  if (frac) return whole ? `${whole}${frac}` : frac;
  return String(Math.round(q * 100) / 100);
}

const NO_PLURAL = new Set(['tbsp', 'tsp', 'lb', 'oz', 'kg', 'g', 'ml']);

/** Display only; merging compares the raw unit. "piece" -> "pc"/"pcs", "bunch" -> "bunches". */
export function unitLabel(unit: string | null, qty: number | null): string {
  if (!unit) return '';
  if (unit === 'piece') unit = 'pc';
  if (qty == null || qty <= 1 || NO_PLURAL.has(unit)) return unit;
  return /(ch|sh|s|x)$/.test(unit) ? `${unit}es` : `${unit}s`;
}

/** "1 kg + 350 g". A part with no quantity shows just its unit; none at all shows "". */
export function formatParts(parts: Part[]): string {
  return parts
    .map((p) => [p.qty != null ? formatQty(p.qty) : '', unitLabel(p.unit, p.qty)].join(' ').trim())
    .filter(Boolean)
    .join(' + ');
}
