#!/usr/bin/env python3
"""Checks for the ingredient line parser. Run: python3 tools/test_parse.py"""
import pathlib
import sys

sys.path.insert(0, str(pathlib.Path(__file__).parent))
from parse import parse_line  # noqa: E402

CASES = [
    # line                                              qty    unit     item
    ("2 lbs. pork belly (see notes)",                   2.0,   "lb",    "pork belly"),
    ("1/4 cup sliced Leeks",                            0.25,  "cup",   "leeks"),
    ("1 1/2 tablespoons fish sauce",                    1.5,   "tbsp",  "fish sauce"),
    ("½ cup soy sauce",                            0.5,   "cup",   "soy sauce"),
    ("2-3 pieces Chinese eggplant, sliced",             2.5,   "piece", "chinese eggplant"),
    ("3 pounds oxtail, cut into serving sizes",         3.0,   "lb",    "oxtail"),
    ("1 bundle long beans (sitaw) cut into 3-inch lengths", 1.0, "bunch", "long beans sitaw"),
    ("1 lb boneless, skinless chicken thighs",          1.0,   "lb",    "skinless chicken thighs"),
    ("2 sachets 8g MAGGI® Magic Sarap®",      2.0,   "pack",  "maggi magic sarap"),
    ("1 20g pack sinigang sa sampaloc mix",             1.0,   "pack",  "sinigang sa sampaloc mix"),
    ("1 thumb-size ginger",                             1.0,   "thumb", "ginger"),
    ("salt and freshly ground black pepper",            None,  None,    "salt"),
    ("water",                                           None,  None,    "water"),
    ("water for boiling",                               None,  None,    "water"),
    ("2 tablespoons sukang iloko (see note 1)",         2.0,   "tbsp",  "sukang iloko"),
    ("1 package (16 ounces) frozen grated ube, thawed", 1.0,   "pack",  "ube"),
    ("2 packages (16 ounces each) frozen grated cassava, thawed", 2.0, "pack", "cassava"),
    ("1 package (16 ounces or two cups) frozen grated cassava", 1.0, "pack", "cassava"),
    ("1/4 pound (about 1 cup) boneless, skinless chicken breast", 0.25, "lb", "skinless chicken breast"),
]


def test_parse_lines():
    bad = []
    for line, qty, unit, item in CASES:
        got = parse_line(line)
        if got != (qty, unit, item):
            bad.append((line, (qty, unit, item), got))
    assert not bad, "\n".join(f"{l!r}\n  want {w}\n  got  {g}" for l, w, g in bad)


if __name__ == "__main__":
    test_parse_lines()
    print(f"ok  test_parse_lines ({len(CASES)} lines)")
