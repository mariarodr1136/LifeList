#!/usr/bin/env python3
"""Draw the stand-ins used where no artist in the collection painted the bird.

73 of the 348 species on the life list have no plate. They used to fall back to a
line drawing of a generic bird, which read as a missing asset rather than as a
statement about the record.

These are plates instead -- by the same hands credited everywhere else, washed back
toward the paper so nothing here competes with a real plate on the next card along.
Several are written, and the interface picks one per species by name, so a screen of
unplated birds does not look like the same tile repeated.

Every plate on disk is already somebody's portrait, so a stand-in is always a bird
borrowed from elsewhere in the book. Two things keep that honest: the wash, which
stops it reading as this bird's record, and the caption.

The caption is NOT drawn here. It is laid over the image in the interface (see
BirdImage in components/ui.tsx), so it stays in the site's own typeface and stays
crisp at any size.

    python extract/make_placeholder.py
"""

from __future__ import annotations

import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter

ROOT = Path(__file__).resolve().parent.parent
PLATES = ROOT / "web" / "public" / "plates"
OUT_DIR = ROOT / "web" / "public"
STEM = "bird-placeholder"

# 5:4, the shape of the card frame the stand-in most often sits in.
SIZE = (800, 640)
ASPECT = SIZE[0] / SIZE[1]

# The plates' own paper, warmed slightly so the sheet reads as paper next to the
# interface's cooler greys rather than as an empty panel.
PAPER = (240, 236, 227)

# How far the bird is washed back: 0 is the plate as painted, 1 is bare paper.
# Far enough that it cannot be taken for the record, near enough to stay a bird.
WASH = 0.52
SATURATION = 0.50

# Six plates that carry a single clear silhouette and do not repeat a shape, drawn
# from four of the artists the site credits. This list's length is what stops a
# screen of unplated birds from looking tiled.
#
# Each entry is one stand-in. Only `plate` is required.
#
#   focus     where the crop window sits, 0 the top of the plate and 100 the
#             bottom. Only meaningful with source "full": a card file is already
#             this frame's shape, so a window on it has nowhere to slide.
#   zoom      how far to crop in. 1 uses the plate's full width; 1.4 takes the
#             middle 71% of it, so the bird arrives larger.
#   source    "card" (default) uses the tight crop the pipeline made; "full" uses
#             the whole sheet. Reach for "full" when the card crop has cut in too
#             close for the bird to sit anywhere but against an edge -- the sheet
#             has the artist's own margin on it, which is real paint-free plate
#             rather than paper invented here.
VARIANTS: list[dict] = [
    {"plate": "cassin-b8468a3c4f"},   # Acorn Woodpecker, Cassin -- on a trunk
    {"plate": "plate-318"},           # American Avocet, Audubon -- long-billed
    {"plate": "fuertes-38d3ae5ec9"},  # Arctic Loon, Fuertes -- swimmer
    {"plate": "plate-223"},           # American Oystercatcher, Audubon -- in flight
    # Brooks drew the meadowlark's open beak hard against the top edge of its own
    # card crop, so any window beheaded it. The full sheet keeps his margin above
    # the bird, which is where the room comes from.
    {"plate": "brooks-ef5abfcf28", "source": "full", "focus": 49, "zoom": 1.2},
    {"plate": "plate-425"},           # Anna's Hummingbird, Audubon -- in flowers
]


def crop_to_frame(img: Image.Image, focus_y: int, zoom: float = 1.0) -> Image.Image:
    """The plate, cropped to the frame the way the interface would crop it.

    At zoom 1 this is exactly what the browser does with object-cover: fit the
    frame to the long edge and slide the window onto the paint. Above 1 the window
    is shrunk about the centre first, which crops in on the bird.
    """
    w, h = img.size
    # The largest frame-shaped window the plate can hold, then zoomed in.
    win_w = min(w, h * ASPECT) / max(1.0, zoom)
    win_h = win_w / ASPECT
    left = round((w - win_w) / 2)
    top = round((h - win_h) * (focus_y / 100))
    box = (left, top, left + round(win_w), top + round(win_h))
    return img.crop(box).resize(SIZE, Image.LANCZOS)


def sheet(name: str, focus_y: int, zoom: float, source: str) -> Image.Image:
    suffix = "" if source == "full" else "-card"
    with Image.open(PLATES / f"{name}{suffix}.webp") as raw:
        img = crop_to_frame(raw.convert("RGB"), focus_y, zoom)

    img = ImageEnhance.Color(img).enhance(SATURATION)
    img = Image.blend(img, Image.new("RGB", SIZE, PAPER), WASH)

    # Lift the middle further, so the caption has quiet ground whatever the bird is
    # doing behind it. Without this the label lands on a wing as often as on sky.
    glow = Image.new("L", SIZE, 0)
    ImageDraw.Draw(glow).ellipse(
        (SIZE[0] * 0.16, SIZE[1] * 0.30, SIZE[0] * 0.84, SIZE[1] * 0.70), fill=150
    )
    img = Image.composite(Image.new("RGB", SIZE, PAPER), img,
                          glow.filter(ImageFilter.GaussianBlur(80)))

    # No vignette at the edges: the card already clips to its own rounded corners,
    # and fading the border into PAPER drew a pale strip along the top of every
    # plate that happens to be dark up there.
    return img


def main() -> int:
    made = []
    for i, spec in enumerate(VARIANTS, start=1):
        name = spec["plate"]
        if not (PLATES / f"{name}-card.webp").exists():
            print(f"missing plate {name}", file=sys.stderr)
            return 1
        out = OUT_DIR / f"{STEM}-{i}.webp"
        img = sheet(name, spec.get("focus", 50), spec.get("zoom", 1.0),
                    spec.get("source", "card"))
        img.save(out, "WEBP", quality=88, method=6)
        made.append(img)
        print(f"wrote {out.name:24} from {name:22} {out.stat().st_size // 1024:>3} KB")

    # A contact sheet, for looking at all of them at once. Not shipped.
    cols, pad = 3, 16
    rows = (len(made) + cols - 1) // cols
    tw, th = SIZE[0] // 2, SIZE[1] // 2
    sheet_img = Image.new("RGB", (cols * tw + (cols + 1) * pad,
                                  rows * th + (rows + 1) * pad), (255, 255, 255))
    for i, img in enumerate(made):
        x = pad + (i % cols) * (tw + pad)
        y = pad + (i // cols) * (th + pad)
        sheet_img.paste(img.resize((tw, th), Image.LANCZOS), (x, y))
    contact = Path("/tmp/placeholder-contact.png")
    sheet_img.save(contact)

    print(f"\n{len(VARIANTS)} variants -- keep PLACEHOLDERS in components/ui.tsx "
          f"in step with this.\ncontact sheet: {contact}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
