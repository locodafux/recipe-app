"""Resolve an ingredient string to its canonical Filipino name.

This is the merge key. Two recipes that say "tamarind" and "sampalok mix" are one
purchase, and the grocery list must collapse them to one line before it adds any
quantities up. Everything else in the app depends on this being right.

Pure and dependency-free: give it a string and the synonym map, get a name back.
"""
import json
import pathlib
import re

_WS = re.compile(r"\s+")
_PUNCT = re.compile(r"[^\w\s]")


def normalize(s):
    """Casefold, strip punctuation and collapse whitespace."""
    return _WS.sub(" ", _PUNCT.sub(" ", (s or "").lower())).strip()


def build_index(synonyms):
    """{canonical: [variants]} -> {normalized phrase: canonical}, longest phrase first.

    Longest-first matters: "tamarind mix" must win over "tamarind" so a line that
    says "tamarind mix" is not resolved by the shorter, less specific entry.
    """
    index = {}
    for canonical, variants in synonyms.items():
        for phrase in [canonical, *variants]:
            n = normalize(phrase)
            if n and (n not in index or len(n) > len(normalize(index[n]))):
                index[n] = canonical
    return dict(sorted(index.items(), key=lambda kv: -len(kv[0])))


def resolve(item, synonyms, index=None):
    """-> canonical Filipino name, or None when nothing in the map matches.

    Exact match wins. Otherwise the longest variant that appears as whole words
    inside the string wins, so "young tamarind" and "pork belly, sliced thin"
    still land on sampalok and liempo.
    """
    n = normalize(item)
    if not n:
        return None
    index = index if index is not None else build_index(synonyms)
    if n in index:
        return index[n]
    for phrase, canonical in index.items():
        if re.search(rf"(?<!\w){re.escape(phrase)}(?!\w)", n):
            return canonical
    return None


def load(path=None):
    """Load the shipped synonym map."""
    path = path or pathlib.Path(__file__).resolve().parent.parent / "data" / "synonyms.json"
    return json.loads(pathlib.Path(path).read_text(encoding="utf-8"))
