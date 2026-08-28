#!/usr/bin/env python3
"""Map the book's species onto Audubon's Birds of America, and fetch the plates.

    .venv/bin/python extract/fetch_plates.py

Writes data/audubon_plates.json (the mapping, checked in) and web/public/plates/
(the artwork). Both steps are slow and hit the network, so build_web.py reads the
mapping rather than deriving it; rerun this only to refresh the artwork.

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

from PIL import Image

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
            if e.code not in (429, 503) or attempt == tries - 1:
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
    ("Gould", 1861, [
        "A Monograph of the Trochilidae",
        "A Monograph of the Trochilidae Volume 2",
        "A Monograph of the Trochilidae Volume 3",
        "A Monograph of the Trochilidae Volume 4",
        "A Monograph of the Trochilidae Volume 5",
        "A Monograph of the Trochilidae Supplement"]),
    ("Brooks", 1923, ["The Birds of California (1923)", "Allan Brooks"]),
    ("Fuertes", 1914, [
        "Works by Louis Agassiz Fuertes",
        "The warblers of North America (1907)",
        "Birds of New York (1910)", "Birds of New York (1912)",
        "Birds of New York (1914)", "Birds of New York (Eaton)"]),
]


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
                if f["page"] in seen:
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


def painted_box(picture: Image.Image, edge_min: float = 0.35,
                keep_min: float = 0.65) -> tuple[int, int, int, int]:
    """The part of the plate that is actually painted.

    Audubon worked on bare sheets: the Brown Creeper sits bottom-left with its tree
    up the right and nothing in between, so a card showing the whole plate shows a
    lot of paper. This eats whichever edge carries the least paint until every edge
    is mostly paint -- which is the crop a person would make by eye. It also takes
    the engraved lettering with it, that being an edge with no paint at all.

    It cannot take more than a third of either dimension. Without that floor it
    walks into a corner and beheads the coot; with it, the birds stay whole.
    """
    mask = picture.convert("HSV").getchannel("S").point(lambda v: 255 if v > 60 else 0)
    full_w, full_h = mask.size
    scale = max(full_w, full_h) / 160
    if scale > 1:
        mask = mask.resize((max(1, int(full_w / scale)), max(1, int(full_h / scale))))
    w, h = mask.size
    px = mask.load()
    left, top, right, bottom = 0, 0, w, h
    min_w, min_h = max(4, int(w * keep_min)), max(4, int(h * keep_min))

    for _ in range(w + h):
        across, down = max(1, right - left), max(1, bottom - top)
        edges = {
            "top": sum(1 for x in range(left, right) if px[x, top]) / across,
            "bottom": sum(1 for x in range(left, right) if px[x, bottom - 1]) / across,
            "left": sum(1 for y in range(top, bottom) if px[left, y]) / down,
            "right": sum(1 for y in range(top, bottom) if px[right - 1, y]) / down,
        }
        emptiest = min(edges, key=lambda k: edges[k])
        if edges[emptiest] >= edge_min:
            break
        if emptiest == "top" and bottom - top > min_h:
            top += 1
        elif emptiest == "bottom" and bottom - top > min_h:
            bottom -= 1
        elif emptiest == "left" and right - left > min_w:
            left += 1
        elif emptiest == "right" and right - left > min_w:
            right -= 1
        else:
            break

    sx, sy = full_w / w, full_h / h
    return (int(left * sx), int(top * sy), int(right * sx), int(bottom * sy))


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
        """Two files per plate: the whole sheet, and a crop for the card.

        The card wants the bird filling it; opening a bird wants the plate as it
        was composed. Cropping the stored file would settle that argument in the
        card's favour and lose the composition for good, so both are kept.
        """
        image, artist, name = item
        dst = OUT_IMG / f"{image}.webp"
        card = OUT_IMG / f"{image}-card.webp"
        if dst.exists() and card.exists():
            return False
        # Audubon's own site resizes on request; Commons was asked for a sized
        # thumbnail when the file was listed, so its url is already the right one.
        url = (PLATE_IMG.format(name) + f"?width={IMG_WIDTH}&format=webp"
               if artist == "Audubon" else name)
        whole = trim_paper(fetch(url))
        dst.write_bytes(whole)
        with Image.open(io.BytesIO(whole)) as img:
            picture = img.convert("RGB")
        out = io.BytesIO()
        picture.crop(painted_box(picture)).save(out, "WEBP", quality=88, method=6)
        card.write_bytes(out.getvalue())
        return True

    with ThreadPoolExecutor(max_workers=6) as pool:
        fetched = sum(pool.map(grab, sorted(wanted)))
    size = sum(f.stat().st_size for f in OUT_IMG.glob("*.webp"))
    print(f"  plates      {len(wanted)} ({fetched} newly fetched, {size / 1e6:.1f} MB)")


def main() -> int:
    species = json.loads(JOURNAL.read_text())["species"]

    urls = plate_urls()
    print(f"  plate pages {len(urls)}")
    with ThreadPoolExecutor(max_workers=6) as pool:
        plates = [p for p in pool.map(scrape, urls) if p["plate"]]

    mapping = build_mapping(plates, species)
    recorded = [s for s in species if s["marked"] or s["observations"]]
    audubon = sum(1 for s in recorded if s["key"] in mapping)

    print("  gathering the artists who filled his gaps...")
    filled = fill_gaps(mapping, species, gather_commons())

    OUT_MAP.write_text(json.dumps(mapping, ensure_ascii=False, indent=1, sort_keys=True) + "\n")
    hit = sum(1 for s in recorded if s["key"] in mapping)
    print(f"  matched     {len(mapping)} of {len(species)} printed species")
    print(f"              {hit} of {len(recorded)} she recorded "
          f"({round(100 * hit / len(recorded))}%) "
          f"-- {audubon} by Audubon, {filled} by the others")

    download(mapping)
    return 0


if __name__ == "__main__":
    sys.exit(main())
