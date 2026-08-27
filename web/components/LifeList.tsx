"use client";

import { useMemo, useState } from "react";
import { Icon } from "@/components/Icon";
import { Badge, BirdImage, EmptyState } from "@/components/ui";
import type { LifeSpecies, LocationRec } from "@/lib/types";
import { formatDate } from "@/lib/types";

type Props = {
  species: LifeSpecies[];
  groups: { name: string; count: number }[];
  locations: LocationRec[];
  decades: string[];
};

type Sort = "name" | "sightings" | "recent" | "earliest";
type Trait = "all" | "circled" | "notes" | "flagged";

const SORTS: { value: Sort; label: string }[] = [
  { value: "name", label: "A–Z" },
  { value: "sightings", label: "Most sightings" },
  { value: "recent", label: "Most recent" },
  { value: "earliest", label: "Earliest" },
];

const TRAITS: { value: Trait; label: string }[] = [
  { value: "all", label: "All" },
  { value: "circled", label: "Circled" },
  { value: "notes", label: "With notes" },
  { value: "flagged", label: "Flagged" },
];

export default function LifeList({ species, groups, locations, decades }: Props) {
  const [query, setQuery] = useState("");
  const [group, setGroup] = useState("");
  const [place, setPlace] = useState("");
  const [decade, setDecade] = useState("");
  const [trait, setTrait] = useState<Trait>("all");
  const [sort, setSort] = useState<Sort>("name");
  const [view, setView] = useState<"grid" | "table">("grid");
  const [selected, setSelected] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const rows = species.filter((s) => {
      if (group && s.group !== group) return false;
      if (place && !s.observations.some((o) => o.locationKey === place)) return false;
      if (decade && !s.observations.some((o) => o.date?.startsWith(decade.slice(0, 3))))
        return false;
      if (trait === "circled" && !s.circled) return false;
      if (trait === "notes" && s.notes.length === 0) return false;
      if (trait === "flagged" && !s.flagged) return false;
      if (q) {
        const hay = [s.name, s.scientific ?? "", s.group, ...s.places, ...s.notes]
          .join(" ")
          .toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    const by: Record<Sort, (a: LifeSpecies, b: LifeSpecies) => number> = {
      name: (a, b) => a.name.localeCompare(b.name),
      sightings: (a, b) =>
        b.observations.length - a.observations.length || a.name.localeCompare(b.name),
      recent: (a, b) => (b.lastDate ?? "").localeCompare(a.lastDate ?? ""),
      earliest: (a, b) =>
        (a.firstDate ?? "9999").localeCompare(b.firstDate ?? "9999"),
    };
    return [...rows].sort(by[sort]);
  }, [species, query, group, place, decade, trait, sort]);

  // The panel is derived, not synchronised: a selection the filters have removed
  // simply stops resolving, and comes back if the filter is cleared again.
  const current = filtered.find((s) => s.key === selected) ?? null;
  const dirty = Boolean(query || group || place || decade || trait !== "all");

  return (
    <div className="flex min-h-0 flex-1">
      <div className="min-w-0 flex-1">
        <div className="sticky top-[45px] lg:top-0 z-20 border-b border-line bg-surface/95 px-5 py-3 backdrop-blur sm:px-8">
          <div className="flex flex-wrap items-center gap-2.5">
            <label className="relative min-w-[13rem] flex-1 sm:max-w-[20rem]">
              <span className="sr-only">Search species</span>
              <Icon
                name="search"
                className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-fg-subtle"
              />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search species, place or note…"
                className="input pl-8"
              />
            </label>

            <select
              value={group}
              onChange={(e) => setGroup(e.target.value)}
              className="input w-[11rem]"
              aria-label="Group"
            >
              <option value="">All groups</option>
              {groups.map((g) => (
                <option key={g.name} value={g.name}>
                  {g.name} ({g.count})
                </option>
              ))}
            </select>

            <select
              value={place}
              onChange={(e) => setPlace(e.target.value)}
              className="input w-[11rem]"
              aria-label="Place"
            >
              <option value="">All places</option>
              {locations.map((l) => (
                <option key={l.key} value={l.key}>
                  {l.name} ({l.visits})
                </option>
              ))}
            </select>

            <select
              value={decade}
              onChange={(e) => setDecade(e.target.value)}
              className="input w-[8rem]"
              aria-label="Decade"
            >
              <option value="">Any decade</option>
              {decades.map((d) => (
                <option key={d} value={d}>
                  {d}s
                </option>
              ))}
            </select>

            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as Sort)}
              className="input w-[9.5rem]"
              aria-label="Sort"
            >
              {SORTS.map((s) => (
                <option key={s.value} value={s.value}>
                  {s.label}
                </option>
              ))}
            </select>

            <div className="ml-auto flex items-center gap-2.5">
              <p className="tnum text-[0.75rem] text-fg-subtle">
                {filtered.length} of {species.length}
              </p>
              {dirty && (
                <button
                  onClick={() => {
                    setQuery("");
                    setGroup("");
                    setPlace("");
                    setDecade("");
                    setTrait("all");
                  }}
                  className="text-[0.75rem] font-medium text-accent hover:text-accent-hover"
                >
                  Reset
                </button>
              )}
              <div className="flex rounded-lg border border-line p-0.5">
                {(["grid", "table"] as const).map((v) => (
                  <button
                    key={v}
                    onClick={() => setView(v)}
                    aria-pressed={view === v}
                    aria-label={`${v} view`}
                    className={`rounded-[6px] p-1.5 transition-colors ${
                      view === v
                        ? "bg-surface-muted text-fg"
                        : "text-fg-subtle hover:text-fg-muted"
                    }`}
                  >
                    <Icon name={v} className="h-3.5 w-3.5" />
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-2.5 flex gap-1">
            {TRAITS.map((t) => (
              <button
                key={t.value}
                onClick={() => setTrait(t.value)}
                aria-pressed={trait === t.value}
                className={`rounded-full px-2.5 py-1 text-[0.75rem] font-medium transition-colors ${
                  trait === t.value
                    ? "bg-accent-soft text-accent"
                    : "text-fg-subtle hover:bg-surface-muted hover:text-fg-muted"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        <div className="px-5 py-5 sm:px-8">
          {filtered.length === 0 ? (
            <EmptyState
              title="No species match those filters"
              note="Try widening the place or decade — most entries in the book carry only one of the two."
            />
          ) : view === "grid" ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
              {filtered.map((s) => (
                <SpeciesCard
                  key={s.key}
                  species={s}
                  active={s.key === selected}
                  onSelect={() => setSelected(s.key)}
                />
              ))}
            </div>
          ) : (
            <SpeciesTable
              rows={filtered}
              selected={selected}
              onSelect={(k) => setSelected(k)}
            />
          )}
        </div>
      </div>

      {/* Detail rail on a wide screen; the same panel as a slide-over below it. */}
      <aside className="sticky top-0 hidden h-screen w-[368px] shrink-0 overflow-y-auto border-l border-line bg-surface scroll-thin xl:block">
        {current ? (
          <SpeciesDetail species={current} onClose={() => setSelected(null)} />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-2 px-8 text-center">
            <Icon name="bird" className="h-6 w-6 text-fg-subtle" />
            <p className="text-[0.875rem] font-medium text-fg">Nothing selected</p>
            <p className="text-[0.8125rem] leading-relaxed text-fg-muted">
              Pick a bird to read its sightings, the dates and places he wrote beside
              it, and any note in his own hand.
            </p>
          </div>
        )}
      </aside>

      {current && (
        <div className="fixed inset-0 z-40 xl:hidden">
          <div
            className="absolute inset-0 bg-fg/30"
            onClick={() => setSelected(null)}
            aria-hidden
          />
          <aside className="panel-in absolute inset-y-0 right-0 w-[min(24rem,92vw)] overflow-y-auto border-l border-line bg-surface scroll-thin">
            <SpeciesDetail species={current} onClose={() => setSelected(null)} />
          </aside>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------- card */

function SpeciesCard({
  species,
  active,
  onSelect,
}: {
  species: LifeSpecies;
  active: boolean;
  onSelect: () => void;
}) {
  const last = species.lastDate;
  return (
    <button
      onClick={onSelect}
      aria-pressed={active}
      className={`card group overflow-hidden p-0 text-left transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_24px_-12px_rgba(0,0,0,0.25)] ${
        active ? "border-accent ring-1 ring-accent" : ""
      }`}
    >
      <div className="relative aspect-[16/10] overflow-hidden bg-surface-sunk">
        <BirdImage sizes="(max-width: 640px) 100vw, 320px" />
        <div className="absolute right-2 top-2 flex gap-1">
          {species.marked && (
            <Badge tone="tick" title="Ticked in the book's index">
              <Icon name="tick" className="h-3 w-3" /> Recorded
            </Badge>
          )}
          {species.circled && (
            <Badge tone="accent" title="He circled this figure on the plate">
              ◯
            </Badge>
          )}
        </div>
      </div>

      <div className="p-3.5">
        <div className="flex items-start justify-between gap-2">
          <h3 className="text-[0.9375rem] font-semibold leading-tight tracking-[-0.01em] text-fg">
            {species.name}
          </h3>
          {species.flagged && (
            <span
              title="An entry here is uncertain"
              className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-flag"
            />
          )}
        </div>
        {species.scientific && (
          <p className="mt-0.5 font-serif text-[0.8125rem] italic text-fg-muted">
            {species.scientific}
          </p>
        )}
        <p className="mt-2 text-[0.75rem] text-fg-subtle">{species.group}</p>

        <div className="mt-3 flex items-center gap-2 border-t border-line pt-2.5 text-[0.75rem] text-fg-muted">
          <span className="tnum">
            {species.observations.length || "—"}{" "}
            {species.observations.length === 1 ? "sighting" : "sightings"}
          </span>
          {last && (
            <>
              <span className="text-fg-subtle">·</span>
              <span className="tnum">{last.slice(0, 4)}</span>
            </>
          )}
          {species.notes.length > 0 && (
            <>
              <span className="text-fg-subtle">·</span>
              <span>{species.notes.length} note{species.notes.length > 1 ? "s" : ""}</span>
            </>
          )}
        </div>
      </div>
    </button>
  );
}

/* ------------------------------------------------------------------ table */

function SpeciesTable({
  rows,
  selected,
  onSelect,
}: {
  rows: LifeSpecies[];
  selected: string | null;
  onSelect: (key: string) => void;
}) {
  return (
    <div className="card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-left text-[0.8125rem]">
          <thead>
            <tr className="border-b border-line bg-surface-muted/50">
              {["Species", "Group", "Sightings", "First", "Last", "Places"].map((h) => (
                <th
                  key={h}
                  className="eyebrow px-4 py-2.5 font-semibold text-fg-subtle"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr
                key={s.key}
                onClick={() => onSelect(s.key)}
                className={`cursor-pointer border-b border-line last:border-0 transition-colors ${
                  s.key === selected ? "bg-accent-soft" : "hover:bg-surface-muted/60"
                }`}
              >
                <td className="px-4 py-2.5">
                  <span className="flex items-center gap-2.5">
                    <span className="h-8 w-11 shrink-0 overflow-hidden rounded-md bg-surface-sunk">
                      <BirdImage sizes="44px" />
                    </span>
                    <span>
                      <span className="block font-medium text-fg">{s.name}</span>
                      {s.scientific && (
                        <span className="block font-serif text-[0.75rem] italic text-fg-subtle">
                          {s.scientific}
                        </span>
                      )}
                    </span>
                  </span>
                </td>
                <td className="px-4 py-2.5 text-fg-muted">{s.group}</td>
                <td className="tnum px-4 py-2.5 text-fg-muted">
                  {s.observations.length || "—"}
                </td>
                <td className="tnum px-4 py-2.5 text-fg-muted">
                  {s.firstDate?.slice(0, 4) ?? "—"}
                </td>
                <td className="tnum px-4 py-2.5 text-fg-muted">
                  {s.lastDate?.slice(0, 4) ?? "—"}
                </td>
                <td className="px-4 py-2.5 text-fg-muted">
                  {s.places[0] ?? "—"}
                  {s.places.length > 1 && (
                    <span className="text-fg-subtle"> +{s.places.length - 1}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- detail */

function SpeciesDetail({
  species,
  onClose,
}: {
  species: LifeSpecies;
  onClose: () => void;
}) {
  const sightings = [...species.observations].sort((a, b) =>
    (a.date ?? "9999").localeCompare(b.date ?? "9999"),
  );

  return (
    <div className="panel-in">
      <div className="relative aspect-[16/10] bg-surface-sunk">
        <BirdImage sizes="368px" />
        <button
          onClick={onClose}
          aria-label="Close panel"
          className="absolute right-2.5 top-2.5 flex h-7 w-7 items-center justify-center rounded-lg border border-line bg-surface/90 text-fg-muted backdrop-blur transition-colors hover:text-fg"
        >
          <Icon name="close" className="h-3.5 w-3.5" />
        </button>
      </div>
      <p className="border-b border-line px-5 py-1.5 text-[0.6875rem] text-fg-subtle">
        Placeholder illustration — the book&apos;s plates are not digitised.
      </p>

      <div className="px-5 py-5">
        <h2 className="text-[1.25rem] font-semibold leading-tight tracking-[-0.02em] text-fg">
          {species.name}
        </h2>
        {species.scientific && (
          <p className="mt-1 font-serif text-[0.9375rem] italic text-fg-muted">
            {species.scientific}
          </p>
        )}

        <div className="mt-3 flex flex-wrap gap-1.5">
          <Badge tone="neutral">{species.group}</Badge>
          {species.marked && (
            <Badge tone="tick">
              <Icon name="tick" className="h-3 w-3" /> On the life list
            </Badge>
          )}
          {species.circled && <Badge tone="accent">◯ Circled on the plate</Badge>}
          {species.flagged && <Badge tone="flag">Needs review</Badge>}
        </div>

        <Section title={`Sightings (${sightings.length})`}>
          {sightings.length === 0 ? (
            <p className="text-[0.8125rem] leading-relaxed text-fg-muted">
              Ticked in the index, but no date or place was written beside it.
            </p>
          ) : (
            <ol className="m-0 list-none space-y-2.5 p-0">
              {sightings.map((o, i) => (
                <li key={i} className="flex gap-2.5">
                  <span className="mt-[7px] h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                  <span className="min-w-0">
                    <span className="block text-[0.8125rem] font-medium text-fg">
                      {o.location ?? "Place not written"}
                      {o.uncertain && (
                        <span className="ml-1.5 align-super text-[0.625rem] text-flag">
                          ?
                        </span>
                      )}
                    </span>
                    <span className="tnum block text-[0.75rem] text-fg-subtle">
                      {formatDate(o.date, o.precision)}
                      {/* A short raw form is what he wrote; a long one is the
                          transcriber describing an unreadable smudge, and belongs
                          in the transcriber's voice on its own line. */}
                      {rawDate(o) && rawDate(o)!.length <= 24 && (
                        <span className="text-fg-subtle/70"> · written “{rawDate(o)}”</span>
                      )}
                    </span>
                    {rawDate(o) && rawDate(o)!.length > 24 && (
                      <span className="mt-0.5 block text-[0.6875rem] leading-relaxed text-fg-subtle">
                        {rawDate(o)}
                      </span>
                    )}
                    {o.rereadFrom && (
                      <span className="mt-1 block text-[0.6875rem] leading-relaxed text-flag">
                        Reads {o.rereadFrom} on the page. A 7 written short reads as a
                        1, and the book was not printed until 1966, so it is taken as{" "}
                        {o.date?.slice(0, 4)}.
                      </span>
                    )}
                  </span>
                </li>
              ))}
            </ol>
          )}
        </Section>

        {species.notes.length > 0 && (
          <Section title="In his hand">
            <ul className="m-0 list-none space-y-2.5 p-0">
              {species.notes.map((n, i) => (
                <li
                  key={i}
                  className="border-l-2 border-accent-line pl-3 font-serif text-[0.9375rem] italic leading-relaxed text-fg"
                >
                  {n}
                </li>
              ))}
            </ul>
          </Section>
        )}

        {species.editorial.length > 0 && (
          <Section title="Transcriber's note">
            <ul className="m-0 list-none space-y-1.5 p-0">
              {species.editorial.map((n, i) => (
                <li key={i} className="text-[0.75rem] leading-relaxed text-fg-subtle">
                  {n}
                </li>
              ))}
            </ul>
          </Section>
        )}

        <Section title="Where it appears">
          <p className="text-[0.75rem] leading-relaxed text-fg-subtle">
            {species.pages.length} photographed{" "}
            {species.pages.length === 1 ? "spread" : "spreads"}
            {species.places.length > 0 && (
              <> · {species.places.length} distinct {species.places.length === 1 ? "place" : "places"}</>
            )}
          </p>
        </Section>
      </div>
    </div>
  );
}

/** The date as written, when it says something the rendered date does not. */
function rawDate(o: LifeSpecies["observations"][number]): string | null {
  if (!o.dateRaw || o.dateRaw === formatDate(o.date, o.precision)) return null;
  return o.dateRaw;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6 border-t border-line pt-4">
      <h3 className="eyebrow mb-2.5 text-fg-subtle">{title}</h3>
      {children}
    </section>
  );
}
