"""Curated Filipino ingredient vocabulary: the source of the synonym map and the
first-pass aisle tags.

    canonical Filipino name -> (display, aisle, [variants to fold into it])

Naming follows the README: Filipino first with English in brackets where a useful
English word exists (sampalok (tamarind), gabi (taro)), Filipino alone where it
does not (kangkong, bagoong alamang). Where no Filipino word is in common use --
bell pepper, oyster sauce -- the English stands alone rather than inventing one.

The display name is the data's `item`; the app shows the English LABELS below.

Variants are candidates only. data/synonyms.json ships just the ones some source
actually wrote; see build_synonyms() in build-recipes.py.

Aisles are the palengke sections from README section 5: gulay, karne, isda,
dry goods. Anything this map cannot place gets aisle=null in the output so the
M4 human pass can find it -- a wrong guess is worse than an honest blank.
"""

import re

G, K, I, D = "gulay", "karne", "isda", "dry goods"

# English UI names. The Filipino keys stay the data values and the merge key; these
# are display text only. Dict order is the walk order through the palengke (D2:
# dry before wet), so the shopping list shows sections in this order.
AISLES = {G: "Vegetables", D: "Dry goods", I: "Fish & seafood", K: "Meat"}

VOCAB = {
    # ---- gulay: produce, fresh herbs, chillies ------------------------------
    "bawang": ("bawang (garlic)", G, ["garlic", "garlic cloves", "cloves garlic", "fresh garlic", "minced garlic", "crushed garlic"]),
    "sibuyas": ("sibuyas (onion)", G, ["onion", "onions", "yellow onion", "red onion", "white onion", "medium onion", "large onion", "small onion", "yellow onion wedged", "onion wedged"]),
    "sibuyas na mura": ("sibuyas na mura (spring onion)", G, ["green onion", "green onions", "scallion", "scallions", "spring onion", "spring onions"]),
    "shallots": ("shallots (sibuyas tagalog)", G, ["shallots", "shallot", "sibuyas tagalog"]),
    "luya": ("luya (ginger)", G, ["ginger", "fresh ginger", "ginger root"]),
    "kamatis": ("kamatis (tomato)", G, ["tomato", "tomatoes", "roma tomatoes", "tomato wedged", "fresh tomatoes"]),
    "talong": ("talong (eggplant)", G, ["eggplant", "eggplants", "chinese eggplant", "japanese eggplant"]),
    "patatas": ("patatas (potato)", G, ["potato", "potatoes"]),
    "kamote": ("kamote (sweet potato)", G, ["sweet potato", "sweet potatoes", "camote"]),
    "karot": ("karot (carrot)", G, ["carrot", "carrots", "large carrot", "carrot julienne"]),
    "repolyo": ("repolyo (cabbage)", G, ["cabbage", "green cabbage"]),
    "wombok": ("wombok (napa cabbage)", G, ["napa cabbage", "chinese cabbage"]),
    "pechay": ("pechay (bok choy)", G, ["bok choy", "pak choy", "pechay", "baby bok choy"]),
    "sitaw": ("sitaw (string beans)", G, ["string beans", "long beans", "long green beans", "yardlong beans", "snake beans"]),
    "baguio beans": ("baguio beans (green beans)", G, ["green beans", "french beans"]),
    "sitsaro": ("sitsaro (snow peas)", G, ["snow peas", "sugar snap peas"]),
    "gisantes": ("gisantes (green peas)", G, ["green peas", "frozen green peas", "frozen sweet peas", "sweet peas", "peas"]),
    "kangkong": ("kangkong", G, ["water spinach", "ong choy", "onchoy", "swamp cabbage", "kangkong picked leaves and tender stems"]),
    "gabi": ("gabi (taro)", G, ["taro", "taro root", "taro corms"]),
    "dahon ng gabi": ("dahon ng gabi (taro leaves)", G, ["taro leaves", "dried taro leaves"]),
    "kalabasa": ("kalabasa (squash)", G, ["squash", "kabocha squash", "pumpkin", "butternut squash"]),
    "sayote": ("sayote (chayote)", G, ["chayote", "christophene"]),
    "upo": ("upo (bottle gourd)", G, ["bottle gourd", "opo squash"]),
    "patola": ("patola (sponge gourd)", G, ["sponge gourd", "luffa", "ridge gourd"]),
    "ampalaya": ("ampalaya (bitter gourd)", G, ["bitter gourd", "bitter melon", "bitter gourds"]),
    "labanos": ("labanos (radish)", G, ["daikon radish", "radish", "white radish", "daikon"]),
    "okra": ("okra", G, ["okra", "lady finger"]),
    "malunggay": ("malunggay (moringa)", G, ["malunggay leaves", "moringa", "moringa leaves", "drumstick leaves"]),
    "togue": ("togue (bean sprouts)", G, ["bean sprouts", "mung bean sprouts", "beansprouts"]),
    "tanglad": ("tanglad (lemongrass)", G, ["lemongrass", "lemon grass"]),
    "pandan": ("pandan", G, ["pandan leaf", "pandan leaves", "screwpine leaves"]),
    "kintsay": ("kintsay (celery)", G, ["celery", "celery stalks"]),
    "perehil": ("perehil (parsley)", G, ["parsley", "fresh parsley", "flat leaf parsley"]),
    "spinach": ("spinach", G, ["fresh spinach", "baby spinach"]),
    "letsugas": ("letsugas (lettuce)", G, ["lettuce", "romaine lettuce", "iceberg lettuce"]),
    "pipino": ("pipino (cucumber)", G, ["cucumber", "cucumbers"]),
    "singkamas": ("singkamas (jicama)", G, ["jicama", "turnip"]),
    "ubod": ("ubod (heart of palm)", G, ["heart of palm", "hearts of palm", "palm heart"]),
    "puso ng saging": ("puso ng saging (banana heart)", G, ["banana heart", "banana blossom", "banana blossoms"]),
    "kamias": ("kamias", G, ["bilimbi", "kamias"]),
    "langka": ("langka (jackfruit)", G, ["jackfruit", "green jackfruit", "unripe jackfruit"]),
    "saging": ("saging (banana)", G, ["banana", "bananas", "saba", "saba banana", "saba bananas", "plantain"]),
    "mangga": ("mangga (mango)", G, ["mango", "mangoes", "ripe mango", "ripe mangoes"]),
    "pinya": ("pinya (pineapple)", G, ["pineapple", "fresh pineapple"]),
    "buko": ("buko (young coconut)", G, ["young coconut", "young coconut meat", "buko strips"]),
    "niyog": ("niyog (coconut)", G, ["coconut", "mature coconut", "grated coconut", "desiccated coconut"]),
    "ube": ("ube (purple yam)", G, ["purple yam", "ube halaya", "grated ube"]),
    "kasaba": ("kasaba (cassava)", G, ["cassava", "grated cassava", "kamoteng kahoy"]),
    "mais": ("mais (corn)", G, ["corn", "sweet corn", "corn kernels", "white corn", "boiled white corn"]),
    "kalamansi": ("kalamansi (calamansi)", G, ["calamansi", "calamansi juice", "calamondin", "calamansi or lemon", "calamansi or lemon juice", "lemon or calamansi juice"]),
    "lemon": ("lemon", G, ["lemon", "lemons", "lemon juice", "lemon juice or vinegar"]),
    "kabute": ("kabute (mushroom)", G, ["button mushrooms", "mushrooms", "shiitake mushrooms", "straw mushrooms"]),
    "siling haba": ("siling haba (long green chili)", G, ["long green pepper", "long green chili", "siling panigang", "siling pansigang", "long green pepper siling pansigang", "long green chili siling pansigang", "finger chili", "banana pepper"]),
    "siling labuyo": ("siling labuyo (bird's eye chili)", G, ["thai chili", "thai chili pepper", "thai chili peppers", "thai chili peppers stemmed", "birds eye chili", "red chili", "red chilies", "dried chilies", "chili peppers"]),
    "red bell pepper": ("red bell pepper", G, ["red bell pepper", "red bell peppers"]),
    "green bell pepper": ("green bell pepper", G, ["green bell pepper", "green bell peppers", "bell pepper", "bell peppers"]),
    "dahon ng sili": ("dahon ng sili (chili leaves)", G, ["chili leaves", "pepper leaves"]),

    # ---- karne: meat and poultry -------------------------------------------
    "baboy": ("baboy (pork)", K, ["pork", "pork cubes", "pork meat"]),
    "liempo": ("liempo (pork belly)", K, ["pork belly", "pork liempo", "skin-on pork belly"]),
    "kasim": ("kasim (pork shoulder)", K, ["pork shoulder", "pork butt", "boston butt"]),
    "pata": ("pata (pork hock)", K, ["pork hock", "pork leg", "pork knuckles", "pig trotters"]),
    "buto-buto ng baboy": ("buto-buto ng baboy (pork ribs)", K, ["pork ribs", "pork spare ribs", "spare ribs", "baby back ribs"]),
    "giniling na baboy": ("giniling na baboy (ground pork)", K, ["ground pork", "minced pork"]),
    "atay ng baboy": ("atay ng baboy (pork liver)", K, ["pork liver", "pig liver"]),
    "taba ng baboy": ("taba ng baboy (pork fat)", K, ["pork fat", "lard", "fatback"]),
    "manok": ("manok (chicken)", K, ["chicken", "whole chicken", "chicken cut into serving pieces"]),
    "hita ng manok": ("hita ng manok (chicken thighs)", K, ["chicken thighs", "chicken thigh", "bone-in chicken thighs"]),
    "pakpak ng manok": ("pakpak ng manok (chicken wings)", K, ["chicken wings", "chicken wing"]),
    "dibdib ng manok": ("dibdib ng manok (chicken breast)", K, ["chicken breast", "chicken breasts", "boneless chicken breast"]),
    "atay ng manok": ("atay ng manok (chicken liver)", K, ["chicken liver", "chicken livers"]),
    "baka": ("baka (beef)", K, ["beef", "beef cubes", "beef chuck", "beef brisket", "beef sirloin", "beef round"]),
    "bulalo": ("bulalo (beef shank)", K, ["beef shank", "beef shanks", "bone marrow", "beef shank with bone marrow"]),
    "buntot ng baka": ("buntot ng baka (oxtail)", K, ["oxtail", "ox tail"]),
    "giniling na baka": ("giniling na baka (ground beef)", K, ["ground beef", "minced beef"]),
    "atay ng baka": ("atay ng baka (beef liver)", K, ["beef liver", "ox liver"]),
    "dila ng baka": ("dila ng baka (ox tongue)", K, ["ox tongue", "beef tongue", "lengua"]),
    "tripe": ("tripe (goto)", K, ["beef tripe", "tripe", "ox tripe"]),
    "kambing": ("kambing (goat)", K, ["goat meat", "goat", "mutton"]),
    "chorizo": ("chorizo", K, ["chorizo de bilbao", "chorizo", "spanish chorizo"]),
    "longganisa": ("longganisa", K, ["longganisa", "filipino sausage", "longanisa"]),
    "chinese sausage": ("chinese sausage", K, ["chinese sausage", "chinese sausages", "lap cheong"]),
    "hotdog": ("hotdog", K, ["hotdog", "hot dogs", "hotdogs"]),
    "bacon": ("bacon", K, ["bacon", "bacon strips"]),
    "ham": ("ham (hamon)", K, ["ham", "cooked ham"]),
    "chicharon": ("chicharon (pork cracklings)", K, ["chicharon", "pork cracklings", "pork cracklings chicharon", "pork rinds", "chicharron"]),

    # ---- isda: fish and seafood --------------------------------------------
    "isda": ("isda (fish)", I, ["fish", "fish fillet", "white fish"]),
    "bangus": ("bangus (milkfish)", I, ["milkfish", "bangus belly", "boneless bangus"]),
    "tilapia": ("tilapia", I, ["tilapia", "whole tilapia"]),
    "tanigue": ("tanigue (spanish mackerel)", I, ["spanish mackerel", "tanigue", "wahoo"]),
    "galunggong": ("galunggong (round scad)", I, ["round scad", "galunggong", "mackerel scad"]),
    "tulingan": ("tulingan (bullet tuna)", I, ["bullet tuna", "tulingan", "skipjack"]),
    "tuna": ("tuna", I, ["tuna", "tuna steak", "yellowfin tuna", "canned tuna"]),
    "salmon": ("salmon", I, ["salmon", "salmon belly", "salmon head"]),
    "hipon": ("hipon (shrimp)", I, ["shrimp", "shrimps", "large shrimp", "large shrimps", "medium shrimp", "prawns"]),
    "sugpo": ("sugpo (prawn)", I, ["tiger prawn", "tiger prawns", "jumbo prawns", "sugpo"]),
    "pusit": ("pusit (squid)", I, ["squid", "squids", "baby squid", "calamari"]),
    "alimasag": ("alimasag (crab)", I, ["crab", "crabs", "blue crab", "blue crabs", "mud crab"]),
    "tahong": ("tahong (mussels)", I, ["mussels", "green mussels", "tahong"]),
    "halaan": ("halaan (clams)", I, ["clams", "manila clams", "halaan"]),
    "tinapa": ("tinapa (smoked fish)", I, ["smoked fish", "tinapa flakes", "smoked milkfish"]),
    "tuyo": ("tuyo (dried fish)", I, ["dried fish", "dried herring", "daing"]),
    "dilis": ("dilis (anchovies)", I, ["anchovies", "dried anchovies", "dilis"]),

    # ---- dry goods: sauces, seasonings, grains, canned, baking, dairy -------
    "toyo": ("toyo (soy sauce)", D, ["soy sauce", "light soy sauce", "dark soy sauce"]),
    "patis": ("patis (fish sauce)", D, ["fish sauce", "fish sauce patis"]),
    "suka": ("suka (vinegar)", D, ["vinegar", "white vinegar", "cane vinegar", "coconut vinegar", "spiced vinegar", "apple cider vinegar"]),
    "bagoong alamang": ("bagoong alamang", D, ["shrimp paste", "bagoong alamang", "bagoong", "sauteed shrimp paste"]),
    "bagoong isda": ("bagoong isda (fermented fish paste)", D, ["fermented fish paste", "bagoong isda", "anchovy sauce"]),
    "asin": ("asin (salt)", D, ["salt", "rock salt", "iodized salt", "sea salt", "table salt", "kosher salt"]),
    "paminta": ("paminta (black pepper)", D, ["black pepper", "pepper", "ground black pepper", "peppercorns", "peppercorn", "whole peppercorn", "whole peppercorns", "pepper corns", "cracked black pepper"]),
    "asin at paminta": ("asin at paminta (salt and pepper)", D, ["salt and pepper", "salt and ground black pepper"]),
    "asukal": ("asukal (sugar)", D, ["sugar", "white sugar", "granulated sugar", "refined sugar"]),
    "asukal na pula": ("asukal na pula (brown sugar)", D, ["brown sugar", "dark brown sugar", "light brown sugar", "muscovado"]),
    "mantika": ("mantika (cooking oil)", D, ["cooking oil", "canola oil", "vegetable oil", "corn oil", "oil", "peanut oil", "sunflower oil"]),
    "olive oil": ("olive oil", D, ["olive oil", "extra virgin olive oil"]),
    "langis ng linga": ("langis ng linga (sesame oil)", D, ["sesame oil", "toasted sesame oil"]),
    "bigas": ("bigas (rice)", D, ["rice", "white rice", "jasmine rice", "cooked rice", "long grain rice"]),
    "malagkit": ("malagkit (glutinous rice)", D, ["glutinous rice", "sticky rice", "sweet rice"]),
    "harina": ("harina (flour)", D, ["flour", "all-purpose flour", "all purpose flour", "cake flour", "bread flour"]),
    "galapong": ("galapong (rice flour)", D, ["rice flour", "glutinous rice flour", "sweet rice flour"]),
    "gawgaw": ("gawgaw (cornstarch)", D, ["cornstarch", "corn starch", "corn flour"]),
    "gata": ("gata (coconut milk)", D, ["coconut milk", "canned coconut milk"]),
    "kakang gata": ("kakang gata (coconut cream)", D, ["coconut cream", "coconut cream kakang gata", "thick coconut milk"]),
    "sampalok": ("sampalok (tamarind)", D, ["tamarind", "sampaloc", "tamarind mix", "sampalok mix", "young tamarind", "sinigang mix", "sinigang sa sampaloc mix", "tamarind soup base", "maggi magic sinigang original sampalok mix", "maggi magic sinigang", "tamarind paste"]),
    "laurel": ("laurel (bay leaf)", D, ["bay leaf", "bay leaves", "dried bay leaves", "laurel leaves"]),
    "atsuete": ("atsuete (annatto)", D, ["annatto powder", "annatto seeds", "atsuete powder", "atsuete seeds", "achuete", "annatto oil"]),
    "sarsa ng kamatis": ("sarsa ng kamatis (tomato sauce)", D, ["tomato sauce"]),
    "tomato paste": ("tomato paste", D, ["tomato paste"]),
    "ketsup": ("ketsup (banana ketchup)", D, ["banana ketchup", "ketchup", "tomato ketchup"]),
    "oyster sauce": ("oyster sauce", D, ["oyster sauce", "maggi oyster sauce"]),
    "mantikilya ng mani": ("mantikilya ng mani (peanut butter)", D, ["peanut butter"]),
    "mani": ("mani (peanuts)", D, ["peanuts", "roasted peanuts", "ground peanuts"]),
    "kasoy": ("kasoy (cashew)", D, ["cashews", "unsalted cashews", "cashew nuts"]),
    "gatas": ("gatas (milk)", D, ["milk", "fresh milk", "whole milk", "lukewarm milk", "cow's milk"]),
    "gatas na evaporada": ("gatas na evaporada (evaporated milk)", D, ["evaporated milk"]),
    "gatas na kondensada": ("gatas na kondensada (condensed milk)", D, ["condensed milk", "sweetened condensed milk", "nestlé carnation condensada", "carnation condensada"]),
    "all purpose cream": ("all purpose cream", D, ["all purpose cream", "all-purpose cream", "table cream", "nestlé all purpose cream", "heavy cream", "whipping cream"]),
    "keso": ("keso (cheese)", D, ["cheese", "cheddar cheese", "processed cheese", "american processed cheese", "processed cheese eden brand", "quickmelt cheese"]),
    "keso de bola": ("keso de bola (edam cheese)", D, ["keso de bola", "edam cheese"]),
    "itlog": ("itlog (egg)", D, ["egg", "eggs", "raw eggs", "whole eggs"]),
    "itlog na pula": ("itlog na pula (egg yolk)", D, ["egg yolk", "egg yolks"]),
    "puti ng itlog": ("puti ng itlog (egg white)", D, ["egg white", "egg whites"]),
    "itlog na maalat": ("itlog na maalat (salted egg)", D, ["salted eggs", "salted egg", "salted duck egg"]),
    "itlog na pinakuluan": ("itlog na pinakuluan (hard-boiled egg)", D, ["hard boiled eggs", "hard-boiled eggs", "hardboiled eggs", "eggs boiled", "boiled eggs"]),
    "itlog ng pugo": ("itlog ng pugo (quail eggs)", D, ["quail eggs", "quail egg"]),
    "mantikilya": ("mantikilya (butter)", D, ["butter", "unsalted butter", "salted butter", "margarine"]),
    "sotanghon": ("sotanghon (glass noodles)", D, ["glass noodles", "cellophane noodles", "vermicelli noodles", "mung bean noodles"]),
    "bihon": ("bihon (rice noodles)", D, ["rice noodles", "rice sticks", "rice vermicelli"]),
    "pancit canton": ("pancit canton (egg noodles)", D, ["egg noodles", "flour sticks", "canton noodles"]),
    "miki": ("miki (fresh egg noodles)", D, ["fresh egg noodles", "miki noodles"]),
    "misua": ("misua (wheat vermicelli)", D, ["wheat vermicelli", "misua noodles"]),
    "spaghetti": ("spaghetti", D, ["spaghetti", "spaghetti noodles", "spaghetti pasta"]),
    "macaroni": ("macaroni", D, ["macaroni", "elbow macaroni", "salad macaroni"]),
    "balat ng lumpia": ("balat ng lumpia (lumpia wrapper)", D, ["lumpia wrapper", "lumpia wrappers", "spring roll wrappers", "spring roll wrapper"]),
    "balat ng siomai": ("balat ng siomai (wonton wrapper)", D, ["wonton wrapper", "wonton wrappers", "molo wrapper", "molo wrappers"]),
    "monggo": ("monggo (mung beans)", D, ["mung beans", "monggo beans", "green mung beans"]),
    "garbanzos": ("garbanzos (chickpeas)", D, ["garbanzo beans", "chickpeas", "garbanzos"]),
    "pinya sa lata": ("pinya sa lata (canned pineapple)", D, ["pineapple chunks", "pineapple tidbits", "crushed pineapple", "canned pineapple"]),
    "katas ng pinya": ("katas ng pinya (pineapple juice)", D, ["pineapple juice"]),
    "fruit cocktail": ("fruit cocktail", D, ["fruit cocktail", "canned fruit cocktail", "large fruit cocktail"]),
    "nata de coco": ("nata de coco", D, ["nata de coco", "coconut gel nata de coco", "coconut gel"]),
    "kaong": ("kaong (sugar palm fruit)", D, ["sugar palm fruit", "kaong"]),
    "sago": ("sago (tapioca pearls)", D, ["tapioca pearls", "sago pearls", "sago"]),
    "gulaman": ("gulaman (agar-agar)", D, ["agar agar", "gulaman bar", "gelatin", "clear unflavored gelatin", "unflavored gelatin"]),
    "pasas": ("pasas (raisins)", D, ["raisins", "golden raisins"]),
    "liver spread": ("liver spread", D, ["liver spread", "liverwurst"]),
    "green olives": ("green olives", D, ["green olives", "stuffed olives", "olives"]),
    "pickle relish": ("pickle relish", D, ["pickle relish", "sweet pickle relish", "pickles"]),
    "lihiya": ("lihiya (lye water)", D, ["lye water", "lihiya"]),
    "baking powder": ("baking powder", D, ["baking powder"]),
    "baking soda": ("baking soda", D, ["baking soda", "sodium bicarbonate"]),
    "vanilla": ("vanilla", D, ["vanilla extract", "vanilla essence", "vanilla"]),
    "cream of tartar": ("cream of tartar", D, ["cream of tartar"]),
    "asukal na pulbos": ("asukal na pulbos (powdered sugar)", D, ["powdered sugar", "confectioners sugar", "icing sugar"]),
    "breadcrumbs": ("breadcrumbs (pambalot na tinapay)", D, ["bread crumbs", "breadcrumbs", "fine breadcrumbs", "panko"]),
    "graham crackers": ("graham crackers", D, ["graham crackers", "graham cracker crumbs", "crushed graham crackers"]),
    "broas": ("broas (ladyfingers)", D, ["ladyfingers", "broas"]),
    "tinapay": ("tinapay (bread)", D, ["bread", "loaf bread", "white bread"]),
    "pandesal": ("pandesal", D, ["pandesal", "pan de sal"]),
    "yeast": ("yeast (lebadura)", D, ["active dry yeast", "instant yeast", "dry yeast", "yeast"]),
    "sabaw ng manok": ("sabaw ng manok (chicken broth)", D, ["chicken broth", "chicken stock"]),
    "sabaw ng baka": ("sabaw ng baka (beef broth)", D, ["beef broth", "beef stock"]),
    "chicken cube": ("chicken cube", D, ["chicken cube", "knorr chicken cube", "chicken bouillon", "chicken cubes"]),
    "beef cube": ("beef cube", D, ["beef cube", "knorr beef cube", "beef bouillon", "beef cubes"]),
    "pork cube": ("pork cube", D, ["pork cube", "knorr pork cube", "pork broth cube"]),
    "shrimp cube": ("shrimp cube", D, ["shrimp cube", "knorr shrimp cube"]),
    "liquid seasoning": ("liquid seasoning", D, ["liquid seasoning", "knorr liquid seasoning", "seasoning sauce"]),
    "magic sarap": ("magic sarap (all-in-one seasoning)", D, ["maggi magic sarap", "magic sarap", "maggi supreme sarap", "all in one seasoning"]),
    "ginisa mix": ("ginisa mix (saute seasoning)", D, ["maggi ginisahog", "ginisa mix", "ginisa seasoning mix"]),
    "paprika": ("paprika", D, ["paprika", "smoked paprika", "sweet paprika"]),
    "pulbos na bawang": ("pulbos na bawang (garlic powder)", D, ["garlic powder"]),
    "pulbos na sibuyas": ("pulbos na sibuyas (onion powder)", D, ["onion powder"]),
    "luyang dilaw": ("luyang dilaw (turmeric)", D, ["turmeric", "turmeric powder", "ground turmeric"]),
    "star anise": ("star anise", D, ["star anise", "anise star"]),
    "chili flakes": ("chili flakes", D, ["chili flakes", "red chili pepper flakes", "red pepper flakes", "crushed red pepper"]),
    "curry powder": ("curry powder", D, ["curry powder", "yellow curry powder"]),
    "chinese cooking wine": ("chinese cooking wine", D, ["chinese cooking wine", "shaoxing wine", "rice wine"]),
    "softdrinks": ("softdrinks (lemon-lime soda)", D, ["7-up or sprite", "lemon lime soda", "sprite", "7up"]),
    "kape": ("kape (coffee)", D, ["instant coffee", "brewed coffee", "coffee"]),
    "tsokolate": ("tsokolate (cocoa)", D, ["cocoa powder", "unsweetened cocoa", "tablea", "chocolate"]),
    "ube extract": ("ube extract", D, ["ube extract", "ube flavoring"]),
    "pinipig": ("pinipig (pounded young rice)", D, ["pinipig", "pounded young rice"]),
    "leeks": ("leeks", G, ["leeks", "leek"]),
}

# English display label per canonical: the English gloss from the display name
# ("sampalok (tamarind)" -> tamarind), else the name itself. Names with no useful
# English word stay as they are (kangkong, bagoong alamang, okra). EN_OVERRIDE
# covers the display names whose bracket holds Filipino, not English.
EN_OVERRIDE = {
    "shallots": "shallots",
    "tripe": "tripe",
    "ham": "ham",
    "breadcrumbs": "breadcrumbs",
    "yeast": "yeast",
}


def _english(canonical, display):
    if canonical in EN_OVERRIDE:
        return EN_OVERRIDE[canonical]
    m = re.search(r"\(([^)]+)\)", display)
    return m.group(1).strip() if m else display


LABELS = {c: _english(c, display) for c, (display, _a, _v) in VOCAB.items()}

# Conservative fallback for items the vocabulary does not list. Only patterns that
# cannot plausibly land in the wrong section -- everything else gets aisle=null.
AISLE_KEYWORDS = [
    ("pork", "karne"), ("beef", "karne"), ("chicken", "karne"), ("goat", "karne"),
    ("meat", "karne"), ("sausage", "karne"), ("bacon", "karne"),
    ("fish", "isda"), ("shrimp", "isda"), ("prawn", "isda"), ("squid", "isda"),
    ("crab", "isda"), ("clam", "isda"), ("mussel", "isda"), ("seafood", "isda"),
    ("flour", "dry goods"), ("sugar", "dry goods"), ("noodles", "dry goods"),
    ("sauce", "dry goods"), ("oil", "dry goods"), ("vinegar", "dry goods"),
    ("milk", "dry goods"), ("cheese", "dry goods"), ("powder", "dry goods"),
    ("extract", "dry goods"),
]

# Not a purchase. Water comes out of a tap; ice is made from it.
DROP = {
    "water", "cold water", "warm water", "hot water", "ice water", "boiling water",
    "quarts water", "cups water", "ice", "ice cubes", "crushed ice", "shaved ice",
    "", "none", "n a",
    # equipment and leftovers of the recipe's own prose -- not things you buy
    "funnel", "kitchen twine", "toothpicks", "banana leaves", "aluminum foil",
    "cheesecloth", "skewers", "bamboo skewers", "reserved marinade",
    "boneless", "lean", "marinade", "cooking spray",
}
