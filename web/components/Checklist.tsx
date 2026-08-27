"use client";

import { useMemo, useState } from "react";
import { Icon } from "@/components/Icon";
import { EmptyState } from "@/components/ui";
import type { ChecklistGroup } from "@/lib/types";

type Filter = "all" | "recorded" | "remaining";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "recorded", label: "Recorded" },
  { value: "remaining", label: "Not recorded" },
];

export default function Checklist({ groups }: { groups: ChecklistGroup[] }) {
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return groups
      .map((g) => ({
        ...g,
        entries: g.entries.filter((e) => {
          if (filter === "recorded" && !e.marked) return false;
          if (filter === "remaining" && e.marked) return false;
          if (q && !`${e.name} ${e.scientific ?? ""}`.toLowerCase().includes(q))
            return false;
          return true;
        }),
      }))
      .filter((g) => g.entries.length > 0);
  }, [groups, query, filter]);

  const shown = visible.reduce((n, g) => n + g.entries.length, 0);

  return (
    <div className="flex min-h-0 flex-1">
      {/* Group index: a second rail, so 103 headings stay one click apart. */}
      <nav
        aria-label="Groups"
        className="sticky top-12 hidden h-[calc(100vh-3rem)] w-[232px] shrink-0 overflow-y-auto border-r border-line bg-surface px-3 py-4 scroll-thin xl:block"
      >
        <p className="eyebrow px-2 pb-2 text-fg-subtle">Groups</p>
        {visible.map((g) => (
          <a
            key={g.name}
            href={`#${slug(g.name)}`}
            className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-[0.75rem] text-fg-muted no-underline transition-colors hover:bg-surface-muted hover:text-fg"
          >
            <span className="truncate">{g.name}</span>
            <span className="tnum ml-auto shrink-0 text-[0.6875rem] text-fg-subtle">
              {g.marked}/{g.entries.length}
            </span>
          </a>
        ))}
      </nav>

      <div className="min-w-0 flex-1">
        <div className="sticky top-12 z-20 flex flex-wrap items-center gap-2.5 border-b border-line bg-surface/95 px-5 py-3 backdrop-blur sm:px-8">
          <label className="relative min-w-[13rem] flex-1 sm:max-w-[22rem]">
            <span className="sr-only">Search the checklist</span>
            <Icon
              name="search"
              className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-fg-subtle"
            />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Find a bird…"
              className="input pl-8"
            />
          </label>

          <div className="flex gap-1">
            {FILTERS.map((f) => (
              <button
                key={f.value}
                onClick={() => setFilter(f.value)}
                aria-pressed={filter === f.value}
                className={`rounded-full px-2.5 py-1 text-[0.75rem] font-medium transition-colors ${
                  filter === f.value
                    ? "bg-accent-soft text-accent"
                    : "text-fg-subtle hover:bg-surface-muted hover:text-fg-muted"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <p className="tnum ml-auto text-[0.75rem] text-fg-subtle">
            {shown.toLocaleString()} shown
          </p>
        </div>

        <div className="space-y-6 px-5 py-5 sm:px-8">
          {visible.length === 0 ? (
            <EmptyState
              title="Nothing on the checklist matches"
              note="The book prints 869 species; the spelling here is the book's, which is occasionally older than the modern name."
            />
          ) : (
            visible.map((g) => <Group key={g.name} group={g} />)
          )}
        </div>
      </div>
    </div>
  );
}

function Group({ group }: { group: ChecklistGroup }) {
  const total = group.entries.length;
  const pct = Math.round((group.marked / total) * 100);

  return (
    <section id={slug(group.name)} className="card scroll-mt-16 overflow-hidden">
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line bg-surface-muted/50 px-4 py-3">
        <h2 className="text-[0.9375rem] font-semibold tracking-[-0.01em] text-fg">
          {group.name}
        </h2>
        <span className="tnum text-[0.75rem] text-fg-subtle">
          {group.marked} of {total} recorded
        </span>
        <div className="ml-auto flex items-center gap-2">
          <div className="h-1.5 w-24 overflow-hidden rounded-full bg-surface-sunk">
            <div className="h-full rounded-full bg-tick" style={{ width: `${pct}%` }} />
          </div>
          <span className="tnum w-8 text-right text-[0.6875rem] text-fg-subtle">
            {pct}%
          </span>
        </div>
      </header>

      <ul className="m-0 -mb-px grid list-none grid-cols-1 p-0 sm:grid-cols-2 xl:grid-cols-3 [&>li]:border-b [&>li]:border-line sm:[&>li]:border-r sm:[&>li:nth-child(2n)]:border-r-0 xl:[&>li]:border-r xl:[&>li:nth-child(2n)]:border-r xl:[&>li:nth-child(3n)]:border-r-0">
        {group.entries.map((e) => (
          <li
            key={e.key}
            className="flex items-center gap-2.5 px-4 py-2.5"
          >
            <span
              aria-hidden
              className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-[5px] border ${
                e.marked
                  ? "border-tick bg-tick text-white"
                  : "border-line-strong bg-surface"
              }`}
            >
              {e.marked && <Icon name="tick" className="h-2.5 w-2.5" />}
            </span>
            <span className="min-w-0 flex-1">
              <span
                className={`block truncate text-[0.8125rem] ${
                  e.marked ? "font-medium text-fg" : "text-fg-subtle"
                }`}
              >
                {e.name}
                <span className="sr-only">{e.marked ? " — recorded" : " — not recorded"}</span>
              </span>
              {e.scientific && (
                <span className="block truncate font-serif text-[0.75rem] italic text-fg-subtle">
                  {e.scientific}
                </span>
              )}
            </span>
            {e.circled && (
              <span title="Circled on the plate" className="text-[0.75rem] text-accent">
                ◯
              </span>
            )}
            {e.firstSeen && (
              <span className="tnum text-[0.75rem] text-fg-subtle">
                {e.firstSeen.slice(0, 4)}
              </span>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

function slug(name: string) {
  return `g-${name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
}
