#!/usr/bin/env python3
"""The one check for the cooking steps in tools/steps.py.

1. Every dish in data/recipes.json has steps.
2. Every ingredient a dish's steps name is on that dish's shopping list.
3. The steps are our own words: no dish shares more than MAX_SHARED 7-word runs
   with the recipe pages of the big Filipino recipe sites for that dish -- its own
   cached source page plus the best-matching page on each other site the build
   crawls (panlasangpinoy.com, kawalingpinoy.com, nestlegoodnes.com/ph). Any dish
   over the line is rewritten from scratch, never edited down.

Pages come from the build's cache in .cache/pages; missing ones are fetched once,
politely, by the build's own fetch(). Run after rebuilding the catalogue:

    uv run --with requests tools/check_steps.py
"""
import html
import importlib.util
import json
import pathlib
import re
import sys
import urllib.parse

TOOLS = pathlib.Path(__file__).resolve().parent
sys.path.insert(0, str(TOOLS))
from dishes import DISHES, OVERRIDES  # noqa: E402
from steps import STEPS  # noqa: E402
from vocab import DROP, LABELS, VOCAB  # noqa: E402

spec = importlib.util.spec_from_file_location("build", TOOLS / "build-recipes.py")
build = importlib.util.module_from_spec(spec)
spec.loader.exec_module(build)

MAX_SHARED = 2  # 7-word runs per dish; common kitchen phrasing can collide, copying cannot hide
N = 7

# A step may say the general word for a more specific item on the list.
GENERIC = {
    "pork": {"pork belly", "pork shoulder", "pork hock", "pork liver", "pork fat", "pig ears",
             "pig snout", "pig brain", "small intestine", "ruffle fat", "lechon kawali"},
    "chicken": {"chicken thighs", "chicken wings", "chicken breast"},
    "beef": {"beef shank", "oxtail", "ox tongue", "cow trotters", "tripe", "beef liver"},
    "fish": {"milkfish", "tilapia", "tuna", "salmon", "round scad", "smoked fish", "anchovies"},
    "egg": {"hard-boiled egg", "egg yolk", "egg white", "quail eggs", "salted egg"},
    "rice": {"glutinous rice"},
}

# The shopping list is generated from scraped lines, and a few lines were parsed
# into the wrong ingredient. The steps name what the dish really needs; each entry
# here is a catalogue fix waiting in tools/vocab.py or tools/parse.py, not a license.
CATALOGUE_MISLABELS = {
    ("chili-crab", "banana ketchup"): "tomato ketchup, listed as 'tomato (0.25 cup)'",
    ("dinengdeng", "milkfish"): "listed as 'milk (1 piece)'",
    ("dinuguan", "pork blood"): "listed only as 'pork', no blood item on the shopping list",
    ("embutido", "ground pork"): "missing from the list",
    ("kaldereta-manok", "bird's eye chili"): "listed as 'black pepper (3 piece)'",
    ("laing-tinapa", "bird's eye chili"): "listed as 'black pepper (8 piece)'",
    ("longganisa", "ground pork"): "missing from the list",
    ("palabok", "shrimp cube"): "listed as 'shrimp (2 piece)'",
    ("palabok", "rice noodles"): "missing from the list, only the sauce ingredients are",
    ("pancit-luglug", "shrimp cube"): "listed as 'shrimp (1 cube)'",
    ("pancit-luglug", "rice noodles"): "missing from the list, only the sauce ingredients are",
    ("pininyahang-manok", "red bell pepper"): "listed as 'black pepper (1 piece)'",
    ("tinolang-isda", "fish cube"): "listed as 'fish (1 piece)'",
    ("tortang-giniling", "ground pork"): "missing from the list",
}


def words(text):
    return re.findall(r"[a-z0-9]+", text.lower())


def ingredient_terms(recipes):
    """term -> the list label it stands for, from every label and vocabulary spelling."""
    terms = {}
    for canonical, (_display, _aisle, variants) in VOCAB.items():
        for t in [canonical, *variants, LABELS[canonical]]:
            terms.setdefault(t.lower(), LABELS[canonical])
    for r in recipes:
        for i in r["ingredients"]:
            terms[i["label"].lower()] = i["label"]
    for t in ("fish cube",):
        terms[t] = t
    for t in DROP:  # the catalogue's own call: water, ice, banana leaves, skewers are not purchases
        terms.pop(t, None)
    return terms


def check_ingredients(recipes, errors):
    terms = ingredient_terms(recipes)
    pat = re.compile(r"(?<![\w'])(" + "|".join(
        re.escape(t) for t in sorted(terms, key=len, reverse=True)) + r")(?:e?s)?(?![\w])")
    for r in recipes:
        allowed = {i["label"] for i in r["ingredients"]}
        if "salt and pepper" in allowed:
            allowed |= {"salt", "black pepper"}
        allowed |= {g for g, kids in GENERIC.items() if allowed & kids}
        for n, step in enumerate(STEPS.get(r["id"], []), 1):
            for m in pat.finditer(step.lower()):
                label = terms[m.group(1)]
                if label in allowed or (r["id"], label) in CATALOGUE_MISLABELS:
                    continue
                errors.append(f"{r['id']} step {n}: names '{m.group(1)}' ({label}), not on its list")


def comparison_pages(recipes):
    """dish id -> page URLs: its own source plus the best match on each other crawled site."""
    urls = build.harvest_urls()
    by_host = {}
    for u in urls:
        by_host.setdefault(urllib.parse.urlparse(u).netloc, []).append(u)
    terms = {did: t for items in DISHES.values() for did, _n, _a, t in items}
    pages = {}
    for r in recipes:
        own = OVERRIDES.get(r["id"]) or r["source"]
        found = {own}
        for host, host_urls in by_host.items():
            if host != urllib.parse.urlparse(own).netloc:
                u = build.pick_url(terms[r["id"]], host_urls)
                if u:
                    found.add(u)
        pages[r["id"]] = sorted(found)
    return pages


def check_copying(recipes, errors):
    report = []
    for did, urls in comparison_pages(recipes).items():
        mine = words(" ".join(STEPS.get(did, [])))
        grams = {tuple(mine[k:k + N]) for k in range(len(mine) - N + 1)}
        shared = set()
        for u in urls:
            page = build.fetch(u)
            if not page:
                print(f"  ! {did}: could not read {u}", file=sys.stderr)
                continue
            theirs = words(html.unescape(re.sub(r"<[^>]+>", " ", page)))
            shared |= grams & {tuple(theirs[k:k + N]) for k in range(len(theirs) - N + 1)}
        report.append((len(shared), did, len(urls)))
        if len(shared) > MAX_SHARED:
            runs = "; ".join(" ".join(g) for g in sorted(shared)[:5])
            errors.append(f"{did}: {len(shared)} 7-word runs shared with source pages: {runs}")
    hits = [x for x in report if x[0]]
    print(f"copying: {len(report)} dishes against {sum(x[2] for x in report)} pages; "
          f"{len(hits)} with any shared 7-word run, max {max((x[0] for x in report), default=0)}")
    for n, did, _ in sorted(hits, reverse=True):
        print(f"  {n}  {did}")


def main():
    recipes = json.loads((TOOLS.parent / "data" / "recipes.json").read_text(encoding="utf-8"))
    errors = []
    ids = {r["id"] for r in recipes}
    errors += [f"{d}: no steps" for d in sorted(ids) if not STEPS.get(d)]
    errors += [f"{d}: steps for a dish not in the catalogue" for d in sorted(set(STEPS) - ids)]
    check_ingredients(recipes, errors)
    check_copying(recipes, errors)
    for (did, term), why in CATALOGUE_MISLABELS.items():
        print(f"  catalogue fix pending: {did} needs {term}, {why}")
    words_total = sum(len(words(s)) for v in STEPS.values() for s in v)
    print(f"{len(STEPS)} dishes, {sum(len(v) for v in STEPS.values())} steps, {words_total} words")
    for e in errors:
        print("FAIL", e)
    sys.exit(1 if errors else 0)


if __name__ == "__main__":
    main()
