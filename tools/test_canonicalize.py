#!/usr/bin/env python3
"""Checks for the merge key. Run: python3 tools/test_canonicalize.py

The property that matters: every way the sources spell one ingredient must
collapse to exactly one canonical name. If that breaks, the grocery list shows
sampalok on three separate lines and the whole point of the app is gone.
"""
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).parent))
from canonicalize import build_index, load, normalize, resolve  # noqa: E402

SYNONYMS = load()
INDEX = build_index(SYNONYMS)


def r(s):
    return resolve(s, SYNONYMS, INDEX)


def test_readme_example_collapses():
    """The README's headline case: three spellings, one purchase."""
    spellings = ["sampalok", "tamarind", "sampaloc", "tamarind mix", "sampalok mix",
                 "Sampalok Mix", "  TAMARIND  ", "young tamarind", "sinigang mix"]
    got = {r(s) for s in spellings}
    assert got == {"sampalok"}, f"expected one canonical name, got {got}"


def test_every_shipped_variant_resolves_to_its_canonical():
    """The whole map, not just the examples: no variant may drift to another name."""
    bad = []
    for canonical, variants in SYNONYMS.items():
        for v in [canonical, *variants]:
            if r(v) != canonical:
                bad.append((v, canonical, r(v)))
    assert not bad, f"{len(bad)} variants resolve to the wrong canonical: {bad[:5]}"


def test_longest_variant_wins():
    """'tamarind mix' must not be decided by the shorter 'tamarind' entry.

    Both land on sampalok here, so assert the mechanism directly: the index is
    ordered longest phrase first.
    """
    phrases = list(INDEX)
    assert phrases == sorted(phrases, key=len, reverse=True)
    assert r("coconut cream") == "kakang gata"
    assert r("coconut milk") == "gata"


def test_resolves_inside_a_longer_line():
    """Scraped lines carry adjectives the map does not list."""
    assert r("pork belly") == "liempo"
    assert r("skinless chicken thighs") == "hita ng manok"
    assert r("fresh malunggay leaves") == "malunggay"


def test_matches_whole_words_only():
    """A variant must not fire on a fragment of an unrelated word."""
    assert r("gingerbread") != "luya"
    assert r("saltine crackers") != "asin"


def test_unknown_ingredient_is_none():
    """Unknown means unknown. Guessing here would silently merge two purchases."""
    assert r("unicorn tears") is None
    assert r("") is None
    assert r(None) is None


def test_normalize_is_case_and_punctuation_insensitive():
    assert normalize("  Soy   Sauce!  ") == "soy sauce"
    assert r("Soy Sauce") == r("soy sauce") == "toyo"


def test_merging_two_recipes_gives_one_line():
    """End to end: the reason the map exists.

    Two recipes, three spellings of the same two purchases -> two lines.
    """
    recipe_a = [("tamarind", 1), ("garlic", 3)]
    recipe_b = [("sampalok mix", 1), ("cloves garlic", 5)]
    merged = {}
    for item, qty in recipe_a + recipe_b:
        merged.setdefault(r(item), 0)
        merged[r(item)] += qty
    assert merged == {"sampalok": 2, "bawang": 8}, merged


if __name__ == "__main__":
    tests = [v for k, v in sorted(globals().items()) if k.startswith("test_")]
    for t in tests:
        t()
        print(f"ok  {t.__name__}")
    print(f"\n{len(tests)} checks passed against {len(SYNONYMS)} canonical names "
          f"({sum(len(v) for v in SYNONYMS.values())} variants)")
