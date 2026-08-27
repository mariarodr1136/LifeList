"""Derived fields computed from the verbatim transcription.

Nothing here touches the model output -- `date_raw` and `location` stay exactly as
the owner wrote them. These functions add sortable, groupable companions so the web
UI can build a timeline and a location filter without ever losing the original hand.
"""

from __future__ import annotations

import re
from datetime import date

# The Golden Guide printing this book comes from is mid-1960s. A sighting dated
# before it went to press is either a retrospective entry the owner backfilled from
# memory (he wrote several, e.g. "EARLY 1950s") or a misread digit -- handwritten 7
# reads as 1, and 8 as 2. Either way it wants a human eye, so we flag rather than
# silently correct or discard.
BOOK_PUBLISHED = 1966
EARLIEST_PLAUSIBLE = 1900

# One misreading is common enough to have a rule of its own. A hastily written 7
# loses its flag and reads as a 1, so a two-digit year that resolves into the 1910s
# is almost certainly a 197x: the book was not printed until 1966, and the 1970s are
# where the rest of the archive lives. Those years are re-read rather than left as
# written -- but never overwritten. `date_raw` still holds what is on the page and
# `reread_from` records the literal reading, so the site can show both.
REREAD_DECADE = (1910, 1919)
REREAD_OFFSET = 60

MONTHS = {
    "jan": 1, "feb": 2, "mar": 3, "apr": 4, "may": 5, "jun": 6,
    "jul": 7, "aug": 8, "sep": 9, "oct": 10, "nov": 11, "dec": 12,
}

UNCERTAIN_MARKERS = ("?", "uncertain", "could be", "illegible", "unclear", "possibly")


def _expand_year(y: int) -> tuple[int, int | None]:
    """Two-digit years resolve into the 1900s, with the 1910s re-read as the 1970s.

    Every legible date in this book falls between the 1930s and the 1990s, so "74"
    is 1974. There is no 21st-century reading to disambiguate against.

    Returns the year to use and, when the 7-for-1 rule fired, the literal reading it
    replaced -- so nothing is corrected without saying so.
    """
    if y >= 100:
        return y, None
    year = y + 1900
    if REREAD_DECADE[0] <= year <= REREAD_DECADE[1]:
        return year + REREAD_OFFSET, year
    return year, None


def parse_date(raw: str | None) -> dict:
    """Resolve a handwritten date into a sortable value plus how precise it is.

    Returns sort_date (ISO, always the earliest instant the writing could mean),
    precision ("day" | "month" | "year" | "decade" | None), and flags for review.
    A partial date like "4/77" is real information and is kept at month precision
    rather than thrown away for not being a full date.
    """
    out = {
        "date_iso": None,        # only set at day precision -- a real calendar date
        "sort_date": None,       # always set when anything parsed, for ordering
        "precision": None,
        "uncertain": False,      # the transcriber flagged the digits as unclear
        "before_book": False,    # predates the book: retrospective entry or misread
        "reread_from": None,     # the literal reading the 7-for-1 rule replaced
    }
    if not raw:
        return out

    text = raw.strip()
    lowered = text.lower()
    out["uncertain"] = any(m in lowered for m in UNCERTAIN_MARKERS)

    # "EARLY 1950s", "LATE 1960's", "mid 1930s"
    m = re.search(r"\b(early|mid|late)?\s*(\d{4})\s*'?s\b", lowered)
    if m:
        decade = int(m.group(2))
        if EARLIEST_PLAUSIBLE <= decade <= 2000:
            out.update(sort_date=date(decade, 1, 1).isoformat(), precision="decade",
                       before_book=decade + 9 < BOOK_PUBLISHED)
            return out

    # Full date: M/D/YY, M/D/YYYY, M-D-YY
    m = re.search(r"\b(\d{1,2})\s*[/\-.]\s*(\d{1,2})\s*[/\-.]\s*(\d{2,4})\b", text)
    if m:
        month, day = int(m.group(1)), int(m.group(2))
        year, reread = _expand_year(int(m.group(3)))
        if 1 <= month <= 12 and 1 <= day <= 31 and EARLIEST_PLAUSIBLE <= year <= 2000:
            try:
                iso = date(year, month, day).isoformat()
            except ValueError:
                pass
            else:
                out.update(date_iso=iso, sort_date=iso, precision="day",
                           before_book=year < BOOK_PUBLISHED,
                           reread_from=reread,
                           # A re-read is an interpretation, so it stays flagged.
                           uncertain=out["uncertain"] or reread is not None)
                return out

    # Month name + year: "OCTOBER 1969", "JANUARY 1973", "June 1981"
    m = re.search(r"\b([a-z]{3,9})\.?\s+(\d{4})\b", lowered)
    if m and m.group(1)[:3] in MONTHS:
        month, year = MONTHS[m.group(1)[:3]], int(m.group(2))
        if EARLIEST_PLAUSIBLE <= year <= 2000:
            out.update(sort_date=date(year, month, 1).isoformat(), precision="month",
                       before_book=year < BOOK_PUBLISHED)
            return out

    # Month/year only: "4/77", "10/1973"
    m = re.fullmatch(r"\s*(\d{1,2})\s*[/\-]\s*(\d{2,4})\s*\??\s*", text)
    if m:
        month = int(m.group(1))
        year, reread = _expand_year(int(m.group(2)))
        if 1 <= month <= 12 and EARLIEST_PLAUSIBLE <= year <= 2000:
            out.update(sort_date=date(year, month, 1).isoformat(), precision="month",
                       before_book=year < BOOK_PUBLISHED,
                       reread_from=reread,
                       uncertain=out["uncertain"] or reread is not None)
            return out

    # Bare year: "1973"
    m = re.search(r"\b(19\d{2})\b", text)
    if m:
        year = int(m.group(1))
        out.update(sort_date=date(year, 1, 1).isoformat(), precision="year",
                   before_book=year < BOOK_PUBLISHED)
        return out

    return out


# --------------------------------------------------------------------------- #
# locations
# --------------------------------------------------------------------------- #

# The owner wrote the same place many ways over the years -- "UPPER NEWPORT BAY",
# "Upper Newport Bay, Calif.", "UPPER NEWPORT BAY, CALIF". Canonicalising lets the
# dashboard count 25 visits instead of scattering them across four rows, while the
# page view still shows whichever form he actually wrote that day.
STATE_SUFFIXES = {
    "calif": "CA", "california": "CA", "ca": "CA",
    "ariz": "AZ", "arizona": "AZ", "az": "AZ",
    "nev": "NV", "nevada": "NV", "nv": "NV",
    "ore": "OR", "oregon": "OR", "or": "OR",
    "wash": "WA", "washington": "WA", "wa": "WA",
    "tex": "TX", "texas": "TX", "tx": "TX",
    "colo": "CO", "colorado": "CO", "co": "CO",
    "mex": "MX", "mexico": "MX",
    "n.m": "NM", "nm": "NM", "new mexico": "NM",
    "utah": "UT", "ut": "UT",
    "mont": "MT", "montana": "MT",
    "wyo": "WY", "wyoming": "WY",
    "fla": "FL", "florida": "FL",
}

# Abbreviations the owner used interchangeably with their expansions.
ALIASES = {
    "s.d": "SAN DIEGO", "sd": "SAN DIEGO", "s d": "SAN DIEGO",
    "l.a": "LOS ANGELES", "la": "LOS ANGELES",
    "mts": "MOUNTAINS", "mt": "MOUNT", "cyn": "CANYON", "co": "COUNTY",
    "n": "NORTH", "s": "SOUTH", "e": "EAST", "w": "WEST",
}


def canonical_location(raw: str | None) -> dict:
    """Fold spelling and punctuation variants of one place into a single key.

    Returns the grouping key, a readable display name, and the state where the
    owner recorded one.
    """
    if not raw or not raw.strip():
        return {"key": None, "display": None, "state": None}

    text = raw.strip()
    # Split trailing state off the last comma-delimited part.
    parts = [p.strip() for p in re.split(r"\s*,\s*", text) if p.strip()]
    state = None
    while len(parts) > 1:
        tail = re.sub(r"[.\s]+$", "", parts[-1]).lower()
        if tail in STATE_SUFFIXES:
            state = STATE_SUFFIXES[tail]
            parts.pop()
        else:
            break

    core = ", ".join(parts)
    # Normalise for the grouping key only; display keeps the readable form.
    key = core.upper()
    key = re.sub(r"[.’']", "", key)
    key = re.sub(r"[^A-Z0-9 ]+", " ", key)
    tokens = [ALIASES.get(t.lower(), t) for t in key.split()]
    key = " ".join(tokens).strip()

    display = ", ".join(p.rstrip(".") for p in parts)
    if state:
        display = f"{display}, {state}"

    return {"key": key or None, "display": display or None, "state": state}
