# recipe-app

A Filipino recipe book that turns dishes into a grocery checklist you can tick off in the palengke.

Status: **planning only**. No code yet.

---

## 1. What it does

1. You search or browse Filipino dishes (sinigang, adobo, kare-kare, ...).
2. You tap the ones you want to cook this week.
3. The app merges all their ingredients into one shopping list, grouped by where you walk in the market (gulay, karne, isda, dry goods).
4. You check items off while shopping. The list survives closing the app.

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

The headline dish in the request does not exist in the free API. This is a dead end on its own.

### Spoonacular

Has a `cuisine=Filipino` filter and good ingredient parsing, but: needs an API key, free tier is ~150 points/day (a handful of searches), and its Filipino results are mostly Western food-blog approximations. It also costs money the moment this is used daily.

### Decision: ship a local recipe file

`recipes.json` in the repo, ~25 dishes written properly with real Filipino ingredient names (sampalok, patis, gabi, bagoong). Reasons:

- sinigang and adobo actually exist in it
- ingredients are correct, not a blogger's guess
- **no API key, no rate limit, no network** — the market is exactly where signal dies
- adding a recipe is editing one JSON file

TheMealDB can be bolted on later as an optional "search more recipes" button. It is not needed to ship.

---

## 3. Data shape

```json
{
  "id": "sinigang-baboy",
  "name": "Sinigang na Baboy",
  "alt": ["pork sinigang", "sour pork soup"],
  "servings": 4,
  "ingredients": [
    { "item": "pork belly (liempo)", "qty": 1,   "unit": "kg",  "aisle": "karne" },
    { "item": "sampalok mix",        "qty": 1,   "unit": "pack","aisle": "dry" },
    { "item": "gabi",                "qty": 250, "unit": "g",   "aisle": "gulay" },
    { "item": "kangkong",            "qty": 1,   "unit": "bunch","aisle": "gulay" },
    { "item": "patis",               "qty": 2,   "unit": "tbsp","aisle": "dry" }
  ]
}
```

`aisle` is the one field that earns its place — it is what makes the list walkable instead of random.

Cooking steps are optional and can be added per recipe later. The grocery list does not need them.

---

## 4. Merging rules

Two recipes both need garlic → one line, not two.

- same item + same unit → add the quantities (`3 cloves` + `5 cloves` = `8 cloves`)
- same item + different units → show both (`1 cup + 2 tbsp soy sauce`)

No unit-conversion engine. Nobody needs the app to know that 16 tbsp is a cup; a person reading "1 cup + 2 tbsp soy sauce" buys the right bottle.

---

## 5. Stack

Single `index.html` — plain HTML, CSS, a bit of JS, `recipes.json` beside it, checked state in `localStorage`.

- no build step, no npm install, no deploy pipeline
- open it on the phone, Add to Home Screen, it behaves like an app
- works offline, which is the actual requirement in a market

Move to Vite + React only when the single file genuinely hurts — probably around the point we want recipe editing or multiple saved lists.

---

## 6. Milestones

| # | Deliverable |
|---|-------------|
| M0 | This README. ✅ |
| M1 | `recipes.json` with 10 dishes, sinigang and adobo included |
| M2 | `index.html`: browse, select, merged checklist, saved state |
| M3 | Aisle grouping + quantity merging |
| M4 | Fill out to ~25 recipes |
| Later | TheMealDB "search more", share list, scale by servings, pantry ("already have it") |

---

## 7. Deliberately not in v1

Accounts, cloud sync, price tracking, barcode scanning, meal-plan calendar, nutrition info, photos, recipe editing in-app, serving-size scaling.

Each of these is a real feature. None of them is needed to walk into a market with a correct list.

---

## 8. Open questions

1. **Recipe count and picks** — is ~25 right, and which dishes go in the first 10?
2. **Language** — Filipino ingredient name first with English in brackets (`sampalok (tamarind)`), or the reverse?
3. **Aisle names** — Filipino (`gulay / karne / isda / dry`) or English (`produce / meat / seafood / pantry`)?
4. **Shared list** — will two people shop from the same list at once? That is the one thing that would force a backend, so it is worth answering before M2.
