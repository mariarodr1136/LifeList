"use client";

import { useState } from "react";

/*
  Every chart here answers a magnitude question about a single series, so there is
  one ink and no legend -- the figure's title names the series. The ink is the
  interface accent, which is validated against both surfaces.
*/

type YearDatum = { year: string; count: number };

export function YearTimeline({ data }: { data: YearDatum[] }) {
  // The hovered year is held as an index rather than a datum, because the label
  // has to be placed over the bar it describes, not just name it.
  const [hover, setHover] = useState<number | null>(null);

  if (data.length === 0) return null;

  // Render every year in the span, so the quiet decades read as real gaps rather
  // than being collapsed away.
  const first = Number(data[0].year);
  const last = Number(data[data.length - 1].year);
  const counts = new Map(data.map((d) => [d.year, d.count]));
  const years: YearDatum[] = [];
  for (let y = first; y <= last; y++) {
    years.push({ year: String(y), count: counts.get(String(y)) ?? 0 });
  }
  const max = Math.max(...years.map((y) => y.count));
  const peak = years.find((y) => y.count === max);

  const hovered = hover === null ? null : years[hover];
  // The centre of the hovered bar, as a percentage across the plot.
  const hoverX = hover === null ? 0 : ((hover + 0.5) / years.length) * 100;
  /*
    Centred on its bar, except within a tooltip's half-width of either end, where
    centring would hang the label off the card. There it anchors to the edge it is
    near instead, which keeps it inside the figure without measuring anything.
  */
  const anchor = hoverX < 6 ? "start" : hoverX > 94 ? "end" : "middle";

  return (
    <figure className="m-0">
      <figcaption className="text-[0.9375rem] font-semibold tracking-[-0.01em] text-fg">
        Entries by year
      </figcaption>
      <p className="mb-4 mt-1 text-[0.8125rem] text-fg-muted">
        {first}–{last}. Busiest year {peak?.year}, with {max} entries.
      </p>

      <div
        className="relative flex h-40 items-end gap-[2px]"
        onMouseLeave={() => setHover(null)}
        role="img"
        aria-label={`Bar chart of entries per year from ${first} to ${last}, peaking at ${max} in ${peak?.year}.`}
      >
        {years.map((y, i) => (
          <div
            key={y.year}
            onMouseEnter={() => setHover(i)}
            className="group relative flex h-full flex-1 cursor-default items-end"
          >
            {/* Invisible full-height hit target, larger than the mark itself. */}
            <span className="absolute inset-0" />
            <span
              className="w-full rounded-t-[4px] transition-colors"
              style={{
                height: `${Math.max((y.count / max) * 100, y.count > 0 ? 3 : 0)}%`,
                background:
                  hover === i ? "var(--color-fg)" : "var(--color-accent)",
              }}
            />
          </div>
        ))}

        {hovered && (
          <div
            style={{ left: `${hoverX}%` }}
            className={`pointer-events-none absolute -top-2 z-10 whitespace-nowrap rounded-lg border border-line bg-surface px-2.5 py-1 text-[0.75rem] text-fg shadow-[0_6px_20px_-8px_rgba(0,0,0,0.35)] ${
              anchor === "start"
                ? ""
                : anchor === "end"
                  ? "-translate-x-full"
                  : "-translate-x-1/2"
            }`}
          >
            <span className="tnum font-medium">{hovered.year}</span>
            <span className="text-fg-muted">
              {" "}
              · {hovered.count} {hovered.count === 1 ? "entry" : "entries"}
            </span>
          </div>
        )}
      </div>

      <div className="tnum mt-2 flex justify-between text-[0.6875rem] text-fg-subtle">
        <span>{first}</span>
        <span>{last}</span>
      </div>
    </figure>
  );
}

type RankDatum = { label: string; value: number; sub?: string | null };

export function RankedBars({
  title,
  note,
  data,
  unit,
}: {
  title: string;
  note?: string;
  data: RankDatum[];
  unit: string;
}) {
  const max = Math.max(...data.map((d) => d.value), 1);

  return (
    <figure className="m-0">
      <figcaption className="text-[0.9375rem] font-semibold tracking-[-0.01em] text-fg">
        {title}
      </figcaption>
      {note && <p className="mb-4 mt-1 text-[0.8125rem] leading-relaxed text-fg-muted">{note}</p>}

      <ol className="m-0 list-none space-y-2.5 p-0">
        {data.map((d) => (
          <li key={d.label} className="grid grid-cols-[1fr_auto] items-baseline gap-x-3">
            <div className="min-w-0">
              <p className="truncate text-[0.8125rem] text-fg" title={d.label}>
                {d.label}
                {d.sub && <span className="ml-1.5 text-fg-subtle">{d.sub}</span>}
              </p>
              <div className="mt-1.5 h-1.5 rounded-full bg-surface-sunk">
                <div
                  className="h-full rounded-full bg-accent"
                  style={{ width: `${(d.value / max) * 100}%` }}
                />
              </div>
            </div>
            {/* Direct label: with one series, the number belongs on the mark. */}
            <span className="tnum text-[0.75rem] text-fg-muted">
              {d.value} {unit}
            </span>
          </li>
        ))}
      </ol>
    </figure>
  );
}
