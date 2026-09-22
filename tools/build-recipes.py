#!/usr/bin/env python3
"""Build data/recipes.json and data/synonyms.json from Filipino recipe sites.

BUILD-TIME ONLY. Run by hand, commit the output. This never ships in the app and
the app never calls it at runtime.

Only dish names, servings and ingredient lines are taken -- never prose, never
cooking steps, never photos. That boundary is the point: US Copyright Office
Circular 33 states a mere listing of ingredients is uncopyrightable, and an
ingredient list is the only part a grocery list needs. Every recipe records its
source URL so the app can credit it.

Usage:
    uv run --with recipe-scrapers --with requests tools/build-recipes.py
    uv run --with recipe-scrapers --with requests tools/build-recipes.py --dump-vocab
"""
import argparse
import json
import pathlib
import re
import sys
import time
import urllib.parse

import requests

sys.path.insert(0, str(pathlib.Path(__file__).parent))
from dishes import CATEGORIES, DISHES, OVERRIDES  # noqa: E402
from parse import parse_line       # noqa: E402
from vocab import AISLES, AISLE_KEYWORDS, DROP, LABELS, VOCAB  # noqa: E402

ROOT = pathlib.Path(__file__).resolve().parent.parent
DATA = ROOT / "data"
CACHE = ROOT / ".cache" / "pages"

# Be a considerate client: a real UA that says who we are, and a gap between hits.
USER_AGENT = (
    "recipe-app-build/1.0 (+https://github.com/locodafux/recipe-app; "
    "build-time recipe ingest, contact via repo issues)"
)
DELAY_SECONDS = 1.5

# Verified reachable with schema.org/Recipe markup and a usable recipeIngredient.
# pepper.ph is deliberately absent: its 761 recipe pages render ingredients
# client-side and ship zero recipeIngredient markup, so there is nothing to read.
# yummy.ph and knorr.com/ph hard-block automated access and are not touched.
SITEMAPS = [
    "https://panlasangpinoy.com/post-sitemap.xml",
    "https://panlasangpinoy.com/post-sitemap2.xml",
    "https://panlasangpinoy.com/post-sitemap3.xml",
    "https://www.kawalingpinoy.com/post-sitemap.xml",
    "https://www.nestlegoodnes.com/ph/sitemap.xml",
]

NOISE = {"recipe", "recipes", "how", "to", "cook", "easy", "best", "the", "a",
         "panlasang", "pinoy", "filipino", "style", "make", "special",
         "homemade", "simple", "quick"}

session = requests.Session()
session.headers["User-Agent"] = USER_AGENT
_blocked_hosts = set()


def fetch(url):
    """GET with an on-disk cache, a rate limit, and a hard stop on 403.

    Returns the page text, or None if the source blocked us or errored.
    """
    host = urllib.parse.urlparse(url).netloc
    if host in _blocked_hosts:
        return None
    key = re.sub(r"[^a-zA-Z0-9]+", "_", url).strip("_")[:180]
    path = CACHE / f"{key}.html"
    if path.exists():
        return path.read_text(encoding="utf-8")
    time.sleep(DELAY_SECONDS)
    try:
        r = session.get(url, timeout=45)
    except requests.RequestException as e:
        print(f"  ! {url}: {type(e).__name__}", file=sys.stderr)
        return None
    if r.status_code == 403:
        # A 403 is a "no". Record it and stop asking this host; never work around it.
        print(f"  ! {host} returned 403 -- skipping this source entirely", file=sys.stderr)
        _blocked_hosts.add(host)
        return None
    if r.status_code != 200:
        print(f"  ! {url}: HTTP {r.status_code}", file=sys.stderr)
        return None
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(r.text, encoding="utf-8")
    return r.text


def harvest_urls():
    urls = []
    for sm in SITEMAPS:
        text = fetch(sm)
        if not text:
            continue
        locs = re.findall(r"<loc>([^<]+)</loc>", text)
        if "nestlegoodnes" in sm:
            locs = [u for u in locs if "/recipes/" in u]
        urls += locs
    urls = [u for u in urls if not u.rstrip("/").endswith(("blog", "/ph"))]
    return sorted(set(urls))


def pick_url(terms, urls):
    """The least-cluttered slug containing every match term wins."""
    best = None
    for u in urls:
        slug = u.rstrip("/").split("/")[-1].lower()
        if not all(t in slug for t in terms):
            continue
        toks = [t for t in re.split(r"[-_]", slug) if t]
        extra = [t for t in toks
                 if t not in NOISE and not any(t in term or term in t for term in terms)]
        score = len(extra) * 10 + len(slug)
        if best is None or score < best[0]:
            best = (score, u)
    return best[1] if best else None


def canonical_of(item, synonyms):
    """Resolve a raw scraped item string to its canonical Filipino name, or None."""
    from canonicalize import resolve
    return resolve(item, synonyms)


def aisle_of(canonical, raw):
    """First-pass aisle. Returns None when the map cannot place it -- never a guess."""
    if canonical in VOCAB:
        return VOCAB[canonical][1]
    hay = f" {raw} "
    for kw, aisle in AISLE_KEYWORDS:
        if f" {kw} " in hay or hay.strip().endswith(" " + kw) or hay.strip() == kw:
            return aisle
    return None


def build_synonyms(observed):
    """Seed data/synonyms.json from variants ACTUALLY seen in the scraped pages.

    VOCAB is the curated Filipino vocabulary; a variant only earns a place in the
    shipped map if some source really wrote it -- with one exception. The English
    gloss in the display name ("sampalok (tamarind)" -> tamarind) always ships,
    because it is the canonical's own English name rather than an invented
    variant, and the app must still resolve it when a later import writes the
    plain English word.
    """
    # A gloss two canonicals share cannot be a merge key for either of them.
    glosses = {}
    for canonical, (display, _aisle, _aliases) in VOCAB.items():
        m = re.search(r"\(([^)]+)\)", display)
        if m:
            glosses.setdefault(m.group(1).strip(), []).append(canonical)
    unique_gloss = {c[0]: g for g, c in glosses.items() if len(c) == 1}

    def was_written(alias):
        """True if some scraped line really used this spelling.

        Whole-word, not whole-string: the sources wrote "sampaloc" inside
        "sinigang sa sampaloc mix", which is still the sources writing it.
        """
        pat = re.compile(rf"(?<!\w){re.escape(alias)}(?!\w)")
        return any(pat.search(item) for item in observed)

    out = {}
    for canonical, (_display, _aisle, aliases) in VOCAB.items():
        seen = {a for a in aliases if was_written(a)}
        if canonical in unique_gloss:
            seen.add(unique_gloss[canonical])
        if seen or canonical in observed:
            out[canonical] = sorted(seen)
    return dict(sorted(out.items()))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--dump-vocab", action="store_true",
                    help="print observed ingredient strings by frequency and exit")
    args = ap.parse_args()

    from recipe_scrapers import scrape_html

    print(f"harvesting sitemaps ({len(SITEMAPS)})...")
    urls = harvest_urls()
    print(f"  {len(urls)} candidate URLs")

    scraped, unmatched = [], []
    for cat, items in DISHES.items():
        for did, name, alt, terms in items:
            url = OVERRIDES.get(did) or pick_url(terms, urls)
            if not url:
                unmatched.append(did)
                continue
            html = fetch(url)
            if not html:
                unmatched.append(did)
                continue
            try:
                sc = scrape_html(html, org_url=url, wild_mode=True)
                lines = sc.ingredients()
                yields = sc.yields()
            except Exception as e:
                print(f"  ! {did}: {type(e).__name__}", file=sys.stderr)
                unmatched.append(did)
                continue
            if not lines:
                unmatched.append(did)
                continue
            servings = None
            m = re.search(r"\d+", yields or "")
            if m:
                servings = int(m.group())
            scraped.append({"id": did, "name": name, "alt": alt, "category": cat,
                            "servings": servings, "source": url, "lines": lines})
    print(f"scraped {len(scraped)} recipes; {len(unmatched)} unmatched: {unmatched}")

    parsed = [(r, [parse_line(ln) for ln in r["lines"]]) for r in scraped]
    observed = set()
    for _r, rows in parsed:
        for _q, _u, item in rows:
            if item:
                observed.add(item)

    if args.dump_vocab:
        from collections import Counter
        c = Counter()
        for _r, rows in parsed:
            for _q, _u, item in rows:
                if item:
                    c[item] += 1
        for item, n in c.most_common():
            print(f"{n}\t{item}")
        return

    synonyms = build_synonyms(observed)
    DATA.mkdir(exist_ok=True)
    (DATA / "synonyms.json").write_text(
        json.dumps(synonyms, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"wrote data/synonyms.json ({len(synonyms)} canonical names)")

    recipes, unplaced = [], set()
    for r, rows in parsed:
        ings = []
        for qty, unit, item in rows:
            if not item or item in DROP:
                continue
            canonical = canonical_of(item, synonyms)
            display = VOCAB[canonical][0] if canonical in VOCAB else None
            aisle = aisle_of(canonical, item)
            if aisle is None:
                unplaced.add(item)
            ings.append({"item": display or item, "label": LABELS.get(canonical, item),
                         "qty": qty, "unit": unit, "aisle": aisle})
        if not ings:
            continue
        recipes.append({"id": r["id"], "name": r["name"], "alt": r["alt"],
                        "category": r["category"], "servings": r["servings"],
                        "source": r["source"], "ingredients": ings})

    (DATA / "recipes.json").write_text(
        json.dumps(recipes, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    total = sum(len(r["ingredients"]) for r in recipes)

    # English display text for the app. Keys are the Filipino values used in
    # recipes.json and synonyms.json; list order is display order.
    labels = {
        "aisles": [{"key": k, "label": v} for k, v in AISLES.items()],
        "categories": [{"key": k, "label": v} for k, v in CATEGORIES.items()],
        "ingredients": {c: LABELS[c] for c in synonyms},
    }
    (DATA / "labels.json").write_text(
        json.dumps(labels, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"wrote data/recipes.json ({len(recipes)} recipes, {total} ingredient lines)")
    print(f"aisle unplaced: {len(unplaced)} distinct items "
          f"(aisle=null in the output, for the M4 human pass)")


if __name__ == "__main__":
    main()
