#!/usr/bin/env python3
"""Map the book's species onto Audubon's Birds of America, and fetch the plates.

    .venv/bin/python extract/fetch_plates.py
    .venv/bin/python extract/fetch_plates.py --cards   # recut the cards only

Writes data/audubon_plates.json (the mapping, checked in) and web/public/plates/
(the artwork). Both steps are slow and hit the network, so build_web.py reads the
mapping rather than deriving it; rerun this only to refresh the artwork. Each plate
is stored twice: the sheet as it was painted, and a card cut from it -- `--cards`
recuts those from the sheets already on disk, which is all a change to the framing
rule needs.

Audubon painted 435 plates and died in 1851 having barely worked west of the
Mississippi. The book lists 1,357 species and she birded California, so a little
under half the book can be illustrated this way and the rest keeps the
placeholder. That gap is a fact about Audubon, not a bug in the matching.

Matching is harder than it looks: the 1966 guide and Audubon's 1830s titles agree
on almost nothing. He called the Vesper Sparrow a "Grass Finch, or Bay-winged
Bunting", and sixty years of taxonomy moved the genera underneath the scientific
names (Parus -> Poecile). So both sides are resolved through Wikipedia, whose bird
articles are titled with the current common name, and the two are matched there.
Scientific name alone gets 38% of what she recorded; through Wikipedia, 60%.
"""

from __future__ import annotations

import hashlib
import html
import io
import json
import re
import sys
import time
import unicodedata
import urllib.parse
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

from PIL import Image, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
JOURNAL = ROOT / "web" / "public" / "data" / "journal.json"
OUT_MAP = ROOT / "data" / "audubon_plates.json"
OUT_IMG = ROOT / "web" / "public" / "plates"

UA = {"User-Agent": "BirdsJournal/1.0 "
                    "(https://github.com/mariarodr1136/a-life-list)"}
SITEMAP = "https://www.audubon.org/sitemap.xml"
PLATE_IMG = "https://media.audubon.org/boa_illustration/{}"
IMG_WIDTH = 800

# Audubon painted 29 species twice. The matcher prefers the plate he titled with
# the bird's own name, which settles all but one: the Bald Eagle would otherwise
# land on plate 11, the "Bird of Washington" -- an eagle he described as a distinct
# species and which is generally now read as an immature bald. Plate 31 is the bird.
OVERRIDES = {"BALD EAGLE": 31, "EAGLE BALD": 31}


def fetch(url: str, tries: int = 8) -> bytes:
    """Both hosts throttle a burst of a few hundred requests; back off and mean it.

    Wikipedia in particular starts returning 429 partway through a run and says how
    long to wait, so a fixed retry is not enough -- take it at its word.
    """
    for attempt in range(tries):
        try:
            req = urllib.request.Request(url, headers=UA)
            with urllib.request.urlopen(req, timeout=60) as r:
                return r.read()
        except urllib.error.HTTPError as e:
            # 403 belongs here too: Wikimedia returns it under load, not only for
            # a genuine refusal, and a plate that 403s once fetches fine a moment
            # later.
            if e.code not in (403, 429, 503) or attempt == tries - 1:
                raise
            wait = e.headers.get("Retry-After")
            time.sleep(float(wait) if wait and wait.isdigit() else min(60, 5 * 2 ** attempt))
        except Exception:
            if attempt == tries - 1:
                raise
            time.sleep(1 + attempt)
    raise AssertionError("unreachable")


def wiki(**params) -> dict:
    params["format"] = "json"
    url = "https://en.wikipedia.org/w/api.php?" + urllib.parse.urlencode(params)
    return json.loads(fetch(url))


def strip_accents(s: str | None) -> str:
    """The guide prints stress marks for pronunciation: Pipilo áberti."""
    s = unicodedata.normalize("NFKD", s or "")
    return "".join(c for c in s if not unicodedata.combining(c))


def norm(s: str | None) -> str:
    s = strip_accents(s).replace("’", "'").lower()
    s = re.sub(r"\(s\)$", "s", s)
    s = re.sub(r"[^a-z0-9 ]", " ", s)
    return re.sub(r"\s+", " ", s).strip()


def uninvert(name: str) -> str:
    """The back index files birds surname-first: 'Avocet, American'."""
    if "," in name:
        head, tail = name.split(",", 1)
        return f"{tail.strip()} {head.strip()}"
    return name


def plate_urls() -> list[str]:
    """Every plate page, from the sitemap -- the gallery itself is script-built."""
    index = fetch(SITEMAP).decode("utf8")
    pages = {int(n) for n in re.findall(r"sitemap\.xml\?page=(\d+)", index)}
    urls: set[str] = set()

    def scan(page: int) -> set[str]:
        body = fetch(f"{SITEMAP}?page={page}").decode("utf8")
        return set(re.findall(r"https://www\.audubon\.org/art/birds-of-america/[a-z0-9-]+", body))

    with ThreadPoolExecutor(max_workers=8) as pool:
        for found in pool.map(scan, sorted(pages)):
            urls |= found
    return sorted(urls)


def scrape(url: str) -> dict:
    """Plate number, Audubon's own title, the current scientific name, the image."""
    body = fetch(url).decode("utf8", "replace")
    plate = re.search(r"Plate (\d+)", body)
    title = re.search(r'<h1 class="hero-title">\s*([^<]+)', body)
    sci = re.search(r'scientific">\s*([^<]+)', body)
    number = plate.group(1) if plate else None
    # Each page also links its neighbours, so keep only the file whose number is
    # this plate's. Anchor on the media path the site itself serves from: the older
    # /sites/default/files copies are not always named after the plate.
    images = [m.group(1) for m in
              re.finditer(r"boa_illustration/(plate-(\d+)-[a-z0-9_-]+\.jpg)", body)
              if m.group(2) == number]
    return {
        "plate": int(number) if number else None,
        "audubonName": html.unescape(title.group(1).strip()) if title else None,
        "scientific": html.unescape(sci.group(1).strip()) if sci else None,
        "image": images[0] if images else None,
        "page": url,
    }


def resolve(names: list[str]) -> dict[str, str | None]:
    """Wikipedia titles for a batch of names, following redirects.

    Redirects are what make this work: 'Parus atricapillus' and 'Clark's Crow' both
    land on the article whose title is the bird's current common name.
    """
    out: dict[str, str | None] = {}
    for i in range(0, len(names), 40):
        chunk = [n for n in names[i:i + 40] if n]
        if not chunk:
            continue
        q = wiki(action="query", titles="|".join(chunk), redirects=1)["query"]
        renamed = {n["from"]: n["to"] for n in q.get("normalized", [])}
        forwarded = {r["from"]: r["to"] for r in q.get("redirects", [])}
        for name in chunk:
            title = renamed.get(name, name)
            title = forwarded.get(title, title)
            page = [p for p in q["pages"].values() if p["title"] == title]
            out[name] = title if (page and "missing" not in page[0]) else None
        time.sleep(0.1)
    return out


def split_title(title: str) -> list[str]:
    """The late plates carry up to six birds: 'Bank Swallow and Violet-green Swallow'."""
    parts = re.split(r",| and ", title.replace("’", "'"))
    return [p.strip() for p in parts if len(p.strip()) > 3]


# Weakest route last; a tie is broken by taking the surer one.
ROUTES = ["scientific", "modern-name", "plate-title", "plate-title-part", "composite-modern-name"]


"""
The artists who filled Audubon's gaps.

He never worked the Southwest, so the Cactus Wren and the hummingbirds are not in
him and never will be. These four were: Cassin's folio was explicitly "all North
American birds not given by former American authors", Gould's monograph is the
hummingbirds, and Brooks and Fuertes painted the western avifauna in the decades
after. They are tried in this order -- earliest and closest to Audubon's
hand-coloured lithography first, so the page stays as much of a piece as it can.

Their plates come through Wikimedia Commons, which holds them as scans uploaded
from the Biodiversity Heritage Library. The BHL template carries the species BHL's
own name-finder detected, which is what makes them matchable at all.
"""
COMMONS_SOURCES = [
    ("Cassin", 1856, [
        "Illustrations of the birds of California, Texas, Oregon, "
        "British and Russian America"]),
    # Gould's hummingbirds for the ones Audubon lacks, and his Old World volumes
    # for the birds that arrived here after him: the Rock Dove and the Mute Swan
    # are European birds, and he painted them.
    ("Gould", 1861, [
        "A Monograph of the Trochilidae",
        "A Monograph of the Trochilidae Volume 2",
        "A Monograph of the Trochilidae Volume 3",
        "A Monograph of the Trochilidae Volume 4",
        "A Monograph of the Trochilidae Volume 5",
        "A Monograph of the Trochilidae Supplement",
        "The Birds of Great Britain (illustrations by John Gould)",
        "The Birds of Europe (Gould)", "The Birds of Europe (Gould) Volume 3",
        "The Birds of Europe (Gould) Volume 4", "The Birds of Europe (Gould) Volume 5",
        "The Birds of Asia (John Gould)", "The Birds of Asia (John Gould), Volume 4",
        "The Birds of Asia (John Gould), Volume 5",
        "The Birds of Asia (John Gould), Volume 6"]),
    ("Baird", 1874, ["A history of North American birds"]),
    ("Nehrling", 1893, ["Our native birds of song and beauty"]),
    ("Jasper", 1903, ["The Birds of North America (1903 book)"]),
    ("Fuertes", 1914, [
        "Works by Louis Agassiz Fuertes",
        "The warblers of North America (1907)",
        "Birds of New York (1910)", "Birds of New York (1912)",
        "Birds of New York (1914)", "Birds of New York (Eaton)"]),
    ("Brooks", 1923, ["The Birds of California (1923)", "Allan Brooks"]),
]


"""
Elliot, read by eye.

His folio exists precisely to figure the North American birds Audubon did not,
which makes it the best possible source for this gap -- but the only scan is the
Internet Archive's, whose OCR mangles the engraved captions ("IIELMINT IIOPHAGA
LUCLF" for Helminthophaga luciae) and whose plate numbering does not agree with
Elliot's own list of plates. Matching on that would mean guessing, and a wrong
guess here is a bird misattributed on the page.

So these five were read off the plates themselves and written down. Five of his
seventy-two are on her list at all: the rest are birds she never recorded. The
captions of the seabird plates sit outside any fixed crop and were not read, so
there may be one or two more.
"""
ELLIOT = {
    "LUCY WARBLER": (5, 1, 56, "Helminthophaga luciae"),
    "BELL VIREO": (7, 1, 64, "Vireo pusillus"),
    "SAGE SPARROW": (14, 1, 92, "Zonotrichia belli"),
    "BLACK SWIFT": (20, 1, 116, "Nephoecetes niger"),
    "INCA DOVE": (37, 2, 40, "Scardafella inca"),
}
ELLIOT_PAGE = ("https://archive.org/download/newheretoforeun{vol}elli"
               "/page/n{leaf}_w{width}.jpg")


"""
Four more, hunted one bird at a time and checked by eye.

Searching Commons per species turns up candidates for most of the birds still
missing, but almost none survive looking at them: the results are nest
photographs, landscape engravings, a distribution map, a page of a ledger. Of
twenty-eight candidates reviewed, these four are what was left.

Two were caught by their own captions. The plate offered for the Western
Flycatcher and the Western Wood Pewee is captioned VIOLET-GREEN SWALLOWS, and the
one offered for the Gila Woodpecker names Falco femoralis, a falcon. Both looked
right at thumbnail size, which is the whole argument for reading the caption.
"""
HAND_PICKED = {
    "RHINOCEROS AUKLET": {
        "artist": "Audubon", "scientific": "Cerorhinca monocerata",
        "title": "Horned-billed Guillemot",
        # From the octavo edition, so outside the 435 Havell plates the site
        # otherwise draws on -- his own bird, missed by the usual route.
        "url": "https://upload.wikimedia.org/wikipedia/commons/thumb/b/b1/"
               "The_birds_of_America_%28Pl._475%29_%288594228825%29.jpg/"
               "960px-The_birds_of_America_%28Pl._475%29_%288594228825%29.jpg",
        "page": "https://commons.wikimedia.org/wiki/File:The_birds_of_America_(Pl._475)_(8594228825).jpg",
    },
    "RED FACED WARBLER": {
        "artist": "Fuertes", "scientific": "Cardellina rubrifrons",
        "title": "Red-faced Warbler",
        "url": "https://upload.wikimedia.org/wikipedia/commons/thumb/5/54/"
               "The_warblers_of_North_America_%286309262602%29.jpg/"
               "960px-The_warblers_of_North_America_%286309262602%29.jpg",
        "page": "https://commons.wikimedia.org/wiki/File:The_warblers_of_North_America_(6309262602).jpg",
    },
    "RINGED TURTLE DOVE": {
        "artist": "Selby", "scientific": "Streptopelia risoria",
        "title": None,
        "url": "https://upload.wikimedia.org/wikipedia/commons/thumb/a/a9/"
               "Pigeons_%28Plate_17%29_%286976192811%29.jpg/"
               "960px-Pigeons_%28Plate_17%29_%286976192811%29.jpg",
        "page": "https://commons.wikimedia.org/wiki/File:Pigeons_(Plate_17)_(6976192811).jpg",
    },
    "OLIVACEOUS FLYCATCHER": {
        "artist": "Bird-Lore", "scientific": "Myiarchus tuberculifer",
        "title": None,
        "url": "https://upload.wikimedia.org/wikipedia/commons/thumb/8/8b/"
               "Bird_lore_%281909%29_%2814775470403%29.jpg/"
               "960px-Bird_lore_%281909%29_%2814775470403%29.jpg",
        "page": "https://commons.wikimedia.org/wiki/File:Bird_lore_(1909)_(14775470403).jpg",
    },
}


def add_hand_picked(mapping: dict[str, dict], species: list[dict]) -> int:
    known = {s["key"] for s in species}
    added = 0
    for key, rec in HAND_PICKED.items():
        if key not in known or key in mapping:
            continue
        mapping[key] = {
            "artist": rec["artist"],
            "image": f"picked-{key.lower().replace(' ', '-')}",
            "plate": None,
            "title": rec["title"],
            "scientific": rec["scientific"],
            "file": rec["url"],
            "page": rec["page"],
            "matchedBy": "read-from-the-plate",
        }
        added += 1
    return added


def add_elliot(mapping: dict[str, dict], species: list[dict]) -> int:
    """Hand-verified plates, added only where nothing else reached the bird."""
    known = {s["key"] for s in species}
    added = 0
    for key, (plate, vol, leaf, name) in ELLIOT.items():
        if key not in known or key in mapping:
            continue
        mapping[key] = {
            "artist": "Elliot",
            "image": f"elliot-{plate}",
            "plate": plate,
            "title": None,
            "scientific": name,
            "file": ELLIOT_PAGE.format(vol=vol, leaf=leaf, width=IMG_WIDTH),
            "page": f"https://archive.org/details/newheretoforeun{vol}elli",
            "matchedBy": "read-from-the-plate",
        }
        added += 1
    return added


def commons(**params) -> dict:
    params["format"] = "json"
    url = "https://commons.wikimedia.org/w/api.php?" + urllib.parse.urlencode(params)
    return json.loads(fetch(url))


def commons_category(cat: str) -> list[dict]:
    """Every file in a Commons category, with its wikitext and a usable image."""
    out: list[dict] = []
    cont: dict = {}
    while True:
        d = commons(action="query", generator="categorymembers",
                    gcmtitle=f"Category:{cat}", gcmtype="file", gcmlimit=50,
                    prop="revisions|imageinfo", rvprop="content", rvslots="main",
                    iiprop="url", iiurlwidth=IMG_WIDTH, **cont)
        for page in d.get("query", {}).get("pages", {}).values():
            info = (page.get("imageinfo") or [{}])[0]
            url = info.get("thumburl") or info.get("url")
            if url:
                out.append({"page": page["title"],
                            "text": page["revisions"][0]["slots"]["main"]["*"],
                            "url": url})
        if "continue" not in d:
            return out
        cont = d["continue"]
        time.sleep(0.4)


def described_species(text: str) -> tuple[set[str], str | None]:
    """What species a Commons file says it shows, and the name it gives them.

    Three routes, because the uploads are not uniform: BHL's own name-finding
    (`NameFound:`), an italicised binomial in the description, and the species
    categories a Commons editor filed it under.
    """
    found = set(re.findall(r"NameFound:([A-Z][a-z]+ [a-z]+)", text))
    found |= set(re.findall(r"''([A-Z][a-z]+ [a-z]+)''", text))
    found |= set(re.findall(r"\[\[Category:([A-Z][a-z]+ [a-z]+) \(", text))
    # Only a caption that reads as a bird's name is worth showing. Many of these
    # descriptions are raw OCR of the plate's imprint line -- "Cassin's
    # flluslrations" -- or a fragment of the template, and a caption is worse than
    # no caption when it is neither the bird's name nor English.
    modern = (re.search(r"now known as ([^(\n]+?)\s*\(", text)
              or re.search(r"\|\s*[Dd]escription\s*=\s*(?:\{\{en\|1=)?([A-Z][A-Za-z' -]{2,40}),\s*''",
                           text))
    name = modern.group(1).strip() if modern else None
    if name and (len(name) < 3 or "<" in name or "{" in name
                 or re.search(r"illustr|plate|figure", name, re.I)):
        name = None
    return found, name


# Plates that are the right bird but the wrong thing to look at. The site is
# hand-coloured plates; a pen-and-ink field sketch sits on the page as an odd one
# out even when the identification is perfect. Judged by eye, not by a rule --
# measuring colour would throw out Audubon's white seabirds with it, and his
# Gull-billed Tern and Manx Shearwater are as pale as anything Fuertes sketched.
EXCLUDED_PAGES = {
    "File:The English Sparrow-MBS 54.jpg",     # a line drawing, no colour at all
}


def gather_commons() -> list[dict]:
    """Candidate plates from the four later artists, ready to be matched."""
    candidates: list[dict] = []
    for artist, year, cats in COMMONS_SOURCES:
        seen: set[str] = set()
        kept = 0
        for cat in cats:
            try:
                files = commons_category(cat)
            except Exception as exc:                      # a renamed category
                print(f"  {artist}: skipped {cat[:40]} ({exc})")
                continue
            for f in files:
                if f["page"] in seen or f["page"] in EXCLUDED_PAGES:
                    continue
                seen.add(f["page"])
                names, title = described_species(f["text"])
                if not names:
                    continue                              # a cover or a signature
                plate = re.search(r"Plate ([IVXLC0-9]+)", f["text"])
                candidates.append({
                    "artist": artist, "year": year,
                    "scientificNames": sorted(names),
                    "title": title, "plateLabel": plate.group(1) if plate else None,
                    "url": f["url"], "page": f["page"],
                })
                kept += 1
        print(f"  {artist:8s} {kept} identifiable plates")
    return candidates


def build_mapping(plates: list[dict], species: list[dict]) -> dict[str, dict]:
    by_plate = {p["plate"]: p for p in plates}

    sci_names = sorted({p["scientific"] for p in plates if p.get("scientific")})
    plate_common = resolve(sci_names)

    members: dict[str, list[int]] = {}
    for p in plates:
        for part in split_title(p["audubonName"]):
            members.setdefault(part, []).append(p["plate"])
    member_common = resolve(sorted(members))

    journal_sci = sorted({strip_accents(s["scientific"]) for s in species if s.get("scientific")})
    journal_common = resolve(journal_sci)

    routes: dict[str, list[tuple[int, str]]] = {}

    def index(key: str, plate: int, how: str) -> None:
        if key:
            routes.setdefault(key, []).append((plate, how))

    for p in plates:
        if p.get("scientific"):
            index(norm(p["scientific"]), p["plate"], "scientific")
            index(norm(plate_common.get(p["scientific"])), p["plate"], "modern-name")
        index(norm(p["audubonName"]), p["plate"], "plate-title")
    for part, on_plates in members.items():
        index(norm(part), on_plates[0], "plate-title-part")
        index(norm(member_common.get(part)), on_plates[0], "composite-modern-name")

    mapping: dict[str, dict] = {}
    for s in species:
        keys = [norm(s["name"]), norm(uninvert(s["name"]))]
        sci = strip_accents(s.get("scientific") or "")
        if sci:
            keys += [norm(sci), norm(journal_common.get(sci))]
        keys = [k for k in keys if k]

        seen, candidates = set(), []
        for k in keys:
            for cand in routes.get(k, []):
                if cand not in seen:
                    seen.add(cand)
                    candidates.append(cand)
        if not candidates:
            continue

        # Prefer a plate Audubon himself titled with this bird's name, so the
        # Canada Warbler gets plate 103 and not the one he called Bonaparte's
        # Flycatcher before he knew they were the same bird.
        named = [c for c in candidates if norm(by_plate[c[0]]["audubonName"]) in set(keys)]
        plate, how = sorted(named or candidates, key=lambda c: (ROUTES.index(c[1]), c[0]))[0]
        if s["key"] in OVERRIDES:
            plate, how = OVERRIDES[s["key"]], "override"

        p = by_plate[plate]
        mapping[s["key"]] = {
            "artist": "Audubon",
            "image": f"plate-{plate}",
            "plate": plate,
            "title": p["audubonName"],
            "scientific": p["scientific"],
            "file": p["image"],
            "page": p["page"],
            "matchedBy": how,
        }
    return mapping


# The card frame the interface crops to. Both files are made here so that the one
# number lives in one place; changing it means rerunning this script.
CARD_ASPECT = 5 / 4

# The window is worked out on a copy this many pixels along its longest edge.
# Large enough that the edge of a printed picture lands within a percent of the
# plate, small enough that 431 plates is a minute rather than an hour.
CARD_WORK = 340

# Where the rule below cannot see what a person can. Each entry is the card window
# as (x, y, width) in fractions of the plate; the height follows from CARD_ASPECT.
# These were picked by eye, plate by plate, after looking at every card on the life
# list -- almost always because the bird is small and something louder shares the
# sheet, or because a bird fills the plate and its head is the part that gets cut.
CARD_CROPS = {
    "cassin-d2bd3a3cbf": (0.15, 0.34, 0.62),   # Black-Throated Sparrow, in ocotillo
    "plate-251": (0.05, 0.00, 0.90),           # Brown Pelican
    "plate-426": (0.05, 0.02, 0.90),           # California Condor
    "plate-103": (0.28, 0.28, 0.68),           # Canada Warbler, small in laurel
    "plate-158": (0.05, 0.00, 0.90),           # Chimney Swift, above its nest
    "plate-156": (0.05, 0.37, 0.90),           # Common Crow
    "plate-309": (0.02, 0.25, 0.95),           # Common Tern, diving head-down
    "plate-36": (0.10, 0.10, 0.90),            # Cooper's Hawk
    "plate-181": (0.00, 0.02, 0.90),           # Golden Eagle
    "plate-211": (0.05, 0.30, 0.95),           # Great Blue Heron, head low and right
    "plate-271": (0.02, 0.42, 0.95),           # Magnificent Frigatebird
    "plate-295": (0.02, 0.05, 0.66),           # Manx Shearwater
    "plate-174": (0.05, 0.02, 0.90),           # Olive-Sided Flycatcher
    "plate-105": (0.05, 0.15, 0.90),           # Red-Breasted Nuthatch
    "fuertes-011dd74c21": (0.12, 0.42, 0.70),  # Pygmy Nuthatch, in a grey halftone
    "picked-rhinoceros-auklet": (0.26, 0.03, 0.53),
    "gould-a67bd7f593": (0.05, 0.15, 0.90),    # Rock Dove
    "plate-379": (0.02, 0.00, 0.95),           # Rufous Hummingbird, both at the top
    "plate-166": (0.02, 0.28, 0.95),           # Rough-Legged Hawk
    "plate-242": (0.02, 0.02, 0.95),           # Snowy Egret
    "plate-45": (0.20, 0.05, 0.75),            # Traill's Flycatcher
    "plate-311": (0.02, 0.02, 0.95),           # White Pelican
    "baird-6bf6a58fb9": (0.02, 0.00, 0.78),    # White-Tailed Ptarmigan, head studies
    "plate-83": (0.05, 0.05, 0.90),            # House Wren
}


def _masks(picture: Image.Image) -> tuple[list, list, float, int, int]:
    """Two views of a plate, small enough to walk pixel by pixel.

    `printed` is everything that is not bare sheet, which finds the edge of the
    picture. `bird` is the subject: detail, not colour, is what separates a bird
    from what it stands against, because sky, water and paper are smooth and a
    painted bird never is. Foliage is detailed too, so it comes out by hue -- the
    one thing a leaf reliably is and a bird mostly is not.
    """
    w, h = picture.size
    scale = max(w, h) / CARD_WORK
    small = (picture.resize((max(8, round(w / scale)), max(8, round(h / scale))),
                            Image.BILINEAR) if scale > 1 else picture.copy())
    sw, sh = small.size
    rgb = small.load()
    hue, sat, _ = (c.load() for c in small.convert("HSV").split())

    # The sheet's own tone, read off its border: these papers run cream to grey.
    border = ([rgb[x, y] for y in (0, sh - 1) for x in range(sw)]
              + [rgb[x, y] for x in (0, sw - 1) for y in range(sh)])
    paper = tuple(sorted(c[i] for c in border)[len(border) // 2] for i in range(3))

    grey = small.convert("L")
    hi = grey.filter(ImageFilter.MaxFilter(3)).load()
    lo = grey.filter(ImageFilter.MinFilter(3)).load()

    printed = [[0] * sw for _ in range(sh)]
    bird = [[0] * sw for _ in range(sh)]
    for y in range(sh):
        for x in range(sw):
            r, g, b = rgb[x, y][:3]
            if abs(r - paper[0]) + abs(g - paper[1]) + abs(b - paper[2]) > 40:
                printed[y][x] = 1
                leaf = 40 <= hue[x, y] <= 108 and sat[x, y] > 40
                if not leaf and hi[x, y] - lo[x, y] > 26:
                    bird[y][x] = 1
    return printed, bird, scale, sw, sh


def _block(profile: list[int], floor: float, bridge: float) -> tuple[int, int]:
    """The longest unbroken run of printed rows (or columns), small gaps bridged.

    Where a plate is a picture printed on a larger sheet, its lettering is a line
    of its own with bare paper above and below. Taking the longest run rather than
    the first mark to the last leaves the caption out, and with it the white band
    the card used to show down one side of the bird.
    """
    runs, start, gap = [], None, 0
    for i, v in enumerate(profile):
        if v >= floor:
            if start is None:
                start = i
            gap = 0
        elif start is not None:
            gap += 1
            if gap > bridge:
                runs.append((start, i - gap))
                start, gap = None, 0
    if start is not None:
        runs.append((start, len(profile) - gap))
    if not runs:
        return 0, len(profile)
    lo, hi = max(runs, key=lambda r: r[1] - r[0])
    # The bridge is there to hold a run together across a thin gap inside the
    # picture; at the two ends it would hand back the sheet margin it just walked
    # over, which is the pale strip the cards used to carry down one side.
    while lo < hi and profile[lo] < floor:
        lo += 1
    while hi > lo and profile[hi - 1] < floor:
        hi -= 1
    return lo, hi


def card_box(picture: Image.Image) -> tuple[int, int, int, int]:
    """The card's window on a plate: the bird's head in, the paper out.

    Two rules, in order. The window is the largest card-shaped one that fits inside
    the printed picture, so no edge of it can be bare sheet. Then it slides up and
    down to hold as much of the bird as it can *without slicing through one along
    its top edge* -- because the top of a bird is its head, and a beheaded bird is
    the one crop a reader will not forgive. Centring on the paint alone, which is
    what this used to do, took the head off the Bald Eagle and both pelicans.
    """
    printed, bird, scale, sw, sh = _masks(picture)

    rows = [sum(r) for r in printed]
    top, bottom = _block(rows, max(2, sw * 0.12), max(2, sh * 0.02))
    # Only the rows the picture occupies get a say in where its sides are. Read
    # over the whole sheet instead and a caption set wider than the picture --
    # "Cassin's Illustrations" runs the full measure -- votes the margin back in,
    # which is how a band of bare paper survived down the left of those plates.
    cols = [sum(printed[y][x] for y in range(top, bottom)) for x in range(sw)]
    left, right = _block(cols, max(2, (bottom - top) * 0.12), max(2, sw * 0.02))
    if bottom - top < 12 or right - left < 12:
        top, bottom, left, right = 0, sh, 0, sw

    across, down = right - left, bottom - top
    if across / down >= CARD_ASPECT:
        h = down
        w = h * CARD_ASPECT
    else:
        w = across
        h = w / CARD_ASPECT

    brow = [sum(bird[y][x] for x in range(left, right)) for y in range(sh)]
    total = sum(brow[top:bottom]) or 1
    band = max(1, round(h * 0.04))
    tall = round(h)
    best, y0 = None, top
    for y in range(top, max(top + 1, bottom - tall + 1)):
        held = sum(brow[y:y + tall]) / total
        cut = sum(brow[y:y + band]) / (band * across)
        score = held - 1.6 * cut
        if best is None or score > best:
            best, y0 = score, y

    # Sideways, the bird's own weight decides: a plate is often painted off-centre.
    bcol = [sum(bird[y][x] for y in range(y0, y0 + tall)) for x in range(sw)]
    mass = sum(bcol[left:right]) or 1
    centre = sum(x * bcol[x] for x in range(left, right)) / mass
    x0 = max(left, min(right - w, centre - w / 2))

    # Back to the plate's own pixels, and inside them. A window that ends on the
    # last column rounds up to one past it, and PIL answers a crop off the edge
    # with black rather than an error, so it is the far edge that gives -- by a
    # pixel or two, with the near one left where the picture starts.
    full_w, full_h = picture.size
    x1, y1 = round(x0 * scale), round(y0 * scale)
    wide = min(full_w, round((x0 + w) * scale)) - x1
    tall_px = min(full_h, round((y0 + h) * scale)) - y1
    if wide / tall_px > CARD_ASPECT:
        wide = round(tall_px * CARD_ASPECT)
    else:
        tall_px = round(wide / CARD_ASPECT)
    return (x1, y1, x1 + wide, y1 + tall_px)


def make_card(image: str, whole: bytes) -> bytes:
    """The card file: a plate cropped to the frame, by rule or by hand."""
    with Image.open(io.BytesIO(whole)) as img:
        picture = img.convert("RGB")
    hand = CARD_CROPS.get(image)
    if hand:
        fx, fy, fw = hand
        # A hand-picked width on a plate barely taller than the frame can ask for
        # a row that is not there; the frame gives, not the plate.
        w = min(round(picture.width * fw), round(picture.height * CARD_ASPECT))
        h = round(w / CARD_ASPECT)
        x = max(0, min(picture.width - w, round(picture.width * fx)))
        y = max(0, min(picture.height - h, round(picture.height * fy)))
        box = (x, y, x + w, y + h)
    else:
        box = card_box(picture)
    out = io.BytesIO()
    picture.crop(box).save(out, "WEBP", quality=88, method=6)
    return out.getvalue()


def trim_paper(data: bytes) -> bytes:
    """Crop the blank sheet margin, and nothing else.

    Only the paper around the plate goes. Judging where the picture ends by how
    much paint an edge carries belongs to the card crop (painted_box): a plate
    whose bottom is pale water reads the same as one whose bottom is engraved
    lettering, and cropping this file on that guess cost the American Coot its
    feet.

    Every plate is photographed with its paper around it -- 4 to 6% at the top and
    up to 20% at the sides -- which the cards would otherwise show as a white band
    down one side of the bird. The paper is not a fixed white (220 to 255 across the
    set, and cream on the older sheets), so its tone is read off each plate's own
    border rather than assumed, and anything darker than that counts as picture.

    Done on the bytes as they arrive, never to a stored file. WebP is lossy, so
    re-trimming an already-trimmed plate would soften it a little each time and
    still find another sliver to cut, the encoder having smeared the new edge. This
    way each plate is decoded and written exactly once, and a rerun that skips the
    download skips this too.

    Cropping exposes a fresh border, which re-reads as paper when the outermost
    content is a thin twig, so the box is walked to a fixed point before the single
    cut is made.
    """
    with Image.open(io.BytesIO(data)) as img:
        picture = img.convert("RGB")
    full = (0, 0, *picture.size)
    box = full
    for _ in range(8):
        grey = picture.crop(box).convert("L")
        w, h = grey.size
        edges = (grey.crop((0, 0, w, 1)).tobytes() + grey.crop((0, h - 1, w, h)).tobytes()
                 + grey.crop((0, 0, 1, h)).tobytes() + grey.crop((w - 1, 0, w, h)).tobytes())
        paper = sorted(edges)[len(edges) // 2]
        inner = grey.point(lambda v: 255 if v <= paper - 12 else 0).getbbox()
        if not inner:
            break
        moved = (box[0] + inner[0], box[1] + inner[1], box[0] + inner[2], box[1] + inner[3])
        if moved == box:
            break
        box = moved

    # A margin too thin to see is not worth a re-encode.
    ow, oh = picture.size
    if max(box[0] / ow, box[1] / oh, (ow - box[2]) / ow, (oh - box[3]) / oh) < 0.005:
        return data
    out = io.BytesIO()
    picture.crop(box).save(out, "WEBP", quality=88, method=6)
    return out.getvalue()


def fill_gaps(mapping: dict[str, dict], species: list[dict],
              candidates: list[dict]) -> int:
    """Give the birds Audubon never painted to the artists who did.

    Audubon is never displaced: this only reaches species he left, and among the
    rest it takes the earliest artist who has the bird, so the page drifts from his
    hand as slowly as the material allows.
    """
    wanted = [s for s in species
              if (s["marked"] or s["observations"]) and s["key"] not in mapping]
    if not wanted:
        return 0

    every_name = sorted({n for c in candidates for n in c["scientificNames"]})
    modern = resolve(every_name)

    # Keyed to the name that matched, not just the plate: a page naming three
    # hummingbirds would otherwise be captioned with whichever sorted first, and
    # Allen's Hummingbird would be labelled Anna's.
    index: dict[str, list[tuple[dict, str | None]]] = {}
    for c in candidates:
        if c["title"]:
            index.setdefault(norm(c["title"]), []).append((c, None))
        for sci in c["scientificNames"]:
            for k in {norm(sci), norm(modern.get(sci))}:
                if k:
                    index.setdefault(k, []).append((c, sci))

    journal_sci = sorted({strip_accents(s["scientific"]) for s in wanted if s.get("scientific")})
    journal_common = resolve(journal_sci)

    filled = 0
    for s in wanted:
        keys = [norm(s["name"]), norm(uninvert(s["name"]))]
        sci = strip_accents(s.get("scientific") or "")
        if sci:
            keys += [norm(sci), norm(journal_common.get(sci))]

        hits = [pair for k in keys if k for pair in index.get(k, [])]

        # A shared English name is not a shared bird. "White-necked Raven" belongs
        # to Corvus cryptoleucus here and to Corvus albicollis in Africa, and the
        # guide's raven was very nearly illustrated with the African one. Where both
        # sides resolve to a Wikipedia article, they must resolve to the same one.
        here = journal_common.get(sci) if sci else None
        if here:
            hits = [(c, m) for c, m in hits
                    if not (m and modern.get(m)) or modern[m] == here]
        if not hits:
            continue
        # Earliest artist first, then the plate that names fewest other birds: a
        # sheet captioned with one species is far likelier to be of that species
        # than a page whose text mentions six.
        best, matched_on = sorted(
            hits, key=lambda h: (h[0]["year"], len(h[0]["scientificNames"]), h[0]["page"]))[0]
        # Named by a digest of the Commons title, not the title itself: these books
        # have long names and the plate number falls at the end, so any readable
        # truncation collides every plate in a volume onto one filename.
        digest = hashlib.md5(best["page"].encode("utf8")).hexdigest()[:10]
        mapping[s["key"]] = {
            "artist": best["artist"],
            "image": f"{best['artist'].lower()}-{digest}",
            "plate": best["plateLabel"],
            "title": best["title"],
            "scientific": matched_on or best["scientificNames"][0],
            "file": best["url"],
            "page": f"https://commons.wikimedia.org/wiki/{urllib.parse.quote(best['page'])}",
            "matchedBy": "commons-name",
        }
        filled += 1
    return filled


def download(mapping: dict[str, dict]) -> None:
    """One image per plate, resized at the source rather than shipping 2 MB scans."""
    OUT_IMG.mkdir(parents=True, exist_ok=True)
    wanted = {(m["image"], m["artist"], m["file"]) for m in mapping.values()}

    def grab(item: tuple[str, str, str]) -> bool:
        """The whole sheet, as it was composed. The card is cut from it later.

        Cropping the stored file would settle "which bird is this" against "what
        did he paint" for good, so the sheet is what gets kept.
        """
        image, artist, name = item
        dst = OUT_IMG / f"{image}.webp"
        if dst.exists():
            return False
        # Audubon's own site resizes on request; Commons was asked for a sized
        # thumbnail when the file was listed, so its url is already the right one.
        url = (PLATE_IMG.format(name) + f"?width={IMG_WIDTH}&format=webp"
               if artist == "Audubon" else name)   # others carry a sized url
        dst.write_bytes(trim_paper(fetch(url)))
        return True

    def attempt(item: tuple[str, str, str]) -> bool:
        """One plate failing must not take the rest of the run with it.

        Wikimedia throttles a concurrent burst with a 403, and an exception out of
        pool.map aborts every plate still queued behind it -- which is how a single
        refused thumbnail left the run 40 plates short. Report and carry on; the
        next run picks up whatever is still missing.
        """
        try:
            return grab(item)
        except Exception as exc:
            print(f"    could not fetch {item[0]}: {exc}")
            return False

    with ThreadPoolExecutor(max_workers=4) as pool:
        fetched = sum(pool.map(attempt, sorted(wanted)))
    missing = [i for i, _, _ in wanted if not (OUT_IMG / f"{i}.webp").exists()]
    size = sum(f.stat().st_size for f in OUT_IMG.glob("*.webp"))
    print(f"  plates      {len(wanted)} ({fetched} newly fetched, {size / 1e6:.1f} MB)")
    if missing:
        print(f"              {len(missing)} still missing -- run again to pick them up")


def cut_cards() -> None:
    """Cut each stored sheet down to its card.

    Kept apart from the download so that changing how a card is framed does not
    mean fetching 431 plates again. A card is recut when it is missing or older
    than this file, which is what makes an edit to the rule -- or to CARD_CROPS --
    reach the plates already on disk, and what makes a rerun otherwise free.
    """
    rule = Path(__file__).stat().st_mtime
    stale = [p for p in sorted(OUT_IMG.glob("*.webp"))
             if not p.name.endswith("-card.webp")
             and (not (card := p.with_name(f"{p.stem}-card.webp")).exists()
                  or card.stat().st_mtime < rule)]
    for src in stale:
        card = src.with_name(f"{src.stem}-card.webp")
        card.write_bytes(make_card(src.stem, src.read_bytes()))
    print(f"  cards       {len(stale)} cut"
          f"{' (all current)' if not stale else ''}")


def main() -> int:
    # Recutting the cards needs nothing from the network, and the matching pass
    # below takes minutes, so it is reachable on its own.
    if "--cards" in sys.argv[1:]:
        cut_cards()
        return 0

    species = json.loads(JOURNAL.read_text())["species"]

    urls = plate_urls()
    print(f"  plate pages {len(urls)}")
    with ThreadPoolExecutor(max_workers=6) as pool:
        plates = [p for p in pool.map(scrape, urls) if p["plate"]]

    mapping = build_mapping(plates, species)
    recorded = [s for s in species if s["marked"] or s["observations"]]
    audubon = sum(1 for s in recorded if s["key"] in mapping)

    print("  gathering the artists who filled his gaps...")
    elliot = add_elliot(mapping, species) + add_hand_picked(mapping, species)
    filled = elliot + fill_gaps(mapping, species, gather_commons())

    OUT_MAP.write_text(json.dumps(mapping, ensure_ascii=False, indent=1, sort_keys=True) + "\n")
    hit = sum(1 for s in recorded if s["key"] in mapping)
    print(f"  matched     {len(mapping)} of {len(species)} printed species")
    print(f"              {hit} of {len(recorded)} she recorded "
          f"({round(100 * hit / len(recorded))}%) "
          f"-- {audubon} by Audubon, {filled} by the others")

    download(mapping)
    cut_cards()
    return 0


if __name__ == "__main__":
    sys.exit(main())
