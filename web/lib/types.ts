export type Precision = "day" | "month" | "year" | "decade" | null;

export type Observation = {
  /** Stable key for this sighting; what a human verdict in the review file hangs on. */
  id: string;
  date: string | null;
  dateRaw: string | null;
  precision: Precision;
  uncertain: boolean;
  /** The literal reading, when a 1910s two-digit year was re-read as the 1970s. */
  rereadFrom: number | null;
  location: string | null;
  locationKey: string | null;
  state: string | null;
  image: string;
  species: string;
  family: string | null;
  speciesKey: string;
};

/**
 * The plate that shows this bird, where one exists.
 *
 * Audubon first, and the artists who filled his gaps where he has nothing:
 * he died in 1851 having barely worked the West. `title` is the plate's own
 * caption, which is usually not the name the guide prints — his Vesper Sparrow is
 * a "Grass Finch, or Bay-winged Bunting" — so it is worth showing rather than
 * hiding behind the modern name.
 */
export type Plate = {
  /** Who painted it: Audubon, Cassin, Gould, Brooks or Fuertes. */
  artist: string;
  /** Basename of both files: /plates/{image}.webp and /plates/{image}-card.webp. */
  image: string;
  /** Plate number where the work numbers its plates. */
  plate: number | string | null;
  title: string | null;
  scientific: string | null;
  /** The card crop (plate-N-card.webp): the painted part, without the bare sheet. */
  width: number;
  height: number;
  /** Where the ink sits, as a percentage down the crop; the card centres here. */
  focusY: number;
  /** The whole plate (plate-N.webp), shown when a bird is opened. */
  fullWidth: number;
  fullHeight: number;
  /** How the plate was tied to this species; see extract/fetch_plates.py. */
  matchedBy: string;
  page: string;
};

export type Species = {
  key: string;
  name: string;
  scientific: string | null;
  family: string | null;
  plate?: Plate;
  marked: boolean;
  circled: boolean;
  notes: string[];
  /** Caveats written by the transcriber, never by the owner. */
  editorial: string[];
  observations: Omit<Observation, "species" | "family" | "speciesKey">[];
  pages: string[];
};

export type Spread = {
  id: string;
  index: number;
  pageNumbers: number[];
  pageType: string;
  heading: string | null;
  family: string | null;
  confidence: "high" | "medium" | "low";
  annotations: string[];
  editorial: string[];
  markedSpecies: string[];
  speciesCount: number;
};

export type LocationRec = {
  key: string;
  name: string;
  state: string | null;
  visits: number;
  species: string[];
};

export type Journal = {
  meta: {
    book: string;
    spreads: number;
    speciesRecorded: number;
    speciesOnPages: number;
    observations: number;
    datedObservations: number;
    locations: number;
    families: number;
    firstDate: string | null;
    lastDate: string | null;
    needsReview: number;
  };
  spreads: Spread[];
  species: Species[];
  observations: Observation[];
  locations: LocationRec[];
  families: { name: string; species: string[]; count: number }[];
  byYear: { year: string; count: number }[];
};

const MONTHS = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

/**
 * Render a date at the precision it was actually written.
 *
 * The owner wrote "4/77" and "EARLY 1950s" as often as full dates; showing those
 * as "April 1, 1977" would invent a precision he never claimed.
 */
export function formatDate(date: string | null, precision: Precision): string {
  if (!date) return "undated";
  const [y, m, d] = date.split("-").map(Number);
  switch (precision) {
    case "day":
      return `${MONTHS[m - 1]} ${d}, ${y}`;
    case "month":
      return `${MONTHS[m - 1]} ${y}`;
    case "year":
      return String(y);
    case "decade":
      return `${y}s`;
    default:
      return String(y);
  }
}

/** A species as the interface deals with it: the record plus its derived spans. */
export type LifeSpecies = {
  key: string;
  name: string;
  scientific: string | null;
  plate?: Plate;
  /** The book's own grouping, falling back to the heading of the page it sits on. */
  group: string;
  marked: boolean;
  circled: boolean;
  notes: string[];
  editorial: string[];
  observations: Species["observations"];
  pages: string[];
  /** The photographed spreads this bird was read from, with the book's own paging. */
  spreads: { image: string; label: string }[];
  firstDate: string | null;
  lastDate: string | null;
  places: string[];
  /** Carries at least one observation the transcription is unsure about. */
  flagged: boolean;
};

/** The lighter row the checklist renders — all 1,357 printed species. */
export type ChecklistEntry = {
  key: string;
  name: string;
  scientific: string | null;
  group: string;
  marked: boolean;
  circled: boolean;
  sightings: number;
  firstSeen: string | null;
};

export type ChecklistGroup = {
  name: string;
  entries: ChecklistEntry[];
  marked: number;
};

/** A flagged sighting, with everything a human eye needs to settle it. */
export type FlagReason =
  | "reread"
  | "illegible"
  | "before-book"
  | "no-date"
  | "no-place"
  | "low-confidence";

export type FlaggedEntry = {
  id: string;
  species: string;
  speciesKey: string;
  scientific: string | null;
  group: string;
  /** The photographed spread this was read from. */
  image: string;
  pageLabel: string;
  confidence: Spread["confidence"];
  date: string | null;
  dateRaw: string | null;
  precision: Precision;
  rereadFrom: number | null;
  location: string | null;
  reasons: FlagReason[];
  /** What the transcriber said they could not make out. */
  editorial: string[];
};

/** One human verdict, as stored in data/review.json. */
export type Verdict = "confirmed" | "corrected" | "unsure";

export type ReviewEntry = {
  verdict: Verdict;
  date?: string;
  location?: string;
  note?: string;
  at?: string;
};

export type ReviewFile = {
  version: number;
  updated: string | null;
  entries: Record<string, ReviewEntry>;
};
