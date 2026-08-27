#!/usr/bin/env python3
"""Batch-extract the handwritten annotations from photographed field-guide pages.

Vision runs through the Claude API with a JSON schema attached to the request, so
the model is constrained to return exactly the shape we expect -- no prose, no
markdown fence, no missing fields.

    export ANTHROPIC_API_KEY=sk-ant-...
    .venv/bin/python extract/extract.py                # every page, resumable
    .venv/bin/python extract/extract.py --limit 3      # smoke test
    .venv/bin/python extract/extract.py --force        # redo pages already done
    .venv/bin/python extract/extract.py --build-only   # rebuild journal.json + db

One JSON file is written per page under data/extracted/, so an interrupted run
resumes exactly where it stopped and one bad page never costs the whole batch.
"""

from __future__ import annotations

import argparse
import base64
import json
import random
import re
import sqlite3
import sys
import threading
import time
from concurrent.futures import ThreadPoolExecutor, as_completed
from dataclasses import dataclass
from datetime import date
from pathlib import Path

import os

import anthropic

sys.path.insert(0, str(Path(__file__).resolve().parent))
import prompt as P  # noqa: E402
import derive  # noqa: E402

ROOT = Path(__file__).resolve().parent.parent


def load_dotenv() -> None:
    """Read ANTHROPIC_API_KEY from a gitignored .env so it never has to be exported.

    Only fills variables that are not already set, so a real environment variable
    always wins over the file.
    """
    env_file = ROOT / ".env"
    if not env_file.exists():
        return
    for line in env_file.read_text().splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        os.environ.setdefault(key.strip(), value.strip().strip("'\""))


load_dotenv()


PAGES_DIR = ROOT / "data" / "pages"
OUT_DIR = ROOT / "data" / "extracted"
JOURNAL_JSON = ROOT / "data" / "journal.json"
DB_PATH = ROOT / "data" / "journal.db"

MODEL = "claude-opus-5"
# Index pages at the back list ~200 species each, which is far more output than a
# normal spread. Streaming lets us raise the ceiling without risking an HTTP timeout.
MAX_TOKENS = 32000
MAX_ATTEMPTS = 4
BASE_BACKOFF = 3.0        # seconds, doubled per retry, plus jitter
MIN_GAP = 0.35            # minimum seconds between request starts across all workers

# Anthropic list pricing, $ per million tokens, for the run cost estimate.
PRICE_IN, PRICE_OUT = 5.00, 25.00

PAGE_TYPES = {"species_account", "plate", "index", "front_matter", "cover", "other"}


class Throttle:
    """Spaces out request starts so a pool of workers cannot burst into a 429."""

    def __init__(self, min_gap: float):
        self.min_gap = min_gap
        self._lock = threading.Lock()
        self._next_at = 0.0

    def wait(self) -> None:
        with self._lock:
            now = time.monotonic()
            sleep_for = max(0.0, self._next_at - now)
            self._next_at = max(now, self._next_at) + self.min_gap
        if sleep_for:
            time.sleep(sleep_for)


@dataclass
class Result:
    stem: str
    ok: bool
    data: dict | None = None
    error: str | None = None
    tokens_in: int = 0
    tokens_out: int = 0
    attempts: int = 0

    @property
    def cost(self) -> float:
        return self.tokens_in / 1e6 * PRICE_IN + self.tokens_out / 1e6 * PRICE_OUT


def _clean(data: dict, stem: str) -> dict:
    """Normalise the model's output and attach derived fields.

    The schema already guarantees the shape, so this only trims whitespace, drops
    empty rows, and adds the parsed ISO date alongside the raw transcription.
    """
    species_out = []
    for sp in data.get("species") or []:
        name = (sp.get("common_name") or "").strip()
        if not name:
            continue

        observations = []
        for obs in sp.get("observations") or []:
            raw = (obs.get("date_raw") or "").strip() or None
            loc = (obs.get("location") or "").strip() or None
            if not raw and not loc:
                continue
            d = derive.parse_date(raw)
            place = derive.canonical_location(loc)
            observations.append({
                "date_raw": raw,
                "date_iso": d["date_iso"],
                "sort_date": d["sort_date"],
                "date_precision": d["precision"],
                "date_uncertain": d["uncertain"],
                "date_before_book": d["before_book"],
                "date_reread_from": d["reread_from"],
                "location": loc,
                "location_key": place["key"],
                "location_display": place["display"],
                "state": place["state"],
            })

        species_out.append({
            "common_name": name,
            "scientific_name": (sp.get("scientific_name") or "").strip() or None,
            "marked": bool(sp.get("marked")),
            "illustration_circled": bool(sp.get("illustration_circled")),
            "observations": observations,
            "notes": [str(n).strip() for n in (sp.get("notes") or []) if str(n).strip()],
        })

    page_type = data.get("page_type")
    confidence = data.get("confidence")
    return {
        "image": stem,
        "page_numbers": [int(p) for p in (data.get("page_numbers") or []) if isinstance(p, int)],
        "page_type": page_type if page_type in PAGE_TYPES else "other",
        "section_heading": (data.get("section_heading") or "").strip() or None,
        "species": species_out,
        "unattached_annotations": [
            str(a).strip() for a in (data.get("unattached_annotations") or []) if str(a).strip()
        ],
        "confidence": confidence if confidence in {"high", "medium", "low"} else "medium",
    }


def run_page(client: anthropic.Anthropic, image: Path, throttle: Throttle,
             model: str = MODEL) -> Result:
    stem = image.stem
    b64 = base64.standard_b64encode(image.read_bytes()).decode()
    last_error = "unknown"

    for attempt in range(1, MAX_ATTEMPTS + 1):
        throttle.wait()
        try:
            with client.messages.stream(
                model=model,
                max_tokens=MAX_TOKENS,
                system=[{
                    "type": "text",
                    "text": P.SYSTEM,
                    # Stable across all 151 calls, so cache it rather than re-billing it.
                    "cache_control": {"type": "ephemeral"},
                }],
                messages=[{
                    "role": "user",
                    "content": [
                        {"type": "image", "source": {
                            "type": "base64", "media_type": "image/jpeg", "data": b64,
                        }},
                        {"type": "text", "text": P.USER_TEXT},
                    ],
                }],
                output_config={"format": {"type": "json_schema", "schema": P.SCHEMA}},
            ) as stream:
                resp = stream.get_final_message()
        except (anthropic.RateLimitError, anthropic.APIStatusError,
                anthropic.APIConnectionError, anthropic.APITimeoutError) as exc:
            last_error = f"{type(exc).__name__}: {str(exc)[:180]}"
        else:
            if resp.stop_reason == "refusal":
                return Result(stem, False, error="model declined this image")
            if resp.stop_reason == "max_tokens":
                # Truncated JSON can never parse; retrying the same call will not help.
                return Result(stem, False, attempts=attempt,
                              error=f"output hit the {MAX_TOKENS}-token cap; raise MAX_TOKENS")
            try:
                text = next(b.text for b in resp.content if b.type == "text")
                payload = json.loads(text)
            except (StopIteration, json.JSONDecodeError) as exc:
                last_error = f"unparseable response: {type(exc).__name__}"
            else:
                u = resp.usage
                return Result(
                    stem, True, data=_clean(payload, stem),
                    tokens_in=(u.input_tokens or 0) + (getattr(u, "cache_creation_input_tokens", 0) or 0),
                    tokens_out=u.output_tokens or 0,
                    attempts=attempt,
                )

        if attempt < MAX_ATTEMPTS:
            time.sleep(BASE_BACKOFF * (2 ** (attempt - 1)) + random.uniform(0, 1.5))

    return Result(stem, False, error=last_error, attempts=MAX_ATTEMPTS)


# --------------------------------------------------------------------------- #
# aggregation
# --------------------------------------------------------------------------- #

def load_pages() -> list[dict]:
    """Load every per-page JSON, re-deriving dates and locations on the way in.

    Derivation is cheap and purely a function of the verbatim transcription, so
    rebuilding picks up any change to derive.py without re-calling the API.
    """
    pages = []
    for path in sorted(OUT_DIR.glob("*.json")):
        try:
            page = json.loads(path.read_text())
        except json.JSONDecodeError:
            print(f"  ! skipping unreadable {path.name}", file=sys.stderr)
            continue
        for sp in page.get("species", []):
            for obs in sp.get("observations", []):
                d = derive.parse_date(obs.get("date_raw"))
                place = derive.canonical_location(obs.get("location"))
                obs.update(
                    date_iso=d["date_iso"], sort_date=d["sort_date"],
                    date_precision=d["precision"], date_uncertain=d["uncertain"],
                    date_before_book=d["before_book"],
                    date_reread_from=d["reread_from"],
                    location_key=place["key"], location_display=place["display"],
                    state=place["state"],
                )
        pages.append(page)
    return pages


def build_db(pages: list[dict]) -> None:
    DB_PATH.unlink(missing_ok=True)
    con = sqlite3.connect(DB_PATH)
    con.executescript("""
        CREATE TABLE page (
            image           TEXT PRIMARY KEY,
            page_numbers    TEXT,
            page_type       TEXT,
            section_heading TEXT,
            confidence      TEXT,
            annotations     TEXT
        );
        CREATE TABLE species (
            id                   INTEGER PRIMARY KEY,
            image                TEXT REFERENCES page(image),
            common_name          TEXT NOT NULL,
            scientific_name      TEXT,
            marked               INTEGER NOT NULL DEFAULT 0,
            illustration_circled INTEGER NOT NULL DEFAULT 0,
            notes                TEXT
        );
        CREATE TABLE observation (
            id         INTEGER PRIMARY KEY,
            species_id INTEGER REFERENCES species(id),
            image      TEXT REFERENCES page(image),
            common_name TEXT,
            date_raw   TEXT,
            date_iso   TEXT,
            sort_date  TEXT,
            date_precision TEXT,
            date_uncertain INTEGER DEFAULT 0,
            date_before_book INTEGER DEFAULT 0,
            location   TEXT,
            location_key TEXT,
            location_display TEXT,
            state      TEXT
        );
        CREATE INDEX idx_species_image ON species(image);
        CREATE INDEX idx_species_name  ON species(common_name);
        CREATE INDEX idx_obs_date      ON observation(date_iso);
        CREATE INDEX idx_obs_location  ON observation(location_key);
        CREATE INDEX idx_obs_sort      ON observation(sort_date);
    """)

    for page in pages:
        con.execute("INSERT INTO page VALUES (?,?,?,?,?,?)", (
            page["image"], json.dumps(page["page_numbers"]), page["page_type"],
            page["section_heading"], page["confidence"],
            json.dumps(page["unattached_annotations"]),
        ))
        for sp in page["species"]:
            cur = con.execute(
                "INSERT INTO species (image, common_name, scientific_name, marked,"
                " illustration_circled, notes) VALUES (?,?,?,?,?,?)",
                (page["image"], sp["common_name"], sp["scientific_name"],
                 int(sp["marked"]), int(sp["illustration_circled"]), json.dumps(sp["notes"])),
            )
            for obs in sp["observations"]:
                con.execute(
                    "INSERT INTO observation (species_id, image, common_name, date_raw,"
                    " date_iso, sort_date, date_precision, date_uncertain,"
                    " date_before_book, location, location_key, location_display, state)"
                    " VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)",
                    (cur.lastrowid, page["image"], sp["common_name"],
                     obs["date_raw"], obs["date_iso"], obs["sort_date"],
                     obs["date_precision"], int(bool(obs["date_uncertain"])),
                     int(bool(obs["date_before_book"])), obs["location"],
                     obs["location_key"], obs["location_display"], obs["state"]),
                )

    con.commit()
    con.close()


def build_outputs() -> None:
    pages = load_pages()
    JOURNAL_JSON.write_text(json.dumps(pages, indent=2, ensure_ascii=False))
    build_db(pages)

    species = [sp for p in pages for sp in p["species"]]
    obs = [o for sp in species for o in sp["observations"]]
    dated = sorted(o["sort_date"] for o in obs if o["sort_date"])
    places = {o["location_key"] for o in obs if o["location_key"]}
    review = [o for o in obs if o["date_uncertain"] or o["date_before_book"]]
    marked_names = {sp["common_name"] for sp in species if sp["marked"]}

    print(f"\n  pages           {len(pages)}")
    print(f"  species rows    {len(species)}  ({len(marked_names)} distinct species marked)")
    print(f"  observations    {len(obs)}  ({len(dated)} dated, {len(obs) - len(dated)} undated)")
    print(f"  locations       {len(places)} distinct places")
    print(f"  needs review    {len(review)} observations with an uncertain or pre-1966 date")
    if dated:
        print(f"  date range      {dated[0]} to {dated[-1]}")
    print(f"\n  -> {JOURNAL_JSON.relative_to(ROOT)}")
    print(f"  -> {DB_PATH.relative_to(ROOT)}")


def main() -> int:
    ap = argparse.ArgumentParser(description=__doc__,
                                 formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("--images-dir", type=Path, default=PAGES_DIR)
    ap.add_argument("--workers", type=int, default=6, help="concurrent requests (default 6)")
    ap.add_argument("--limit", type=int, default=None, help="process at most N pages")
    ap.add_argument("--force", action="store_true", help="re-run pages already extracted")
    ap.add_argument("--build-only", action="store_true",
                    help="skip extraction, just rebuild journal.json and the database")
    ap.add_argument("--model", default=MODEL)
    args = ap.parse_args()

    OUT_DIR.mkdir(parents=True, exist_ok=True)

    if args.build_only:
        build_outputs()
        return 0

    images = sorted(args.images_dir.glob("*.jpg"))
    if not images:
        print(f"no .jpg files in {args.images_dir}", file=sys.stderr)
        return 1

    pending = [i for i in images if not (OUT_DIR / f"{i.stem}.json").exists()]
    todo = images if args.force else pending
    if args.limit is not None:
        todo = todo[:args.limit]

    print(f"{len(images)} pages, {len(images) - len(pending)} already extracted, "
          f"{len(todo)} to do ({args.workers} workers, {args.model})\n")
    if not todo:
        build_outputs()
        return 0

    if not (os.environ.get("ANTHROPIC_API_KEY") or os.environ.get("ANTHROPIC_AUTH_TOKEN")):
        print("No API key found.\n"
              "  Put it in a .env file at the project root (it is gitignored):\n"
              "      echo 'ANTHROPIC_API_KEY=sk-ant-...' > .env\n"
              "  or export ANTHROPIC_API_KEY in your shell.", file=sys.stderr)
        return 1

    client = anthropic.Anthropic(max_retries=0)  # retries handled here, with throttling

    throttle = Throttle(MIN_GAP)
    failures: list[Result] = []
    cost = 0.0
    started = time.monotonic()

    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        futures = [pool.submit(run_page, client, img, throttle, args.model) for img in todo]
        for n, fut in enumerate(as_completed(futures), 1):
            res = fut.result()
            tag = f"[{n}/{len(todo)}]"
            if res.ok and res.data is not None:
                (OUT_DIR / f"{res.stem}.json").write_text(
                    json.dumps(res.data, indent=2, ensure_ascii=False))
                cost += res.cost
                n_obs = sum(len(s["observations"]) for s in res.data["species"])
                retry = f" (attempt {res.attempts})" if res.attempts > 1 else ""
                print(f"{tag} {res.stem}  {len(res.data['species']):>2} species, "
                      f"{n_obs:>2} obs, {res.data['confidence']}{retry}")
            else:
                failures.append(res)
                print(f"{tag} {res.stem}  FAILED: {res.error}", file=sys.stderr)

    mins = (time.monotonic() - started) / 60
    print(f"\ndone in {mins:.1f} min. {len(todo) - len(failures)} ok, "
          f"{len(failures)} failed. ~${cost:.2f} of API credit.")
    if failures:
        print("\nfailed pages (just re-run the script to retry them):", file=sys.stderr)
        for f in failures:
            print(f"  {f.stem}: {f.error}", file=sys.stderr)

    build_outputs()
    return 1 if failures else 0


if __name__ == "__main__":
    sys.exit(main())
