"use client";

import { useState } from "react";
import { Icon } from "@/components/Icon";
import { Badge, EmptyState, StatTile } from "@/components/ui";

export type PlaceView = {
  key: string;
  name: string;
  state: string | null;
  visits: number;
  species: string[];
  firstDate: string | null;
  lastDate: string | null;
  /** Species recorded there that also carry a tick in the index. */
  recorded: number;
};

export default function Places({ places }: { places: PlaceView[] }) {
  const [query, setQuery] = useState("");
  const [selected, setSelected] = useState(places[0]?.key ?? null);

  const q = query.trim().toLowerCase();
  const visible = q
    ? places.filter((p) => p.name.toLowerCase().includes(q))
    : places;
  const current = places.find((p) => p.key === selected) ?? null;

  return (
    <div className="flex min-h-0 flex-1">
      <div className="sticky top-0 hidden h-screen w-[300px] shrink-0 flex-col border-r border-line bg-surface xl:flex">
        <div className="border-b border-line p-3">
          <label className="relative block">
            <span className="sr-only">Search places</span>
            <Icon
              name="search"
              className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-fg-subtle"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search places…"
              className="input pl-8"
            />
          </label>
        </div>
        <div className="flex-1 overflow-y-auto p-2 scroll-thin">
          {visible.map((p) => (
            <button
              key={p.key}
              onClick={() => setSelected(p.key)}
              aria-pressed={p.key === selected}
              className={`flex w-full items-center gap-2 rounded-lg px-2.5 py-2 text-left transition-colors ${
                p.key === selected
                  ? "bg-accent-soft text-accent"
                  : "text-fg-muted hover:bg-surface-muted hover:text-fg"
              }`}
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[0.8125rem] font-medium">
                  {p.name}
                </span>
                <span className="tnum block text-[0.6875rem] text-fg-subtle">
                  {p.species.length} species
                  {p.firstDate && <> · from {p.firstDate.slice(0, 4)}</>}
                </span>
              </span>
              <span className="tnum text-[0.75rem] text-fg-subtle">{p.visits}</span>
            </button>
          ))}
          {visible.length === 0 && (
            <p className="px-2.5 py-6 text-center text-[0.8125rem] text-fg-subtle">
              No place by that name.
            </p>
          )}
        </div>
      </div>

      <div className="min-w-0 flex-1 px-5 py-6 sm:px-8">
        {/* Below the rail's breakpoint the same list becomes a menu above the detail. */}
        <div className="mb-5 xl:hidden">
          <label className="sr-only" htmlFor="place-picker">
            Place
          </label>
          <select
            id="place-picker"
            value={selected ?? ""}
            onChange={(e) => setSelected(e.target.value)}
            className="input"
          >
            {places.map((p) => (
              <option key={p.key} value={p.key}>
                {p.name} — {p.species.length} species
              </option>
            ))}
          </select>
        </div>

        {!current ? (
          <EmptyState
            title="No place selected"
            note="Pick somewhere from the list to see what he recorded there."
          />
        ) : (
          <article>
            <header className="flex flex-wrap items-center gap-x-3 gap-y-2">
              <h2 className="text-[1.375rem] font-semibold tracking-[-0.02em] text-fg">
                {current.name}
              </h2>
              {current.state && <Badge tone="neutral">{current.state}</Badge>}
              {current.recorded > 0 && (
                <Badge tone="tick">
                  <Icon name="tick" className="h-3 w-3" /> {current.recorded} on the
                  life list
                </Badge>
              )}
            </header>

            <div className="mt-4 grid grid-cols-2 gap-4 lg:grid-cols-4">
              <StatTile value={current.visits} label="entries written" />
              <StatTile value={current.species.length} label="species seen here" />
              <StatTile
                value={current.firstDate?.slice(0, 4) ?? "—"}
                label="first recorded"
              />
              <StatTile
                value={current.lastDate?.slice(0, 4) ?? "—"}
                label="last recorded"
              />
            </div>

            <section className="card mt-5 overflow-hidden">
              <h3 className="eyebrow border-b border-line bg-surface-muted/50 px-4 py-3 text-fg-subtle">
                Recorded here
              </h3>
              <ul className="m-0 -mb-px grid list-none grid-cols-1 p-0 sm:grid-cols-2 lg:grid-cols-3 [&>li]:border-b [&>li]:border-line sm:[&>li]:border-r sm:[&>li:nth-child(2n)]:border-r-0 lg:[&>li]:border-r lg:[&>li:nth-child(2n)]:border-r lg:[&>li:nth-child(3n)]:border-r-0">
                {current.species.map((s) => (
                  <li
                    key={s}
                    className="px-4 py-2.5 text-[0.8125rem] text-fg"
                  >
                    {s}
                  </li>
                ))}
              </ul>
            </section>
          </article>
        )}
      </div>
    </div>
  );
}
