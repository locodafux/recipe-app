# recipe-app

A Filipino recipe book that turns dishes into a shared grocery checklist you tick off in the palengke.

Status: **planning**. No code yet. Decisions below were settled 2026-09-20.

---

## 1. What it does

1. You search or browse Filipino dishes (sinigang, adobo, kare-kare, ...).
2. You tap the ones you want to cook this week.
3. The app merges all their ingredients into one shopping list, grouped by where you walk in the market (Vegetables, Dry goods, Fish & seafood, Meat).
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

### Decision: scrape and curate at build time, ship the result

`recipes.json` ships inside the app and is the offline source of truth. It is **built, not typed**.

Four Filipino recipe sites publish machine-readable `schema.org/Recipe` data, free and without an API key — **1,569 recipes at nestlegoodnes.com/ph**, **~2,739 at Panlasang Pinoy**, 627 at Kawaling Pinoy, 761 at Pepper.ph. The MIT-licensed [`recipe-scrapers`](https://github.com/hhursev/recipe-scrapers/) library reads all four, and has a dedicated Panlasang Pinoy scraper. Sinigang, adobo, kare-kare and adobong kangkong were all pulled live to confirm it, returning ingredient names already written as a Filipino cook writes them — *kangkong*, *gabi*, *bagoong alamang*.

The pipeline is a **one-off build-time script**. It never ships in the app and the app never calls it at runtime:

```
sitemaps → filter to wanted dishes → recipe-scrapers (wild_mode)
        → {name, servings, ingredients[]}
        → HAND-TAG the aisle field          ← the irreducible human work
        → commit recipes.json
```

**Only ingredient lists and dish names are taken** — not the prose, not the photos, not the instructions. US Copyright Office Circular 33 states plainly that *"a mere listing of ingredients or contents … is uncopyrightable"*, which is exactly and only the part a grocery list needs. Sources get credited in the app's About screen.

TheMealDB stays as an explicit **"Search more recipes"** button from M2 — online-only, clearly marked, results imported into the local set, never the source of truth.

---

## 3. Stack

**Expo / React Native + Supabase.**

| Layer | Choice | Why |
|---|---|---|
| App | Expo (React Native) | Stack already familiar here — no new tooling to learn, real app on both phones |
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
    { "item": "liempo (pork belly)", "label": "pork belly", "qty": 1,   "unit": "kg",    "aisle": "karne" },
    { "item": "sampalok (tamarind)", "label": "tamarind",   "qty": 1,   "unit": "pack",  "aisle": "dry goods" },
    { "item": "gabi (taro)",         "label": "taro",       "qty": 250, "unit": "g",     "aisle": "gulay" },
    { "item": "kangkong",            "label": "kangkong",   "qty": 1,   "unit": "bunch", "aisle": "gulay" },
    { "item": "patis (fish sauce)",  "label": "fish sauce", "qty": 2,   "unit": "tbsp",  "aisle": "dry goods" }
  ]
}
```

**The UI is English; the data keys stay Filipino.** Every ingredient line carries `label`, its English display name (`tamarind`, `taro`, `fish sauce`), and that is what the app shows. Where there is no useful English word — kangkong, bagoong alamang, okra — the label is the Filipino name. Dish names stay as they are (Sinigang na Baboy). `item` keeps the Filipino-first name with English in brackets, and the canonical Filipino names in `synonyms.json` remain the merge key (section 6); neither is display text.

**Aisle and category values are Filipino keys with English labels**, both in the generated `data/labels.json`, which also maps each canonical ingredient to its English label for the merged list:

| Aisle key | Shown as | | Category key | Shown as |
|---|---|---|---|---|
| `gulay` | Vegetables | | `ulam na karne` | Meat |
| `dry goods` | Dry goods | | `ulam na isda` | Seafood |
| `isda` | Fish & seafood | | `sabaw` | Soups |
| `karne` | Meat | | `gulay` | Vegetables |
| | | | `pancit at kanin` | Noodles & rice |
| | | | `pulutan at meryenda` | Snacks |
| | | | `panghimagas` | Desserts |

**Aisle order is dry before wet:** Vegetables → Dry goods → Fish & seafood → Meat. These are the section headers on the shopping list, in that order, so the fish and meat go in the bag last. `labels.json` lists aisles and categories in display order.

Cooking steps are optional per recipe and can come later. The grocery list does not need them.

---

## 6. Merging rules

Two recipes both need garlic → one line, not two.

- same item + same unit → add the quantities (`3 cloves` + `5 cloves` = `8 cloves`)
- same item + different units → show both (`1 cup + 2 tbsp toyo`)

No unit-conversion engine. Nobody needs the app to know that 16 tbsp is a cup; a person reading "1 cup + 2 tbsp toyo" buys the right bottle.

### The synonym map is the merge key

This is the one thing no competitor does, and it only matters because the recipes are scraped from several sites that name things differently.

One scraped recipe says `tamarind`. Another says `sampalok mix`. A third says `sampaloc`. Those are **one purchase**, and every existing app puts them on three separate lines because it has no idea they are related.

```json
{ "sampalok": ["tamarind", "sampaloc", "tamarind mix", "sampalok mix"],
  "gabi":     ["taro", "taro root"],
  "kangkong": ["water spinach", "ong choy", "onchoy"],
  "patis":    ["fish sauce"],
  "toyo":     ["soy sauce"] }
```

Merging resolves each ingredient to its canonical Filipino name **before** comparing, so the three spellings above collapse to one `sampalok` line, shown as its English label, *tamarind*. The map is the merge key, never display text — the app looks the label up in `labels.json` by canonical name.

---

## 7. Milestones

| # | Deliverable |
|---|-------------|
| M0 | Folder, git repo, this README. ✅ |
| M1 | Build-time scraper script + ~200 scraped recipes ingested to `recipes.json`, Filipino merge key, English display labels |
| M2 | Expo app: browse, select, merged checklist. Supabase schema, magic-link invites, local-first ticking. TheMealDB "Search more" button |
| M3 | Realtime sync between two phones, OR-merge on `checked`, offline queue and flush |
| M4 | **Aisle-tagging pass** over the full catalogue + synonym map |
| M5 | Archive + trip history, re-run a past list |
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

Roughly 700-1,000 individual ingredient lines. **Scraped, not typed** — the names and quantities come from the four sources above. What stays human is tagging each ingredient's palengke section and curating the synonym map, which is where the effort belongs because it is the part nothing else on the market has.

---

## 8. Deliberately not in v1

Price tracking · barcode scanning · meal-plan calendar · nutrition info · in-app recipe editing · serving-size scaling.

Each is a real feature. None is needed to walk into a market with a correct list.

---

## 9. Where this stands against what already exists

Worth being plain about: **merging ingredients, aisle grouping, and offline are solved, commodity features.** Paprika Recipe Manager 3 does all three for a one-time $4.99 on five platforms; Plan to Eat, AnyList and Recipe Keeper are equivalent. This project does not compete on those.

What does not exist anywhere:

1. **Filipino dishes pre-tagged to palengke sections.** Every aisle-grouping app maps to Western supermarket categories. None knows bagoong and patis share a dry-goods stall, or that a palengke has an isda section.
2. **Filipino ingredient vocabulary as the merge key.** Nothing on the market collapses `sampalok` and `tamarind` into one purchase.
3. **A Filipino recipe app with an aisle-grouped merged list.** The nearest, *Panlasang Pinoy Meaty Recipes*, groups its list **by recipe name** — three recipes means walking the market three times, the exact failure this fixes.
4. **Zero-setup.** Paprika is offline *after* you clip 25 recipes by hand, one at a time. This ships with the sinigang already in it, already tagged.

Honest counterweight: 1 and 2 are a *data* advantage, not a software one — anyone could hand-add Filipino aisles to Paprika. The moat is thin. What makes it worth building is that it arrives pre-loaded.

## 10. Open questions

1. ~~**Does browsing need categories in the UI from M2?**~~ Settled: search stays primary, and the seven categories are chips above it that filter the same list.
