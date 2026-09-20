# recipe-app

A Filipino recipe book that turns dishes into a shared grocery checklist you tick off in the palengke.

Status: **planning**. No code yet. All decisions below are the captain's calls of 2026-09-20.

---

## 1. What it does

1. You search or browse Filipino dishes (sinigang, adobo, kare-kare, ...).
2. You tap the ones you want to cook this week.
3. The app merges all their ingredients into one shopping list, grouped by where you walk in the market (gulay, karne, isda, dry goods).
4. **Both of you** check items off, on your own phones, at the same time, and each sees the other's ticks.

That is the whole product. Everything else is later.

---

## 2. The recipe data: why not an API

The obvious plan is "call a Filipino recipe API". We checked the real ones first.

### TheMealDB (free, no key)

`https://www.themealdb.com/api/json/v1/1/filter.php?a=Filipino` returns **8 recipes, total**:

| # | Recipe |
|---|--------|
| 1 | Beef Asado |
| 2 | Beef Caldereta |
| 3 | Beef Mechado |
| 4 | Bistek |
| 5 | Crispy Eggplant |
| 6 | Eggplant Adobo |
| 7 | Grilled eggplant with coconut milk |
| 8 | Tortang Talong |

Four of the eight are eggplant. And:

- `search.php?s=sinigang` → `{"meals":null}` — **sinigang is not in it**
- there is no chicken adobo or pork adobo, only *eggplant* adobo

### Spoonacular

Has a `cuisine=Filipino` filter and good ingredient parsing, but needs an API key, the free tier is ~150 points/day, and its Filipino results are mostly Western food-blog approximations.

### Decision: bundled `recipes.json`, plus TheMealDB as a search button

**Both.** `recipes.json` ships inside the app — ~25 dishes written properly with real Filipino ingredient names. That is the offline core, and it is what guarantees sinigang and adobo are correct.

TheMealDB goes in as an explicit **"Search more recipes"** button from M2, not as the foundation. It needs signal, so it is clearly marked as online-only and its results are treated as imports into the local set, never as the source of truth.

> Pending: a scout is scanning existing recipe-to-list apps and Filipino recipe datasets. If it finds a dataset or scraper that beats hand-writing 25 recipes, this section gets revised before M1 starts.

---

## 3. Stack

**Expo / React Native + Supabase.**

| Layer | Choice | Why |
|---|---|---|
| App | Expo (React Native) | Same stack as taiwan-expenses — no new tooling to learn, real app on both phones |
| Backend | Supabase | Two people need to see each other's ticks; Realtime gives that without writing a server |
| Recipes | Bundled `recipes.json` | Offline core. Not in Supabase — the market is where signal dies |
| List state | Supabase, cached locally | Syncs between phones, survives no signal |

---

## 4. Two phones, one list, no signal

These two requirements fight each other, so the rule is explicit:

- **Local-first.** Every tick writes to the phone immediately and shows immediately. The market is exactly where signal dies; the app must never wait on the network to check off an onion.
- **Sync on reconnect.** Queued ticks flush to Supabase when signal returns; Realtime pushes the other person's ticks in.
- **Conflicts resolve by OR, not by clock.** If *either* person checked an item, it is checked. You cannot un-buy something by having a slower phone. This makes conflict resolution one line and rules out ever needing a CRDT library.

### Joining a list

**Supabase magic-link email invite.** You create the list, send her an email link, she taps it and she's on it. Real Supabase auth, no passwords to remember.

### After shopping

**The list archives and the history is kept.** You can look back at what you bought and when, and re-run a past trip as the basis for a new one.

### Tables

```
lists        id, name, created_at, archived_at
list_items   id, list_id, item, qty, unit, aisle, checked, checked_by, checked_at
list_members id, list_id, user_id, role
invites      id, list_id, email, token, accepted_at
```

`checked` is a boolean that only ever goes false→true during a shopping trip. Archiving is an explicit action, not a sync outcome.

---

## 5. Data shape

```json
{
  "id": "sinigang-baboy",
  "name": "Sinigang na Baboy",
  "alt": ["pork sinigang", "sour pork soup"],
  "servings": 4,
  "ingredients": [
    { "item": "liempo (pork belly)", "qty": 1,   "unit": "kg",    "aisle": "karne" },
    { "item": "sampalok (tamarind) mix", "qty": 1, "unit": "pack", "aisle": "dry goods" },
    { "item": "gabi (taro)",        "qty": 250, "unit": "g",     "aisle": "gulay" },
    { "item": "kangkong",           "qty": 1,   "unit": "bunch", "aisle": "gulay" },
    { "item": "patis (fish sauce)", "qty": 2,   "unit": "tbsp",  "aisle": "dry goods" }
  ]
}
```

**Naming: Filipino first, English in brackets** — `sampalok (tamarind)`, `gabi (taro)`, `patis (fish sauce)`. Where there is no useful English word (kangkong, bagoong), the Filipino name stands alone.

**Aisles are Filipino:** `gulay` · `karne` · `isda` · `dry goods`. These are the section headers on the shopping list.

Cooking steps are optional per recipe and can come later. The grocery list does not need them.

---

## 6. Merging rules

Two recipes both need garlic → one line, not two.

- same item + same unit → add the quantities (`3 cloves` + `5 cloves` = `8 cloves`)
- same item + different units → show both (`1 cup + 2 tbsp toyo`)

No unit-conversion engine. Nobody needs the app to know that 16 tbsp is a cup; a person reading "1 cup + 2 tbsp toyo" buys the right bottle.

---

## 7. Milestones

| # | Deliverable |
|---|-------------|
| M0 | Folder, git repo, this README. ✅ |
| M1 | `recipes.json` — **the full catalogue of famous Filipino dishes**, Filipino-first naming |
| M2 | Expo app: browse, select, merged checklist. Supabase schema, magic-link invites, local-first ticking. TheMealDB "Search more" button |
| M3 | Realtime sync between two phones, OR-merge on `checked`, offline queue and flush |
| M4 | Archive + trip history, re-run a past list |
| Later | Scale by servings, pantry ("already have it"), recipe photos, cooking steps |

### M1 scope: "all the famous dishes in the Philippines"

Not 10 — the whole catalogue, roughly 90-110 dishes, grouped so the app can browse by category:

| Category | Examples |
|---|---|
| **Ulam — karne** | adobong manok/baboy, kaldereta, mechado, afritada, menudo, pochero, bistek tagalog, dinuguan, sisig, lechon kawali, crispy pata, humba, hamonado, tapa, tocino, longganisa, embutido, morcon, bopis, igado |
| **Ulam — isda at pagkaing-dagat** | sinigang na hipon/bangus, rellenong bangus, daing na bangus, paksiw na isda, escabeche, adobong pusit, kinilaw, sinigang na sugpo, ginataang tilapia |
| **Sabaw** | sinigang na baboy, bulalo, nilagang baka, tinolang manok, sopas, la paz batchoy, molo, goto, arroz caldo, papaitan |
| **Gulay** | pinakbet, laing, chopsuey, ginataang gulay, ginisang monggo, adobong kangkong, ampalaya con carne, tortang talong, bicol express, binagoongan |
| **Pancit at kanin** | pancit canton, bihon, palabok, malabon, habhab, sotanghon, lomi, mami, bringhe, paella filipina, sinangag |
| **Pulutan at meryenda** | lumpiang shanghai, lumpiang sariwa, tokwa't baboy, calamares, kwek-kwek, okoy, chicharon, isaw, turon, banana cue, camote cue |
| **Panghimagas** | leche flan, halo-halo, bibingka, puto bumbong, puto, kutsinta, sapin-sapin, biko, maja blanca, ginataang bilo-bilo, buko pandan, ube halaya, brazo de mercedes, sans rival, ensaymada, yema, pastillas, polvoron |

**This is a much bigger content job than 10 recipes** — roughly 700-1,000 individual ingredient lines, each needing a correct Filipino name, a quantity, and an aisle. It makes the pending dataset question decisive: writing that by hand is days of work, importing and checking it is hours.

---

## 8. Deliberately not in v1

Price tracking · barcode scanning · meal-plan calendar · nutrition info · in-app recipe editing · serving-size scaling.

Each is a real feature. None is needed to walk into a market with a correct list.

---

## 9. Open questions

1. **Where does the recipe content come from at this scale?** ~100 dishes is days of hand-writing. Held pending the competitor and dataset scan — see section 2.
2. **Does browsing need categories in the UI from M2?** With ~100 dishes, a flat searchable list may be enough, or the categories above may need to be real navigation.
