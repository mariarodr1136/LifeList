#!/usr/bin/env python3
"""Build the static data bundle and image assets the web app reads.

    .venv/bin/python extract/build_web.py

Emits web/public/data/journal.json plus resized page images. The whole archive is
small enough to ship as static files, so the site needs no database at runtime and
deploys anywhere.
"""

from __future__ import annotations

import json
import re
import sys
from collections import defaultdict
from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parent.parent
JOURNAL = ROOT / "data" / "journal.json"
PLATES = ROOT / "data" / "audubon_plates.json"
PAGES_SRC = ROOT / "data" / "pages"
WEB = ROOT / "web" / "public"
OUT_JSON = WEB / "data" / "journal.json"

PAGE_W, PAGE_Q = 1400, 82
THUMB_W, THUMB_Q = 420, 72

# A transcription caveat is the reader-of-the-photograph talking, not the owner.
# Mixing the two would put words in a dead man's hand, so they are split apart and
# the UI sets them in print rather than script.
EDITORIAL = re.compile(
    r"illegible|uncertain|unclear|unreadable|hard to (?:read|make out)|"
    r"could be|may be|might be|possibly|appears? to|seems? to|"
    r"partly|partially|cannot be|can't be|not legible|ambiguous|"
    r"a (?:cursive|handwritten|pencil|faint) (?:note|word|annotation)|"
    r"reading something like|too faint",
    re.I,
)


def split_notes(notes: list[str]) -> tuple[list[str], list[str]]:
    """Separate the owner's own words from the transcriber's caveats."""
    hand, editorial = [], []
    for n in notes:
        (editorial if EDITORIAL.search(n) else hand).append(n)
    return hand, editorial


# Headings that describe the book's apparatus rather than a group of birds.
NON_FAMILY = re.compile(
    r"TOPOGRAPHY|PARTS OF|BIRD WATCHING|BIRD STUDY|PREFACE|TABLE OF CONTENTS|"
    r"INDEX|MEASURING|HOW TO|CHECK\s?LIST|MIGRATION|CONSERVATION|ATTRACTING",
    re.I,
)


# Two-letter postal codes and initialisms must not be title-cased into "Ca"/"S.d."
KEEP_UPPER = re.compile(r"^(?:[A-Z]{2}|(?:[A-Z]\.){2,})[,.]?$")


def title_case(name: str) -> str:
    """Render the book's block capitals as readable text, keeping real capitals.

    "LEAST SANDPIPER" becomes "Least Sandpiper"; "ANNA'S HUMMINGBIRD" keeps its
    apostrophe-S lowercase; hyphenated names capitalise both halves. State codes
    and initialisms like "CA" and "S.D." are left alone.
    """
    def fix(word: str) -> str:
        if KEEP_UPPER.match(word):
            return word
        return "-".join(
            p[:1].upper() + p[1:].lower() if p else p for p in word.split("-")
        )
    out = " ".join(fix(w) for w in name.split())
    return re.sub(r"'S\b", "'s", out)


# Words the transcription misread, with what the book actually prints. Only for
# readings that are certainly errors -- "Housf" is not a bird -- never for a name
# the book spells oddly of its own accord, which is the book's business.
MISREADINGS = {"HOUSF": "HOUSE", "LAYSON": "LAYSAN"}


def species_key(name: str) -> str:
    """Group the same bird across the species account and the back index.

    Three ways the same bird gets written differently:

    The two pages disagree about word order -- an account prints "American Avocet"
    and the back index files it as "Avocet, American". Reading those as different
    birds put 100 species on the life list twice.

    Possessives are inconsistent between them: "Xantus' Murrelet" against
    "Murrelet, Xantus's". Both become Xantus.

    And the transcription misread a few words outright, which no rule can infer, so
    those are listed above and corrected.
    """
    if "," in name:
        head, tail = name.split(",", 1)
        name = f"{tail.strip()} {head.strip()}"
    name = re.sub(r"'s\b|'", "", name, flags=re.I)
    k = re.sub(r"[^A-Z ]+", " ", name.upper())
    words = [MISREADINGS.get(w, w) for w in k.split()]
    return " ".join(words)


def fix_misreadings(name: str) -> str:
    """The printed name, with the transcription's own typos corrected.

    The book prints "House Finch"; the page was read as "Housf Finch". Leaving the
    typo on display would be faithful to the reading rather than to the book, which
    is the wrong loyalty -- everything else on the site is the book's.
    """
    return " ".join(MISREADINGS[w.upper()].title() if w.upper() in MISREADINGS else w
                    for w in name.split())


def clean_family(heading: str | None) -> str | None:
    """Reduce a page heading to a single group name.

    Compound headings like "VULTURES, HAWKS, AND FALCONS / FAMILIES OF ... / VULTURES
    (plate)" collapse to their first segment, which is the group a reader would name.
    """
    if not heading:
        return None
    first = heading.split("/")[0].strip()
    first = re.sub(r"\s*\(plate\)\s*$", "", first, flags=re.I)
    first = re.sub(r"^FAMILIES OF\s+", "", first, flags=re.I).strip()
    if not first or NON_FAMILY.search(first):
        return None
    return title_case(first)


def resize(src: Path, dst: Path, width: int, quality: int) -> None:
    """Resize for the web and drop the EXIF orientation tag.

    145 of these photos carry orientation 6 ("rotate 90 CW"): the phone was held
    upright while the book lay landscape in the frame, so the sensor pixels are
    already the right way round and the tag rotates them wrongly. Browsers honour
    EXIF, so the tag has to go -- saving without an exif block bakes in the pixels
    exactly as they are.
    """
    dst.parent.mkdir(parents=True, exist_ok=True)
    with Image.open(src) as im:
        im = im.convert("RGB")
        w, h = im.size
        scale = width / max(w, h)
        if scale < 1:
            im = im.resize((round(w * scale), round(h * scale)), Image.LANCZOS)
        im.save(dst, "JPEG", quality=quality, optimize=True, progressive=True)


def focus_y(img: Image.Image) -> int:
    """Where the picture actually is, as a percentage down the plate.

    The cards crop to fill, which throws away half the height of a portrait plate,
    and a fixed crop guesses wrong often: Audubon hung the Vesper Sparrow at the
    foot of a prickly pear, so centring on the sheet gives a card of cactus. The
    plates are ink on near-white paper, though, so the centre of mass of everything
    that is not paper lands on the bird. Clamped, because a plate with a single
    high branch should still not crop past the middle of the sheet.
    """
    grey = img.convert("L").resize((64, 64))
    weights = [(y, sum(255 - v for v in grey.crop((0, y, 64, y + 1)).getdata() if v < 245))
               for y in range(64)]
    total = sum(w for _, w in weights)
    if not total:
        return 50
    centre = sum(y * w for y, w in weights) / total
    return max(30, min(70, round(centre / 64 * 100)))


def plate_record(plate: dict) -> dict:
    """Attach the shape of both files: the card's crop, and the whole plate.

    Audubon composed to the page, not to a template: 154 of the plates are
    landscape and the rest portrait, in 66 different sizes, so neither file can be
    given an assumed aspect.
    """
    plates = WEB / "plates"
    with Image.open(plates / f"{plate['image']}-card.webp") as card:
        width, height = card.size
        focus = focus_y(card)
    with Image.open(plates / f"{plate['image']}.webp") as whole:
        full_width, full_height = whole.size
    return {**plate, "width": width, "height": height, "focusY": focus,
            "fullWidth": full_width, "fullHeight": full_height}


def main() -> int:
    if not JOURNAL.exists():
        print(f"missing {JOURNAL}; run extract.py first", file=sys.stderr)
        return 1

    pages = json.loads(JOURNAL.read_text())
    pages.sort(key=lambda p: p["image"])
    plates = json.loads(PLATES.read_text()) if PLATES.exists() else {}

    # ---- images -----------------------------------------------------------
    print(f"resizing {len(pages)} page images...")
    for page in pages:
        src = PAGES_SRC / f"{page['image']}.jpg"
        if not src.exists():
            continue
        resize(src, WEB / "pages" / f"{page['image']}.jpg", PAGE_W, PAGE_Q)
        resize(src, WEB / "thumbs" / f"{page['image']}.jpg", THUMB_W, THUMB_Q)

    # ---- aggregate --------------------------------------------------------
    species_by_key: dict[str, dict] = {}
    locations: dict[str, dict] = {}
    families: dict[str, set] = defaultdict(set)
    spreads = []

    for idx, page in enumerate(pages):
        family = clean_family(page["section_heading"])
        marked_here = []

        for sp in page["species"]:
            key = species_key(sp["common_name"])
            if not key:
                continue
            rec = species_by_key.setdefault(key, {
                "key": key,
                "name": fix_misreadings(title_case(sp["common_name"])),
                "scientific": None,
                "family": None,
                "marked": False,
                "circled": False,
                "notes": [],
                "editorial": [],
                "observations": [],
                "pages": [],
            })
            if sp["scientific_name"] and not rec["scientific"]:
                rec["scientific"] = sp["scientific_name"]
            # Prefer a family from the species-account page over the terse index.
            if family and (not rec["family"] or page["page_type"] == "species_account"):
                rec["family"] = family
            rec["marked"] = rec["marked"] or sp["marked"]
            rec["circled"] = rec["circled"] or sp["illustration_circled"]
            hand_notes, editorial_notes = split_notes(sp["notes"])
            for n in hand_notes:
                if n not in rec["notes"]:
                    rec["notes"].append(n)
            for n in editorial_notes:
                if n not in rec["editorial"]:
                    rec["editorial"].append(n)
            if page["image"] not in rec["pages"]:
                rec["pages"].append(page["image"])
            if sp["marked"]:
                marked_here.append(rec["name"])

            for obs in sp["observations"]:
                rec["observations"].append({
                    # Stable across rebuilds: the species, the page it was read
                    # from, and its position within that species. The review file
                    # keys human verdicts by this, so it must not drift.
                    "id": f"{key}#{page['image']}#{len(rec['observations'])}",
                    "date": obs["sort_date"],
                    "dateRaw": obs["date_raw"],
                    "precision": obs["date_precision"],
                    "uncertain": bool(obs["date_uncertain"]) or bool(obs["date_before_book"]),
                    # The literal reading, when the 7-for-1 rule moved the year.
                    "rereadFrom": obs.get("date_reread_from"),
                    "location": obs["location_display"],
                    "locationKey": obs["location_key"],
                    "state": obs["state"],
                    "image": page["image"],
                })
                if obs["location_key"]:
                    loc = locations.setdefault(obs["location_key"], {
                        "key": obs["location_key"],
                        "name": title_case(obs["location_display"] or obs["location_key"]),
                        "state": obs["state"],
                        "visits": 0,
                        "species": [],
                    })
                    loc["visits"] += 1
                    loc["state"] = loc["state"] or obs["state"]
                    if rec["name"] not in loc["species"]:
                        loc["species"].append(rec["name"])

        if family:
            families[family].update(marked_here)

        spreads.append({
            "id": page["image"],
            "index": idx,
            "pageNumbers": page["page_numbers"],
            "pageType": page["page_type"],
            "heading": page["section_heading"],
            "family": family,
            "confidence": page["confidence"],
            "annotations": split_notes(page["unattached_annotations"])[0],
            "editorial": split_notes(page["unattached_annotations"])[1],
            "markedSpecies": marked_here,
            "speciesCount": len(page["species"]),
        })

    species = sorted(species_by_key.values(), key=lambda s: s["name"])
    for sp in species:
        sp["observations"].sort(key=lambda o: (o["date"] or "9999", o["location"] or ""))
        # Audubon reaches a little under half the book; the rest keep the
        # placeholder. See extract/fetch_plates.py for how the two are matched.
        if sp["key"] in plates:
            sp["plate"] = plate_record(plates[sp["key"]])

    all_obs = [
        {**o, "species": sp["name"], "family": sp["family"], "speciesKey": sp["key"]}
        for sp in species for o in sp["observations"]
    ]
    dated = sorted((o for o in all_obs if o["date"]), key=lambda o: o["date"])

    by_year: dict[str, int] = defaultdict(int)
    for o in dated:
        by_year[o["date"][:4]] += 1

    bundle = {
        "meta": {
            "book": "Birds of North America - Robbins, Bruun & Zim (Golden Press)",
            "spreads": len(spreads),
            "speciesRecorded": sum(1 for s in species if s["marked"]),
            "speciesOnPages": len(species),
            "observations": len(all_obs),
            "datedObservations": len(dated),
            "locations": len(locations),
            "families": len(families),
            "firstDate": dated[0]["date"] if dated else None,
            "lastDate": dated[-1]["date"] if dated else None,
            "needsReview": sum(1 for o in all_obs if o["uncertain"]),
        },
        "spreads": spreads,
        "species": species,
        "observations": all_obs,
        "locations": sorted(locations.values(), key=lambda l: -l["visits"]),
        "families": sorted(
            ({"name": k, "species": sorted(v), "count": len(v)} for k, v in families.items()),
            key=lambda f: -f["count"],
        ),
        "byYear": [{"year": y, "count": c} for y, c in sorted(by_year.items())],
    }

    OUT_JSON.parent.mkdir(parents=True, exist_ok=True)
    OUT_JSON.write_text(json.dumps(bundle, ensure_ascii=False, separators=(",", ":")))

    m = bundle["meta"]
    print(f"\n  spreads          {m['spreads']}")
    print(f"  species recorded {m['speciesRecorded']}  (of {m['speciesOnPages']} printed)")
    print(f"  observations     {m['observations']}  ({m['datedObservations']} dated)")
    print(f"  locations        {m['locations']}")
    print(f"  families         {m['families']}")
    print(f"  span             {m['firstDate']} to {m['lastDate']}")
    plated = sum(1 for s in species if s.get("plate") and (s["marked"] or s["observations"]))
    print(f"  audubon plates   {plated} of {m['speciesRecorded']} recorded species illustrated")
    print(f"\n  -> {OUT_JSON.relative_to(ROOT)} "
          f"({OUT_JSON.stat().st_size / 1024:.0f} KB)")
    imgs = sum(f.stat().st_size for f in (WEB / "pages").glob("*.jpg"))
    print(f"  -> web/public/pages + thumbs ({imgs / 1024 / 1024:.0f} MB)")
    return 0


if __name__ == "__main__":
    sys.exit(main())
