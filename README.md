# A Life List

A digitised copy of the Golden Guide *Birds of North America* (Robbins, Bruun & Zim,
mid-1960s printing), annotated by hand over roughly fifty years and used as a
lifetime birding record.

The printed text belongs to the book. **The dates, places, circles and marginal notes
are the part that matters** — they exist in no other copy.

## What was actually in the photographs

The source is 151 phone photos, one per two-page spread. Contrary to the initial
assumption, this is not a journal with ruled entry rows; it is a printed field guide
used as a life list. The owner's conventions:

| On the page | Meaning |
|---|---|
| `UPPER NEWPORT BAY  2/18/74` above a species heading | A sighting of that species, there, then |
| Cursive marginal note | A field note — an ID tip, a comparison, a plumage remark |
| Circle drawn around an illustration | That figure matched the bird he saw |
| `✗` in a printed index checkbox | A life-list tick |

There are **no counts anywhere in the book**, so no tally of how many birds were
seen — only which, where, and when.

## Layout

```
data/raw_heic/     151 original .HEIC photos (gitignored, 428 MB)
data/pages/        JPEG conversions used for extraction
data/extracted/    one JSON per page — the resumable unit of work
data/journal.json  aggregated transcription
data/audubon_plates.json  species -> Audubon plate, and how it was matched
data/journal.db    SQLite: page / species / observation
extract/           the pipeline
web/               the Next.js site
```

## Pipeline

### 1. Convert

```bash
ls data/raw_heic/Birds/*.HEIC | xargs -P 8 -I{} sh -c \
  'b=$(basename "{}" .HEIC); sips -s format jpeg -s formatOptions 88 -Z 1568 "{}" --out "data/pages/$b.jpg"'
```

### 2. Extract

**This step is finished, and it is not run again.** All 151 pages are transcribed and
committed as `data/extracted/` and `data/journal.json`. The pipeline is kept as the
record of how that bundle was made.

```bash
.venv/bin/python extract/extract.py --build-only   # re-derive; no API calls, no key
```

`extract.py` is the only thing here that ever wanted an `ANTHROPIC_API_KEY`, and
nothing needs one now. **Anything further — re-reading a doubtful page, reclassifying
a note, enriching a species — goes through Claude Code on the subscription**, not
through metered API calls. The remaining commands, including the whole site build,
run offline.

Each page is sent to `claude-opus-5` with a **JSON Schema attached to the request**
(`output_config.format`), so the model is constrained to the right shape — there is no
parsing prose out of a response and malformed output is not possible.

Notable behaviours:

- **Resumable.** One JSON file per page; an interrupted run picks up where it stopped.
- **Streaming with a 32k output cap.** The back-index pages list ~200 species each and
  truncate at lower limits; truncation is detected explicitly rather than surfacing as
  a parse error.
- **Throttled and retried.** A cross-worker throttle spaces request starts; four
  attempts with exponential backoff and jitter.
- **Cached system prompt.** Stable across all 151 calls, so it is billed once.

Cost: roughly **$9** of API credit for the full run, about six minutes at six workers.

### 3. Derive

`extract/derive.py` computes sortable companions to the verbatim transcription. It
never overwrites what was written.

- **Dates keep their precision.** `2/18/74` is a day; `4/77` is a month; `1973` is a
  year; `EARLY 1950s` is a decade. Fuzzy dates are kept, not discarded.
- **Two-digit years resolve to 19xx.** Every legible date falls between the 1930s and
  the 1990s, so `74` is 1974.
- **A two-digit year in the 1910s is re-read as the 1970s.** A 7 written short loses
  its flag and reads as a 1, and the guide was not printed until 1966, so `11/8/12` is
  a 1972 sighting. Six dates move this way. The literal reading is kept in
  `reread_from` and shown beside the entry, and the observation stays flagged — the
  date is re-read, never overwritten.
- **Other suspect dates are flagged, never corrected.** What still predates the
  mid-1960s printing is either a retrospective entry he wrote from memory (several are
  explicit about it) or a misread digit the rule above does not cover. Both want a
  human eye.
- **Locations are canonicalised for grouping only.** He wrote Upper Newport Bay four
  different ways; the dashboard counts 28 visits while each page still shows the form
  he actually used that day.

### 4. Build the site

```bash
.venv/bin/python extract/build_web.py
cd web && npm run build && npm run start
```

`build_web.py` emits `web/public/data/journal.json`, merging in the Audubon mapping
from `data/audubon_plates.json` (see step 5); all four routes prerender from it, so
the site needs no database and no network at runtime. It also resizes the page
photographs into `web/public/pages` and `.../thumbs`, which `/review` and the life
list's detail rail both read.

### 5. Fetch the Audubon plates

```bash
.venv/bin/python extract/fetch_plates.py
```

Slow, and it hits the network, so it is a separate step: the mapping it writes to
`data/audubon_plates.json` is committed and `build_web.py` just reads it. Rerun only
to refresh the artwork.

Matching the book to Audubon is the hard part. The 1966 guide and his 1830s plate
titles agree on almost nothing — his Vesper Sparrow is a "Grass Finch, or Bay-winged
Bunting" — and sixty years of taxonomy moved the genera under the scientific names
(`Parus` -> `Poecile`). Matching on scientific name alone reaches 38% of what she
recorded. Resolving both sides through Wikipedia, whose bird articles are titled with
the current common name and whose redirects absorb both the synonyms and the archaic
names, reaches 60%. The late plates carry up to six birds each ("Bank Swallow and
Violet-green Swallow"), so their titles are split and resolved too.

### The site itself

| Route | What it is |
|---|---|
| `/` | **Life list** — the 349 birds he recorded, as cards with a detail rail: every sighting, the date and place as written, his notes |
| `/checklist` | **Checklist** — all 869 printed species grouped as the book groups them, ticked or not, with a per-group progress bar |
| `/places` | **Places** — the 148 named locations, each with its span and everything recorded there |
| `/overview` | **Overview** — the totals, entries by year, most-visited places, best-recorded groups |
| `/review` | **Review** — the 43 flagged entries, each beside the photograph it was read from, with a place to record what the page actually says |

The masthead runs the full width of the window, and the navigation is a bar beneath
it rather than a rail beside it — 48px tall and sticky, which every in-page rail and
toolbar is offset against (`top-12`). The life list adds a rail on the right once a
bird is chosen — the grid is laid out on `auto-fill`, so it reflows to fewer columns
when the rail opens and takes the room back when it closes — and the checklist has
one on the left for jumping between groups. The site is light only: the plates are
hand-coloured on cream paper, and dimming them to sit on a dark page was flattering
neither the artwork nor the type.

The masthead carries an Audubon plate of Carolina parakeets
(`web/public/banner.jpg`), fitted whole rather than cropped: the plate keeps its
proportions at the right of the band, and the rest of the band is its own paper tone,
with the plate's left edge masked into that mount so the picture ends the way a plate
ends on paper. The band is deep (280px) because the plate's width follows its height.
It also carries the running total — 349 of 869 — that used to sit in the sidebar.
The artwork is third-party: fine for something private, but it would need clearing
before the site went public.

The species placeholder is still line art of our own (see below), so the two do not
compete.

**Bird artwork is Audubon where Audubon exists.** 209 of the 349 recorded species —
400 of all 869 printed — carry their plate from *The Birds of America*, fetched into
`web/public/plates` by `extract/fetch_plates.py`. He painted 435 plates and died in
1851 having barely worked west of the Mississippi, so the western birds (Cactus Wren,
Roadrunner, most hummingbirds) have no plate and never will; those keep the line-art
placeholder (`web/public/bird-placeholder.svg`), and the detail panel says which case
a bird is in. The placeholder is line art on a transparent ground, matching the
masthead, so the card's own surface shows through.

Under **Where it appears**, the rail shows the photographed spread the bird was read
from — the transcription above it is a reading of that page, so the photograph is
what settles an argument — and the thumbnail links to the full-size scan. Because a
spread is wider than the rail is, the rail's left edge is a drag handle: it widens to
whatever the window can spare (arrow keys work too, `Home` resets it).

Each plate is stored twice. `plate-N.webp` is the whole sheet with only its blank
paper margin trimmed — what a bird shows when you open it. `plate-N-card.webp` is
cropped to the paint for the grid, because Audubon worked on bare sheets: the Brown
Creeper sits bottom-left with its tree up the right and nothing between, and a card
of that is mostly paper. `painted_box()` eats whichever edge carries the least paint
until every edge is mostly paint, which also takes the engraved lettering. It may not
take more than a third of either dimension — without that floor it walks into a
corner and beheads the coot.

Even cropped, a portrait plate loses half its height to a landscape card, so each
carries a focal point computed from the ink itself (`focus_y()` in `build_web.py`)
rather than a single crop guess — Audubon hung the Vesper Sparrow at the foot of a
prickly pear, and centring on the sheet would give a card of cactus.

The guide's own plates are still not digitised and are not shown anywhere.

### The review loop

`/review` shows the photographs at full size, because settling a doubtful reading
means looking at the hand. Each flagged entry gives the raw writing, what the
transcription made of it, why it was flagged, and the transcriber's own caveat.

A verdict — *reading is right* / *needs correcting* / *still unsure*, plus an optional
date, place and note — is written to **`data/review.json`** by the `POST /api/review`
route handler:

```json
{
  "version": 1,
  "entries": {
    "COSTA S HUMMINGBIRD#IMG_8845#0": {
      "verdict": "corrected",
      "date": "6/30/77",
      "note": "blue ink, the 7 is clear at full size"
    }
  }
}
```

The key is `species#page#index`, stable across rebuilds. The verdicts live *beside*
the transcription rather than inside it, so a human decision can never be silently
overwritten by a rebuild — and asking Claude to apply the file is a separate,
deliberate step. Saving needs the site running locally (`npm run start`); on a
read-only host the page says so and offers the verdicts as JSON to copy.

## Two things worth knowing when reading the site

**"In his hand" is his; "transcriber's note" is not.** Roughly two-thirds of the
extracted "notes" were actually caveats about legibility rather than the owner's
words. `split_notes()` separates them, and the interface sets them apart — his in a
quoted serif, the transcriber's in small muted print — so nothing is attributed to a
dead man that he did not write. A date he wrote short (`4/77`) is shown beside the
rendered date; a long "date" that is really the transcriber describing a smudge drops
to the transcriber's voice instead.

**Family means the book's own grouping** — `Buteos`, `Towhees`, `Peeps` — not modern
taxonomy. That is what a reader of this particular book would recognise.

## Known limits

- The back-index pages are dense checkbox grids photographed at an angle, and all
  return `confidence: low`. They contribute most of the life-list ticks, so the
  species total is the softest number on the site. It was softer than it looked
  until 2026-08-27: the index files birds surname-first — "Avocet, American" — and
  reading that as a different bird from the account's "American Avocet" counted 488
  printed species twice, 100 of them on the life list. `species_key()` now undoes
  the inversion, which is why the totals are 349 of 869 rather than 449 of 1,357.
- Only 560 printed species carry a family of their own, so a species inherits the
  heading of the page it sits on. 138 ticks come from the index grids alone and 51
  from pages whose heading was illegible; both land in named buckets — *Ticked in the
  index* and *No heading on the page* — which are kept out of any group ranking.
- 43 observations carry a `?`. They are listed on the summary page.
- Nine numbers in the `IMG_8763`–`IMG_8922` sequence were never in the folder; the
  set is complete as delivered.
- The Audubon match is name-based, so it inherits the guide's own naming. Audubon
  painted 29 species twice and the matcher prefers the plate he titled with the
  bird's own name; only the Bald Eagle needed a hand override (plate 11 is the
  disputed "Bird of Washington"), in `OVERRIDES` in `fetch_plates.py`. Every mapping
  records how it was made in `matchedBy`, so the loose ones — 24 matched only by a
  name inside a composite plate's title — can be audited.
