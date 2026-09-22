# Project agent memory

This file is the project's committed home for project-intrinsic agent knowledge: build, test, release, architecture, and sharp-edge notes that should travel with the code.

`README.md` is the product contract: what the app does, the data shape (section 5),
the merging rules (section 6) and the milestones (section 7). Read it before changing
anything under `data/`.

## Recipe catalogue (M1)

`data/recipes.json` and `data/synonyms.json` are **generated**, not hand-edited.
Rebuild with:

```
uv run --with recipe-scrapers --with requests tools/build-recipes.py
python3 tools/test_canonicalize.py && python3 tools/test_parse.py
```

`tools/build-recipes.py` is build-time only: run by hand, output committed, never
shipped in the app and never called at runtime. It caches fetched pages in
`.cache/` (gitignored), so a re-run costs no requests.

To change the catalogue, edit the curated inputs and re-run — never patch the JSON:

- `tools/dishes.py` — which dishes are in the catalogue, and the slug terms that find them.
- `tools/vocab.py` — canonical Filipino ingredient names, their variants and their aisle.

### Sharp edges

- **Only dish names, servings and ingredient lines are ever taken** — no prose, no
  steps, no photos. That boundary is what makes the data usable (US Copyright Office
  Circular 33: a mere listing of ingredients is uncopyrightable). Keep it.
- **pepper.ph is unusable** despite having 761 recipe URLs: it renders ingredients
  client-side and ships zero `recipeIngredient` markup. yummy.ph and knorr.com/ph
  hard-block automated access. Working sources are panlasangpinoy.com,
  kawalingpinoy.com and nestlegoodnes.com/ph.
- **`aisle: null` means "the map could not place this"**, not "no aisle". It is the
  worklist for the M4 human tagging pass. Never fill it with a guess.
- **`data/synonyms.json` is the merge key, not display text.** Resolve an ingredient
  to its canonical name *before* comparing or adding quantities, via
  `tools/canonicalize.py`. `tools/test_canonicalize.py` guards the property that
  every variant of one ingredient collapses to exactly one canonical name.
- `resolve()` exists twice: `tools/canonicalize.py` (build time) and
  `src/canonicalize.ts` (app). Both read the same `data/synonyms.json`; change one,
  change both, and keep `src/canonicalize.test.ts` mirroring `tools/test_canonicalize.py`.

## Expo app (M2)

Expo + TypeScript at the repo root; screens in `src/screens/`, bundled data read by `src/data.ts`.

```
npm install
npm test            # node:test on src/**/*.test.ts, no framework
npx tsc --noEmit
npx expo start      # add --web to check screens in a browser
```

- Pure-logic modules (`canonicalize.ts`, `merge.ts`) import each other with explicit
  `.ts` extensions so Node can run the tests with no build step. Keep React Native
  imports out of them.
- The UI is English. Show `displayName()` (English label, else `item`), never the
  canonical merge key.
- All tick state goes through `src/store.ts` (local only, AsyncStorage). Sync plugs in
  via `pendingTicks()` / `markSynced()`; D5 undo is allowed only while a tick is unsynced.
- `CI=1 expo start` turns off Metro's file watcher: edits will not reach the bundle.

## Maintaining this file

Keep this file for knowledge useful to almost every future agent session in this project.
Do not repeat what the codebase already shows; point to the authoritative file or command instead.
Prefer rewriting or pruning existing entries over appending new ones.
When updating this file, preserve this bar for all agents and keep entries concise.
