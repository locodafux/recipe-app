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

### Tables

```
lists        id, name, created_at
list_items   id, list_id, item, qty, unit, aisle, checked, checked_by
list_members id, list_id, user_id
```

`checked` is a boolean that only ever goes false→true during a shopping trip. Clearing the list is an explicit action, not a sync outcome.

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
| M1 | `recipes.json` — 10 dishes, sinigang and adobo included, Filipino-first naming |
| M2 | Expo app: browse, select, merged checklist. Supabase schema + local-first ticking. TheMealDB "Search more" button |
| M3 | Realtime sync between two phones, OR-merge on `checked`, offline queue and flush |
| M4 | Fill out to ~25 recipes |
| Later | Scale by servings, pantry ("already have it"), recipe photos, cooking steps |

**First 10 dishes** (captain left the pick to me): sinigang na baboy, chicken adobo, kare-kare, tinola, bulalo, menudo, afritada, pancit bihon, ginataang gulay, tortang talong.

---

## 8. Deliberately not in v1

Price tracking · barcode scanning · meal-plan calendar · nutrition info · in-app recipe editing · serving-size scaling.

Each is a real feature. None is needed to walk into a market with a correct list.

---

## 9. Open questions

1. **How do two people end up on the same list?** A shared household code you type once, a Supabase magic-link invite, or full email/password accounts. This blocks M2 — the schema above assumes `list_members` but not how a row gets there.
2. **What happens after shopping?** Does the list clear, archive, or stay ticked until the next cook plan? Affects whether `lists` needs a lifecycle column.
