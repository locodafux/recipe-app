# Project agent memory

This file is the project's committed home for project-intrinsic agent knowledge: build, test, release, architecture, and sharp-edge notes that should travel with the code.

`README.md` is the product contract: what the app does, the data shape (section 5),
the merging rules (section 6) and the milestones (section 7). Read it before changing
anything under `data/`.

## Recipe catalogue (M1)

`data/recipes.json`, `data/synonyms.json` and `data/labels.json` are **generated**, not hand-edited.
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
- English UI text: ingredient labels and aisle names (display order) in `tools/vocab.py`,
  category names (chip order) in `tools/dishes.py`.

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
- **`data/synonyms.json` is the merge key, not display text.** The UI is English:
  show `label` (per line) or `labels.json` (by canonical, aisle, category key), never
  the Filipino keys. Resolve an ingredient to its canonical name *before* comparing
  or adding quantities, via `tools/canonicalize.py`. `tools/test_canonicalize.py` guards the property that
  every variant of one ingredient collapses to exactly one canonical name.
- The resolver lives in Python because M1 has no JS toolchain. When the Expo app
  arrives it must re-implement `resolve()` against the same `data/synonyms.json`
  rather than forking the map.

## Maintaining this file

Keep this file for knowledge useful to almost every future agent session in this project.
Do not repeat what the codebase already shows; point to the authoritative file or command instead.
Prefer rewriting or pruning existing entries over appending new ones.
When updating this file, preserve this bar for all agents and keep entries concise.
