import Link from "next/link";
import { RankedBars, YearTimeline } from "@/components/Charts";
import { Icon } from "@/components/Icon";
import { PageHeader, StatTile } from "@/components/ui";
import { BOOKKEEPING_GROUPS, formatDate, getChecklist, getJournal } from "@/lib/data";

export const metadata = {
  title: "Overview — A Life List",
  description: "What fifty years of annotations in one field guide add up to.",
};

export default function OverviewPage() {
  const j = getJournal();
  const { meta } = j;

  const span =
    meta.firstDate && meta.lastDate
      ? Number(meta.lastDate.slice(0, 4)) - Number(meta.firstDate.slice(0, 4))
      : 0;

  const places = j.locations.slice(0, 10).map((l) => ({
    label: l.name,
    value: l.visits,
    sub: l.state && !l.name.toUpperCase().includes(l.state) ? l.state : null,
  }));

  // Only real headings are ranked; the index-tick bucket is larger than any of
  // them and would flatten the chart into a single bar.
  const groups = getChecklist()
    .filter((g) => !BOOKKEEPING_GROUPS.includes(g.name))
    .sort((a, b) => b.marked - a.marked)
    .slice(0, 10)
    .map((g) => ({ label: g.name, value: g.marked, sub: null }));

  const reread = j.observations.filter((o) => o.rereadFrom).length;
  const withNotes = j.species.filter((s) => s.notes.length > 0).length;
  const circled = j.species.filter((s) => s.circled).length;

  return (
    <>
      <PageHeader
        eyebrow="Overview"
        title="Fifty years in one book"
        lead="One copy of Birds of North America, carried for half a century and written in by hand. Everything below was read off the pages themselves — the printed names are the book's, the dates and places are his."
      />

      <div className="space-y-5 px-5 py-6 sm:px-8">
        <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatTile value={meta.speciesRecorded} label="species recorded" note={`of ${meta.speciesOnPages.toLocaleString()} printed in the guide`} />
          <StatTile value={meta.observations} label="dated & placed entries" note={`${meta.datedObservations} of them carry a date`} />
          <StatTile value={meta.locations} label="places named" note="spelling variants folded together" />
          <StatTile value={span} label="years spanned" note={`${meta.firstDate?.slice(0, 4)} to ${meta.lastDate?.slice(0, 4)}`} />
        </section>

        <section className="card p-5 sm:p-6">
          <YearTimeline data={j.byYear} />
        </section>

        <div className="grid gap-5 lg:grid-cols-2">
          <section className="card p-5 sm:p-6">
            <RankedBars
              title="Most visited places"
              note="Spelling variants folded together — he wrote Upper Newport Bay four different ways."
              data={places}
              unit="entries"
            />
          </section>

          <section className="card p-5 sm:p-6">
            <RankedBars
              title="Best-recorded groups"
              note="Grouped by the book's own headings rather than modern taxonomy."
              data={groups}
              unit="species"
            />
          </section>
        </div>

        <section className="card p-5 sm:p-6">
          <h2 className="text-[0.9375rem] font-semibold tracking-[-0.01em] text-fg">
            The first and the last
          </h2>
          <p className="mb-5 mt-1 text-[0.8125rem] text-fg-muted">
            The earliest entries are retrospective — he wrote them from memory, long
            after the fact.
          </p>
          <div className="grid gap-5 sm:grid-cols-2">
            <Bookend obs={earliest(j)} caption="Earliest entry" />
            <Bookend obs={latest(j)} caption="Latest entry" />
          </div>
        </section>

        <section className="card p-5 sm:p-6">
          <h2 className="text-[0.9375rem] font-semibold tracking-[-0.01em] text-fg">
            About this transcription
          </h2>
          <ul className="m-0 mt-3 list-none space-y-2.5 p-0 text-[0.8125rem] leading-relaxed text-fg-muted">
            <li>
              <strong className="font-medium text-fg">
                {meta.spreads} photographed spreads
              </strong>{" "}
              were read page by page. {withNotes} species carry a field note in his
              own hand, and {circled} have a figure circled on the plate.
            </li>
            <li>
              <strong className="font-medium text-fg">
                {meta.needsReview} entries are flagged
              </strong>{" "}
              — either the handwriting was ambiguous, or the date lands before the
              book was printed in the mid-1960s. Those are worth a human eye.
            </li>
            <li>
              <strong className="font-medium text-fg">{reread} dates were re-read</strong>{" "}
              from the 1910s into the 1970s. A 7 written short reads as a 1, and the
              guide was not printed until 1966, so a two-digit year landing in the
              1910s is almost certainly a 197x. Each one still shows what is on the
              page and says what was changed.
            </li>
            <li>
              No sighting counts appear anywhere in the book, so there is no tally of
              how many birds were seen — only which, where and when.
            </li>
            <li>
              Dates are shown at the precision he wrote them. &ldquo;4/77&rdquo; stays
              April 1977; &ldquo;early 1950s&rdquo; stays a decade.
            </li>
            <li>
              Bird artwork is a placeholder throughout — the guide&apos;s plates are
              not digitised, so every species shows the same illustration.
            </li>
          </ul>
          <p className="mt-5">
            <Link
              href="/"
              className="inline-flex items-center gap-1.5 text-[0.8125rem] font-medium text-accent no-underline hover:text-accent-hover"
            >
              Open the life list <Icon name="arrow" className="h-3.5 w-3.5" />
            </Link>
          </p>
        </section>
      </div>
    </>
  );
}

function Bookend({
  obs,
  caption,
}: {
  obs: ReturnType<typeof earliest>;
  caption: string;
}) {
  if (!obs) return null;
  return (
    <div className="rounded-card border border-line bg-surface-muted/50 p-4">
      <p className="eyebrow text-fg-subtle">{caption}</p>
      <p className="mt-1.5 text-[1.0625rem] font-semibold tracking-[-0.01em] text-fg">
        {obs.species}
      </p>
      <p className="mt-1 font-serif text-[0.9375rem] italic text-fg-muted">
        {obs.location ?? "place not written"}
        {obs.dateRaw && <> · {formatDate(obs.date, obs.precision)}</>}
      </p>
    </div>
  );
}

function earliest(j: ReturnType<typeof getJournal>) {
  return j.observations
    .filter((o) => o.date && !o.uncertain)
    .sort((a, b) => (a.date! < b.date! ? -1 : 1))[0];
}

function latest(j: ReturnType<typeof getJournal>) {
  return j.observations
    .filter((o) => o.date && !o.uncertain)
    .sort((a, b) => (a.date! > b.date! ? -1 : 1))[0];
}
