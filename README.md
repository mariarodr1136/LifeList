# A Life List – Birds of North America 🦆

![Next.js](https://img.shields.io/badge/Next.js-16-000000) ![React](https://img.shields.io/badge/React-19-61DAFB) ![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6) ![Tailwind CSS](https://img.shields.io/badge/Tailwind%20CSS-4-06B6D4) ![Python](https://img.shields.io/badge/Python-3.10-3776AB) ![Claude](https://img.shields.io/badge/Claude-Opus%205-D97757) ![Pillow](https://img.shields.io/badge/Pillow-Imaging-8A2BE2)

One man carried a single field guide — *Birds of North America* (Robbins, Bruun & Zim,
Golden Press, mid-1960s) — for fifty years, and wrote in it. Ticks in the back index,
circles round the plates, dates and place names in the margins, field notes in his own
hand.

This project reads that book page by page and turns it into a site: **348 birds he
recorded, across 148 places, between 1950 and 1995**. The printed text belongs to the
book; the dates, places, circles and marginal notes are the part that matters, and they
exist in no other copy. Nothing here is invented — where a reading is doubtful, the site
says so.

---


<img width="4310" height="3407" alt="IMG_9034" src="https://github.com/user-attachments/assets/502677d7-af8c-4b1e-973f-95f6a389260e" />


---

## What was actually in the photographs

The source is 151 phone photos, one per two-page spread. Contrary to the first
assumption, this is not a journal with ruled entry rows; it is a printed field guide
used as a life list. His conventions:

| On the page | Meaning |
|---|---|
| `UPPER NEWPORT BAY 2/18/74` above a species heading | A sighting of that species, there, then |
| Cursive marginal note | A field note — an ID tip, a comparison, a plumage remark |
| Circle drawn around an illustration | That figure matched the bird he saw |
| Tick in the back-index checkbox | Seen at some point, no date given |

### What it adds up to

| | |
|---:|:---|
| **348** | species he recorded, of 866 the guide prints |
| **303** | dated or placed entries, 275 of them carrying a date |
| **148** | named places, from Upper Newport Bay to a pelagic trip off San Diego |
| **45** | years between the first entry and the last |
| **138** | species carrying a field note in his own hand |
| **33** | figures circled on the plate |
| **151** | photographed spreads, read one at a time |
| **43** | entries the transcription is not sure about |

He birded California, mostly. Upper Newport Bay is his commonest place by some way —
28 species — then Lake Matthews, Soda Springs, Long Beach, Bolsa Chica.

---

## The artwork

The guide's own plates are not digitised, so the birds are illustrated with the work of
the people who painted them first. **275 of the 348 carry a plate.**

Audubon does most of it — 210 birds — and stops where he stopped: he died in 1851 having
barely worked west of the Mississippi, and the man with the guide birded the Southwest.
So the gaps go to the artists who were there, tried oldest first, so the page drifts
from Audubon's hand as slowly as the material allows.

| Artist | Birds | |
|---|---:|---|
| **Audubon** | 210 | *The Birds of America*, 1827–38 |
| **Fuertes** | 18 | the acknowledged successor, western species |
| **Cassin** | 17 | 1856 — explicitly the birds "not given by former American authors" |
| **Gould** | 11 | the hummingbird monograph, and his European volumes for birds that arrived here later |
| **Brooks** | 6 | *The Birds of California*, 1923 |
| **Elliot** | 5 | 1866 — a folio made to figure exactly what Audubon missed |
| **Jasper** | 4 | Studer's atlas, 1903 |
| **Baird**, **Nehrling**, **Selby**, **Bird-Lore** | 1 each | |

Every one of these works is out of copyright. The 73 birds with no plate keep a
placeholder, and the panel says plainly that nobody painted them — the Cattle Egret
reached America in the 1950s, the Chukar was introduced, and no Victorian ever set eyes
on a Five-striped Sparrow.

---

## The site

Five routes, all prerendered from one JSON file. No database, no network at runtime.

### Life list

Every bird he recorded, as cards. Choosing one opens a rail with the sightings exactly
as written, his notes, the transcriber's caveats, and the plate.

The card shows a crop tightened onto the paint; opening a bird shows the whole plate as
its artist composed it, engraved caption and all. The rail's left edge drags to widen
it, because a photographed spread is wider than a column is.

### Where it appears

Under the sightings, the rail carries the photograph the bird was read from. The
transcription is a reading of that page, so the page is what settles an argument.

### Checklist

All 866 printed species, grouped the way the book groups them, ticked or not.

### Places

The 148 places he named, each with its span and everything recorded there. Spelling
variants are folded together; the page itself always keeps the wording he used that day.

### Overview

The totals, entries by year, most-visited places, best-recorded groups.

### Review

The 43 doubtful entries, each beside the photograph it came from. A verdict — *reading
is right* / *needs correcting* / *still unsure* — is written to `data/review.json`
beside the archive rather than into it, so the transcription stays as read and the
human judgement stays separable.

**All 43 have now been reviewed**: 41 corrected, 2 still unsure. `build_web.py` folds
the verdicts in at build time, parsing a corrected date with the same `parse_date()`
that read the page, so "1950's" resolves to the same decade precision the archive uses
everywhere. The reading is kept beside the correction rather than replaced — the rail
says *read from the page as "7/3/23"; corrected on review* — because the disagreement
between the page and the reader is the interesting part.

That review moved the archive's own headline. The earliest entry had been a Purple Finch
at 1923, which is a 7 misread as a 2; the Ring-necked Pheasant's "EARLY 1930's" is
"1950's". **The span is 1950–1995, not 1923–1995**, and 17 entries that had no readable
date now have one.

---

## Layout

```
data/raw_heic/            151 original .HEIC photos (gitignored, 428 MB)
data/pages/               JPEG conversions used for extraction
data/extracted/           one JSON per page — the resumable unit of work
data/journal.json         aggregated transcription
data/audubon_plates.json  species -> plate, and how it was matched
data/review.json          human verdicts on doubtful readings
extract/                  the pipeline
web/                      the Next.js site
```

## Pipeline

```bash
.venv/bin/python extract/extract.py        # read the photographs
.venv/bin/python extract/derive.py         # sortable companions to the transcription
.venv/bin/python extract/fetch_plates.py   # match birds to plates, fetch the artwork
.venv/bin/python extract/build_web.py      # emit the site's data bundle
cd web && npm run build && npm run start
```

`fetch_plates.py` is slow and hits the network, so the mapping it writes to
`data/audubon_plates.json` is committed and `build_web.py` just reads it. Rerun it only
to refresh the artwork.

### Matching a 1966 guide to a 19th-century folio

This is the hard part, and worth explaining because the naive version fails.

The guide and the plates agree on almost nothing. Audubon's Vesper Sparrow is a **"Grass
Finch, or Bay-winged Bunting"**; his Horned Lark is a "Shore Lark". Sixty years of
taxonomy also moved the genera underneath the scientific names — `Parus` became
`Poecile`, `Dendroica` became `Setophaga`. Matching on scientific name alone reaches
38% of what he recorded.

Both sides are therefore resolved through Wikipedia, whose bird articles are titled with
the current common name and whose redirects absorb the synonyms and the archaic names.
That reaches 60%. The late plates carry up to six birds each — plate 424 has six — so
their titles are split and resolved too.

**Two guards stop the wrong bird appearing.** A plate that names fewer other species is
preferred over one whose page mentions six. And where the guide's name and the
candidate's both resolve to a Wikipedia article, they must resolve to the *same* one —
without that, the guide's White-necked Raven (*Corvus cryptoleucus*, now the Chihuahuan
Raven) was illustrated with *Corvus albicollis*, an African bird that once shared the
English name.

Nine plates were **read off the image by eye** and written down rather than matched;
they are marked `read-from-the-plate`. That was necessary for Elliot: the Archive's OCR
mangles his engraved captions, and its plate numbering disagrees with his own list of
plates, so of five automatic pairings tried, three were wrong. Hand-picking the rest
found four more from twenty-eight candidates reviewed — and caught two impostors: a
plate captioned "VIOLET-GREEN SWALLOWS" offered for two flycatchers, and a falcon
offered for the Gila Woodpecker.

### Preparing a plate

Each plate is stored twice. `plate-N.webp` is the whole sheet with only its blank paper
margin trimmed — what a bird shows when you open it. `plate-N-card.webp` is cropped to
the paint for the grid, because these artists worked on bare sheets: the Brown Creeper
sits bottom-left with its tree up the right and nothing in between, and a card of that
is mostly paper.

`painted_box()` eats whichever edge carries the least paint until every edge is mostly
paint, which takes the engraved lettering with it. It may not take more than a third of
either dimension — without that floor it walks into a corner and beheads the coot.

The card frame is 5:4. A 16:10 frame showed barely half the height of a portrait plate
and dropped the top, which is where the heads are; the Bald Eagle and both Barn Swallows
came out headless. Each plate also carries a focal point computed from the ink itself,
so the Vesper Sparrow's card centres on the sparrow rather than the prickly pear above
it.

The site is light only: the plates are hand-coloured on cream paper, and dimming them
for a dark page flattered neither the artwork nor the type.

---

## Two things worth knowing when reading the site

**Dates are shown at the precision he wrote them.** "4/77" stays April 1977; "early
1950s" stays a decade. Rendering either as a full date would invent a precision he never
claimed.

**The transcriber's voice is kept apart from his.** A caveat about illegible handwriting
is the reader-of-the-photograph talking, not the man with the book, so the two are split
and the site sets them differently.

---

## Known limits

- The back-index pages are dense checkbox grids photographed at an angle, and all return
  `confidence: low`. They contribute most of the ticks, so the species total is the
  softest number here.
- That total was softer than it looked until the inversion was fixed: the index files
  birds surname-first — "Avocet, American" — and reading that as a different bird from
  the account's "American Avocet" counted 488 printed species twice, 100 of them on the
  life list.
- The transcription has misreadings of its own. `Housf Finch` sat beside `Finch, House`
  as a separate species; certain errors are corrected in `MISREADINGS`, and possessives
  are normalised so `Xantus'` and `Xantus's` agree. A name the book spells oddly of its
  own accord is left alone — that is the book's business.
- Attributing a plate is the softest part of the artwork. Audubon's come one species to
  a page from his own publisher; the others are matched through names a scanner's
  name-finder read off a page, which can name a bird the plate only mentions. Every
  mapping records how it was made in `matchedBy`, and the non-Audubon attributions are
  short enough to read in full.
- One plate was excluded by name rather than by rule: the House Sparrow's was a
  pen-and-ink sketch with no colour in it. Measuring colour would have thrown out
  Audubon's white seabirds too — his Gull-billed Tern and Manx Shearwater are as pale as
  the sketch was.
- 43 observations carry a `?`. They are listed on `/review`.
- Nine numbers in the `IMG_8763`–`IMG_8922` sequence were never in the folder; the set is
  complete as delivered.

---

## Credits

Plates from *John James Audubon's Birds of America* courtesy of the John James Audubon
Center at Mill Grove, the Montgomery County Audubon Collection, and Zebra Publishing.
The later plates are scans held by the Biodiversity Heritage Library, by way of
Wikimedia Commons, and Elliot's by way of the Internet Archive. All of the artwork is
out of copyright.
