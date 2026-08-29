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

# 5:4, the shape of the card frame the stand-in sits in, and of every card file.
SIZE = (800, 640)

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
# Each is named by its card file. A card is already this frame's shape and already
# framed on the bird -- see card_box() in extract/fetch_plates.py -- so there is
# nothing to choose here but which plate.
VARIANTS = [
    "cassin-b8468a3c4f",   # Acorn Woodpecker, Cassin -- on a trunk
    "plate-318",           # American Avocet, Audubon -- long-billed
    "fuertes-38d3ae5ec9",  # Arctic Loon, Fuertes -- swimmer
    "plate-223",           # American Oystercatcher, Audubon -- in flight
    "brooks-ef5abfcf28",   # Western Meadowlark, Brooks -- beak open
    "plate-425",           # Anna's Hummingbird, Audubon -- in flowers
]


def sheet(name: str) -> Image.Image:
    with Image.open(PLATES / f"{name}-card.webp") as raw:
        img = raw.convert("RGB").resize(SIZE, Image.LANCZOS)

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
    for i, name in enumerate(VARIANTS, start=1):
        if not (PLATES / f"{name}-card.webp").exists():
            print(f"missing plate {name}", file=sys.stderr)
            return 1
        out = OUT_DIR / f"{STEM}-{i}.webp"
        img = sheet(name)
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
