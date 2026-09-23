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
  worklist for the M4 human tagging pass. Never fill it with a guess. A `VOCAB`
  entry may be deliberately aisle-less (tofu, water chestnut): it still merges.
- **`data/synonyms.json` is the merge key, not display text.** The UI is English:
  show `label` (per line) or `labels.json` (by canonical, aisle, category key), never
  the Filipino keys. Resolve an ingredient to its canonical name *before* comparing
  or adding quantities, via `tools/canonicalize.py`. `tools/test_canonicalize.py` guards the property that
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
- All tick state goes through `src/store.ts` (AsyncStorage). `src/remote.ts` flushes ticks and unchecks
  via `pendingTicks()` / `markSynced()`. Any tick can be unchecked (D5 revised, README section 4).
- `CI=1 expo start` turns off Metro's file watcher: edits will not reach the bundle.

## What's new (before every APK build)

After an update the app shows, once, the changelog entries the phone has not seen; a fresh install shows none.
Releases reuse one rolling `latest` GitHub Release tag, so "new build" is decided by the newest entry `id` in
`src/changelog.ts`, not by a tag or a network call. Before each APK build:

1. Add an entry at the **top** of `CHANGELOG` in `src/changelog.ts` with a new unique `id` (the build date,
   e.g. `2026-10-05`; add `-2` for a second build that day) and plain-English items for users. No new entry = no sheet.
2. Bump `expo.version` in `app.json` so the installed version reads differently (optional for the sheet itself).
3. `npm test` (`src/whatsnew.test.ts` checks the show-once rules and that ids are unique).

## Releasing the APK (manual, no CI)

The newest APK lives on the one rolling `latest` GitHub Release of `locodafux/recipe-app`. Built locally,
no EAS account: the release build type signs with the debug keystore, and `/android` is generated and gitignored.

```
npx expo prebuild --platform android --no-install   # rewrites package.json scripts: git checkout package.json
cd android && ./gradlew assembleRelease -PreactNativeArchitectures=arm64-v8a
# -> android/app/build/outputs/apk/release/app-release.apk, copy it to palengke-list.apk
gh release create latest palengke-list.apk --latest -t "Latest build" -F notes.md   # first time only
gh release upload latest palengke-list.apk --clobber && gh release edit latest --notes-file notes.md
```

- Re-run `prebuild` whenever `app.json` or native assets changed; a stale `/android` silently ignores them.
- arm64-v8a only (about half the size): installs on real phones and the arm64 `Pixel_7a` emulator, not x86.
- Notes = the top `CHANGELOG` entry's items in plain words, plus an "Android arm64 phones only" line.
- Check `unzip -p <apk> assets/index.android.bundle | grep -c supabase.co` is non-zero, then delete the local APK.

## Shared list sync (M3)

The app talks to the hosted project whose public URL and publishable key are defaults in `src/remote.ts`
(safe to commit; never a secret/service key). `EXPO_PUBLIC_SUPABASE_URL`/`_ANON_KEY` in `.env.local`
override them, e.g. for the local stack (see `.env.example`). Rules are pure in `src/sync.ts` (tested by `src/sync.test.ts`); `src/remote.ts`
only moves data.

- A list item is one row per unit of a market-list line: `item` is the line's merge key, so a tick
  updates every row with that `item`. `label`/`dishes`/`position` exist so the invitee's phone, which never
  merged the dishes, shows the same English list. While a list is shared both phones render its rows.
- Auth uses the **implicit** flow, not PKCE: the inviter's phone requests the invitee's magic link, so
  the invitee holds no code verifier. Tokens arrive in the redirect's `#fragment`; `openLink()` reads them.
- Magic links redirect to `Linking.createURL('join')` (`recipe-app://join` in builds); every form of it
  must be an allowed redirect: `additional_redirect_urls` in `supabase/config.toml` locally, the
  dashboard's URL configuration on the hosted project (`recipe-app://**`).

## History (M5)

Rules are pure in `src/history.ts` (tested by `src/history.test.ts`). `finishShopping(lines)` in
`src/store.ts` snapshots the trip into local `history` and, for a shared list, queues it in `archiving`
with its unsent ticks; `flushArchives()` in `src/remote.ts` sends those ticks, then sets `archived_at`.
`refreshHistory()` merges every archived list the user belongs to (server copy wins by list id).
`syncNow()` notices when the partner archived the list and closes it on this phone. Rows keep dish
names, not recipe ids, so Repeat looks dishes up by name (`ID_BY_NAME`).

## Shared-list backend (Supabase)

`supabase/` is a Supabase CLI project. The schema is the migrations in `supabase/migrations/`;
change it by adding a new migration, never by editing an applied one.

```
supabase/check/check.sh                 # no Docker: throwaway local Postgres + auth stub
supabase start && supabase db reset     # full local stack (needs Docker)
DB_URL=postgresql://postgres:postgres@127.0.0.1:54322/postgres supabase/check/check.sh
```

`check.sh` proves RLS isolation, the tick and uncheck rules, the invite flow and archiving. It is a
plain psql script, not pgTAP, so it lives outside `supabase/tests/` (where `supabase test db` looks).
No hosted Supabase project exists yet. Magic-link emails from the local stack show up in Mailpit
at http://127.0.0.1:54324.

### Sharp edges

- **README section 4's OR rule is split between client and database.** The `guard_list_item` trigger
  sets `checked_by`/`checked_at` and keeps whoever reached it first; `checked = false` unchecks.
  The app only sends false for a tapped uncheck, filtered on the `checked_by` it was tapped on
  (`syncNow` in `src/remote.ts`), so a late phone cannot un-buy a newer tick.
- **Archived lists are frozen**: no edits to the list, its items or its invites, and no un-archiving.
  To re-run a trip, copy its items into a new list.
- **Invites**: a member inserts `invites(list_id, email)`. The app then calls
  `supabase.auth.signInWithOtp({ email, options: { emailRedirectTo } })` with the returned `token`
  in the redirect URL, and after sign-in the invitee's app calls `rpc('accept_invite', { p_token })`.
  The token is single-use and only works for the invited email. Redirect URLs must be allowed in
  `supabase/config.toml` (`additional_redirect_urls`; add the app's own scheme once it has one).
- Membership rows are written only by the `add_list_owner` trigger and `accept_invite`. Clients have
  no insert policy on `list_members`.

## Maintaining this file

Keep this file for knowledge useful to almost every future agent session in this project.
Do not repeat what the codebase already shows; point to the authoritative file or command instead.
Prefer rewriting or pruning existing entries over appending new ones.
When updating this file, preserve this bar for all agents and keep entries concise.
