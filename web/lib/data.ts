import fs from "node:fs";
import path from "node:path";
import type {
  ChecklistEntry,
  ChecklistGroup,
  FlagReason,
  FlaggedEntry,
  Journal,
  LifeSpecies,
  ReviewFile,
  Species,
  Spread,
} from "./types";

export * from "./types";

let cached: Journal | null = null;

/** Read the static bundle from disk at build time. */
export function getJournal(): Journal {
  if (!cached) {
    const file = path.join(process.cwd(), "public", "data", "journal.json");
    cached = JSON.parse(fs.readFileSync(file, "utf8")) as Journal;
  }
  return cached;
}

/*
  Two buckets that are bookkeeping rather than headings. 138 of the ticks come only
  from the back-index checkbox grids, where the book prints no grouping at all, and
  another 51 sit on species pages whose heading was not legible in the photograph.
  Naming them apart keeps a reader from mistaking either for a family.
*/
const FROM_INDEX = "Ticked in the index";
const UNGROUPED = "No heading on the page";

/** Buckets that should never be ranked against real groups. */
export const BOOKKEEPING_GROUPS = [FROM_INDEX, UNGROUPED];

/**
 * Which heading a species belongs under.
 *
 * Only 560 of the printed species carry a family of their own, but every species
 * sits on a photographed spread, and the spread's heading is the grouping a reader
 * of this particular book would recognise. Fall back to it before giving up.
 */
function groupIndex(j: Journal): Map<string, string> {
  const pageGroup = new Map<string, string>();
  const pageType = new Map<string, string>();
  for (const s of j.spreads) {
    pageType.set(s.id, s.pageType);
    // Only the pages that actually print a family heading can name a group. An
    // index page's heading is the word "Index", and a front-matter page's is a
    // chapter title; neither is a grouping of birds.
    if (s.pageType !== "species_account" && s.pageType !== "plate") continue;
    const g = s.family ?? s.heading;
    if (g) pageGroup.set(s.id, titleCase(g));
  }

  const out = new Map<string, string>();
  for (const s of j.species) {
    const own = s.family ? titleCase(s.family) : null;
    const fromPage = s.pages.map((p) => pageGroup.get(p)).find(Boolean);
    const indexOnly =
      s.pages.length > 0 && s.pages.every((p) => pageType.get(p) === "index");
    out.set(s.key, own ?? fromPage ?? (indexOnly ? FROM_INDEX : UNGROUPED));
  }
  return out;
}

function titleCase(s: string): string {
  return s
    .toLowerCase()
    .replace(/(^|[\s(/-])([a-z])/g, (_, lead, c) => lead + c.toUpperCase());
}

/** Earliest and latest dated observation, ignoring the undated ones. */
function span(s: Species): { firstDate: string | null; lastDate: string | null } {
  const dates = s.observations.map((o) => o.date).filter((d): d is string => !!d).sort();
  return { firstDate: dates[0] ?? null, lastDate: dates[dates.length - 1] ?? null };
}

/**
 * The species the owner actually recorded — the 449 that carry a tick, a circle or
 * a sighting. The remaining printed species are only ever shown on the checklist,
 * so keeping them out roughly halves what crosses to the client.
 */
export function getLifeList(): LifeSpecies[] {
  const j = getJournal();
  const groups = groupIndex(j);

  return j.species
    .filter((s) => s.marked || s.observations.length > 0)
    .map((s) => ({
      key: s.key,
      name: s.name,
      scientific: s.scientific,
      group: groups.get(s.key) ?? UNGROUPED,
      marked: s.marked,
      circled: s.circled,
      notes: s.notes,
      editorial: s.editorial,
      observations: s.observations,
      pages: s.pages,
      places: [...new Set(s.observations.map((o) => o.location).filter((l): l is string => !!l))],
      flagged: s.observations.some((o) => o.uncertain),
      ...span(s),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/** Every printed species in the book, grouped the way the book groups them. */
export function getChecklist(): ChecklistGroup[] {
  const j = getJournal();
  const groups = groupIndex(j);
  const byGroup = new Map<string, ChecklistEntry[]>();

  for (const s of j.species) {
    const group = groups.get(s.key) ?? UNGROUPED;
    const entry: ChecklistEntry = {
      key: s.key,
      name: s.name,
      scientific: s.scientific,
      group,
      marked: s.marked,
      circled: s.circled,
      sightings: s.observations.length,
      firstSeen: span(s).firstDate,
    };
    const bucket = byGroup.get(group);
    if (bucket) bucket.push(entry);
    else byGroup.set(group, [entry]);
  }

  return [...byGroup.entries()]
    .map(([name, entries]) => ({
      name,
      entries: entries.sort((a, b) => a.name.localeCompare(b.name)),
      marked: entries.filter((e) => e.marked).length,
    }))
    .sort((a, b) => {
      // The bookkeeping buckets go last. The rest run A-Z, because 100-odd
      // headings are navigated by name, not by score.
      const ab = BOOKKEEPING_GROUPS.indexOf(a.name);
      const bb = BOOKKEEPING_GROUPS.indexOf(b.name);
      if (ab !== bb) return (ab < 0 ? -1 : ab) - (bb < 0 ? -1 : bb);
      return a.name.localeCompare(b.name);
    });
}

/** Distinct group headings, for the filter menus. */
export function getGroups(): { name: string; count: number }[] {
  return getChecklist()
    .filter((g) => g.marked > 0)
    .map((g) => ({ name: g.name, count: g.marked }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Every sighting the transcription is not sure about, with the reasons spelled out.
 *
 * This is the queue a human works through: 43 entries where the handwriting was
 * ambiguous, the year was re-read, or the photograph was too poor to trust.
 */
export function getFlagged(): FlaggedEntry[] {
  const j = getJournal();
  const groups = groupIndex(j);
  const spreads = new Map(j.spreads.map((s) => [s.id, s]));
  const editorial = new Map(j.species.map((s) => [s.key, s.editorial]));
  const scientific = new Map(j.species.map((s) => [s.key, s.scientific]));

  return j.observations
    .filter((o) => o.uncertain)
    .map((o) => {
      const spread = spreads.get(o.image);
      const raw = (o.dateRaw ?? "").toLowerCase();
      const reasons: FlagReason[] = [];

      if (o.rereadFrom) reasons.push("reread");
      if (/illegible|uncertain|unclear|could be|possibly|looks like/.test(raw))
        reasons.push("illegible");
      if (o.date && !o.rereadFrom && Number(o.date.slice(0, 4)) < 1966)
        reasons.push("before-book");
      if (!o.date) reasons.push("no-date");
      if (!o.location) reasons.push("no-place");
      if (spread?.confidence === "low") reasons.push("low-confidence");

      return {
        id: o.id,
        species: o.species,
        speciesKey: o.speciesKey,
        scientific: scientific.get(o.speciesKey) ?? null,
        group: groups.get(o.speciesKey) ?? UNGROUPED,
        image: o.image,
        pageLabel: pageLabel(spread),
        confidence: spread?.confidence ?? "medium",
        date: o.date,
        dateRaw: o.dateRaw,
        precision: o.precision,
        rereadFrom: o.rereadFrom,
        location: o.location,
        reasons,
        editorial: editorial.get(o.speciesKey) ?? [],
      };
    })
    .sort((a, b) => a.species.localeCompare(b.species));
}

function pageLabel(spread: Spread | undefined): string {
  if (!spread) return "unknown page";
  const n = spread.pageNumbers;
  if (n.length === 0) return spread.pageType.replace(/_/g, " ");
  if (n.length === 1) return `page ${n[0]}`;
  return `pages ${n[0]}–${n[n.length - 1]}`;
}

/** Where the human verdicts live: beside the transcription, not inside it. */
export const REVIEW_FILE = path.join(process.cwd(), "..", "data", "review.json");

export const EMPTY_REVIEW: ReviewFile = { version: 1, updated: null, entries: {} };

export function readReview(): ReviewFile {
  try {
    const parsed = JSON.parse(fs.readFileSync(REVIEW_FILE, "utf8")) as ReviewFile;
    return { ...EMPTY_REVIEW, ...parsed, entries: parsed.entries ?? {} };
  } catch {
    // No file yet, or an unreadable one: an empty queue is the right answer either way.
    return EMPTY_REVIEW;
  }
}
