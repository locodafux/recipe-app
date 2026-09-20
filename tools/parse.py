"""Parse a scraped ingredient line into (qty, unit, item).

Lines look like: "2 lbs. pork belly (see notes)", "1/4 cup sliced Leeks",
"1 bundle long beans (sitaw) cut into 3-inch lengths", "salt to taste".
"""
import re
from fractions import Fraction

UNICODE_FRACTIONS = {
    "¼": ".25", "½": ".5", "¾": ".75", "⅓": ".333",
    "⅔": ".667", "⅛": ".125", "⅜": ".375", "⅝": ".625",
    "⅞": ".875", "⅙": ".167", "⅚": ".833",
}

# canonical unit -> spellings seen in the wild
UNITS = {
    "g": ["grams", "gram", "g."],
    "kg": ["kilograms", "kilogram", "kilo", "kilos", "kg."],
    "lb": ["pounds", "pound", "lbs", "lbs.", "lb."],
    "oz": ["ounces", "ounce", "oz."],
    "ml": ["milliliters", "milliliter", "ml."],
    "l": ["liters", "liter", "litre", "litres", "l."],
    "cup": ["cups"],
    "tbsp": ["tablespoons", "tablespoon", "tbsps", "tbs", "tbsp."],
    "tsp": ["teaspoons", "teaspoon", "tsps", "tsp."],
    "clove": ["cloves"],
    "piece": ["pieces", "pcs", "pcs.", "pc", "pc.", "pieces", "medium", "mediums",
              "large", "small", "whole"],
    "bunch": ["bunches", "bundle", "bundles"],
    "pack": ["packs", "packet", "packets", "sachet", "sachets", "pouch", "pouches",
             "bag", "bags", "box", "boxes"],
    "can": ["cans", "tin", "tins"],
    "bottle": ["bottles"],
    "stalk": ["stalks"],
    "head": ["heads"],
    "slice": ["slices"],
    "pinch": ["pinches"],
    "dash": ["dashes"],
    "cube": ["cubes"],
    "knob": ["knobs"],
    "thumb": ["thumbs"],
    "sheet": ["sheets"],
    "drop": ["drops"],
}
UNIT_LOOKUP = {}
for _canon, _alts in UNITS.items():
    UNIT_LOOKUP[_canon] = _canon
    for _a in _alts:
        UNIT_LOOKUP[_a] = _canon

# prep words that describe what you do to an ingredient, not what you buy
PREP = re.compile(
    r"\b(chopped|sliced|minced|diced|cubed|crushed|peeled|grated|shredded|beaten|"
    r"cut|trimmed|cleaned|washed|rinsed|drained|julienned|quartered|halved|"
    r"pounded|mashed|toasted|roasted|ground|softened|melted|thawed|deveined|"
    r"deboned|skinned|scaled|gutted|squeezed|strained|separated|divided|"
    r"finely|thinly|roughly|coarsely|lightly|freshly|optional|to taste|"
    r"for frying|for garnish|for serving|as needed|see notes|plus more|if desired)\b",
    re.I,
)
NUM = r"\d+(?:[.,]\d+)?(?:\s*/\s*\d+)?"

# Words that only describe an ingredient. A comma segment made of nothing but
# these is not the ingredient: "boneless, skinless chicken thighs" is chicken.
DESCRIPTORS = {
    "boneless", "skinless", "bone-in", "skin-on", "lean", "fresh", "frozen",
    "ripe", "unripe", "large", "small", "medium", "whole", "young", "old",
    "dried", "raw", "cooked", "uncooked", "soft", "hard", "thick", "thin",
    "big", "long", "short", "extra", "plus", "more", "about", "around",
}


def _to_float(text):
    text = text.replace(",", ".").strip()
    try:
        if "/" in text:
            parts = text.split()
            total = 0.0
            for p in parts:
                total += float(Fraction(p.replace(" ", "")))
            return round(total, 3)
        return float(text)
    except (ValueError, ZeroDivisionError):
        return None


def parse_line(line):
    """-> (qty: float|None, unit: str|None, item: str). item may be '' if unparseable."""
    s = line.strip()
    for ch, dec in UNICODE_FRACTIONS.items():
        # "1½" -> "1.5", bare "½" -> "0.5"
        s = re.sub(r"(\d)\s*" + re.escape(ch), lambda m, d=dec: m.group(1) + d, s)
        s = s.replace(ch, "0" + dec)
    s = re.sub(r"\(([^)]*)\)", r" \1 ", s)  # unwrap parentheses, keep the words
    s = re.sub(r"\s+", " ", s).strip()

    qty = None
    # "2-3", "2 to 3", "1 1/2", "1/2", "2"
    m = re.match(rf"^({NUM})\s*(?:-|–|to)\s*({NUM})\b", s)
    if m:
        lo, hi = _to_float(m.group(1)), _to_float(m.group(2))
        qty = hi if lo is None else (lo if hi is None else round((lo + hi) / 2, 3))
        s = s[m.end():].strip()
    else:
        m = re.match(rf"^(\d+\s+\d+\s*/\s*\d+|{NUM})\b", s)
        if m:
            qty = _to_float(m.group(1))
            s = s[m.end():].strip()

    # "1 20g pack ..." -- a pack-size spec sitting between the count and the unit
    s = re.sub(r"^\d+\s*(?:g|kg|ml|l|oz|lb|grams?|ounces?)\b\.?\s*", "", s, flags=re.I)

    unit = None
    m = re.match(r"^([A-Za-z.]+)\b", s)
    if m:
        cand = m.group(1).lower().rstrip(".")
        if cand in UNIT_LOOKUP or cand + "." in UNIT_LOOKUP:
            unit = UNIT_LOOKUP.get(cand, UNIT_LOOKUP.get(cand + "."))
            s = s[m.end():].strip()
            # "2 cups of water"
            s = re.sub(r"^of\b", "", s, flags=re.I).strip()

    # First comma segment that is more than descriptors.
    item = s
    for seg in s.split(","):
        if seg.strip() and not set(seg.lower().split()) <= DESCRIPTORS:
            item = seg
            break
    # strip leading prep words ("sliced Leeks"), then cut at the first remaining one
    # ("long beans sitaw cut into 3-inch lengths" -> "long beans sitaw")
    while True:
        m = PREP.match(item.strip())
        if not m:
            break
        item = item.strip()[m.end():]
    m = PREP.search(item)
    if m:
        item = item[: m.start()]
    item = re.sub(r"\b\d+[- ]?(inch|cm|mm)\b", " ", item, flags=re.I)
    # "2 sachets 8g MAGGI ..." -> drop the leftover pack-size spec
    item = re.sub(r"^\s*\d+\s*(g|kg|ml|l|oz|lb|grams?|ounces?)\b", " ", item, flags=re.I)
    # "1 thumb-size ginger" -> "ginger"
    item = re.sub(r"\b(thumb|inch|finger)?[- ]?sized?\b", " ", item, flags=re.I)
    item = re.sub(r"[^\w\s'&-]", " ", item)
    item = re.sub(r"\s+", " ", item).strip(" -&").lower()
    item = re.sub(r"\s+(and|or|with|plus|of|for)$", "", item).strip()
    return qty, unit, item
