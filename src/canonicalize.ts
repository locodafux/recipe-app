// Port of tools/canonicalize.py: resolve an ingredient string to its canonical
// Filipino name. This is the merge key, never display text. It reads the same
// data/synonyms.json the Python does; change the map there, not here.

export type Synonyms = Record<string, string[]>;
export type Index = [phrase: string, canonical: string][];

// Python's \w is Unicode-aware, so keep letters, marks and digits in any script.
const PUNCT = /[^\p{L}\p{M}\p{N}_\s]/gu;

/** Casefold, strip punctuation and collapse whitespace. */
export function normalize(s: string | null | undefined): string {
  return (s ?? '').toLowerCase().replace(PUNCT, ' ').replace(/\s+/g, ' ').trim();
}

/** {canonical: [variants]} -> [normalized phrase, canonical][], longest phrase first. */
export function buildIndex(synonyms: Synonyms): Index {
  const index = new Map<string, string>();
  for (const [canonical, variants] of Object.entries(synonyms)) {
    for (const phrase of [canonical, ...variants]) {
      const n = normalize(phrase);
      const prev = index.get(n);
      if (n && (prev === undefined || n.length > normalize(prev).length)) index.set(n, canonical);
    }
  }
  // Stable sort, like Python's sorted(), so equal-length ties keep insertion order.
  return [...index].sort((a, b) => b[0].length - a[0].length);
}

/**
 * -> canonical Filipino name, or null when nothing in the map matches.
 * Exact match wins; otherwise the longest variant found as whole words wins.
 */
export function resolve(item: string | null | undefined, index: Index): string | null {
  const n = normalize(item);
  if (!n) return null;
  const exact = index.find(([phrase]) => phrase === n);
  if (exact) return exact[1];
  // normalize() leaves single-spaced word runs, so padding with spaces gives the
  // same whole-word match as Python's (?<!\w)phrase(?!\w).
  const padded = ` ${n} `;
  const hit = index.find(([phrase]) => padded.includes(` ${phrase} `));
  return hit ? hit[1] : null;
}
