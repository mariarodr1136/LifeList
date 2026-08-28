"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import { Icon } from "@/components/Icon";
import { Badge } from "@/components/ui";
import type { FlagReason, FlaggedEntry, ReviewEntry, ReviewFile, Verdict } from "@/lib/types";
import { formatDate } from "@/lib/types";
import { asset } from "@/lib/asset";

type Props = { entries: FlaggedEntry[]; initial: ReviewFile };

/** A verdict being saved; null clears the entry. */
type Patch = Omit<Partial<ReviewEntry>, "verdict"> & { verdict: Verdict | null };

type Filter = "todo" | "done" | "all";

/*
  A static export has no server to POST a verdict to. Saying so plainly beats
  letting the save fall through to the host's 404 page, whose HTML comes back as a
  JSON parse error.
*/
const READ_ONLY = process.env.NEXT_PUBLIC_READ_ONLY === "1";

const REASONS: Record<FlagReason, string> = {
  reread: "Year re-read into the 1970s",
  illegible: "Transcriber could not read it",
  "before-book": "Dated before the book was printed",
  "no-date": "No date written",
  "no-place": "No place written",
  "low-confidence": "Photograph is dim or angled",
};

const VERDICTS: { value: Verdict; label: string; hint: string }[] = [
  { value: "confirmed", label: "Reading is right", hint: "Leave the entry as it stands" },
  { value: "corrected", label: "Needs correcting", hint: "Give the date or place as it really reads" },
  { value: "unsure", label: "Still unsure", hint: "Even in the hand it cannot be settled" },
];

export default function Review({ entries, initial }: Props) {
  const [reviews, setReviews] = useState<Record<string, ReviewEntry>>(initial.entries);
  const [filter, setFilter] = useState<Filter>("all");
  const [selected, setSelected] = useState<string | null>(
    entries.find((e) => !initial.entries[e.id])?.id ?? entries[0]?.id ?? null,
  );
  const [zoom, setZoom] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setZoom(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const visible = useMemo(
    () =>
      entries.filter((e) =>
        filter === "all" ? true : filter === "done" ? reviews[e.id] : !reviews[e.id],
      ),
    [entries, filter, reviews],
  );

  const current = entries.find((e) => e.id === selected) ?? null;
  const saved = current ? reviews[current.id] : undefined;
  const done = Object.keys(reviews).length;

  const save = async (patch: Patch) => {
    if (!current) return;
    if (READ_ONLY) {
      setError(
        "This copy of the site is read-only. The verdicts shown are the ones already applied to the archive.",
      );
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: current.id, ...patch, verdict: patch.verdict ?? "" }),
      });
      const body = (await res.json()) as ReviewFile & { error?: string };
      if (!res.ok) throw new Error(body.error ?? `save failed (${res.status})`);
      setReviews(body.entries);
      // A queue should move on by itself once an entry is settled.
      if (patch.verdict) {
        const next = entries.find((e) => e.id !== current.id && !body.entries[e.id]);
        if (next) setSelected(next.id);
      }
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSaving(false);
    }
  };

  const copyAll = async () => {
    await navigator.clipboard.writeText(
      JSON.stringify({ version: 1, entries: reviews }, null, 2),
    );
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex min-h-0 flex-1">
      {/* The queue. */}
      <div className="sticky top-12 hidden h-[calc(100vh-3rem)] w-[268px] shrink-0 flex-col border-r border-line bg-surface xl:flex">
        <div className="border-b border-line p-3">
          <div className="flex items-baseline justify-between">
            <span className="eyebrow text-fg-subtle">Reviewed</span>
            <span className="tnum text-[0.6875rem] text-fg-subtle">
              {done} of {entries.length}
            </span>
          </div>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-surface-sunk">
            <div
              className="h-full rounded-full bg-tick transition-[width]"
              style={{ width: `${(done / Math.max(entries.length, 1)) * 100}%` }}
            />
          </div>
          <div className="mt-3 flex gap-1">
            {(["todo", "done", "all"] as const).map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                aria-pressed={filter === f}
                className={`rounded-full px-2.5 py-1 text-[0.75rem] font-medium capitalize transition-colors ${
                  filter === f
                    ? "bg-accent-soft text-accent"
                    : "text-fg-subtle hover:bg-surface-muted hover:text-fg-muted"
                }`}
              >
                {f === "todo" ? "To do" : f}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-y-auto p-2 scroll-thin">
          {visible.map((e) => (
            <button
              key={e.id}
              onClick={() => setSelected(e.id)}
              aria-pressed={e.id === selected}
              className={`flex w-full items-start gap-2 rounded-lg px-2.5 py-2 text-left transition-colors ${
                e.id === selected
                  ? "bg-accent-soft text-accent"
                  : "text-fg-muted hover:bg-surface-muted hover:text-fg"
              }`}
            >
              <StatusDot verdict={reviews[e.id]?.verdict} />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[0.8125rem] font-medium">
                  {e.species}
                </span>
                <span className="block truncate text-[0.6875rem] text-fg-subtle">
                  {e.dateRaw ? `“${e.dateRaw}”` : "no date written"}
                </span>
              </span>
            </button>
          ))}
          {visible.length === 0 && (
            <p className="px-2.5 py-8 text-center text-[0.8125rem] text-fg-subtle">
              Nothing left in this filter.
            </p>
          )}
        </div>
      </div>

      <div className="min-w-0 flex-1 px-5 py-6 sm:px-8">
        <div className="mb-5 flex flex-wrap items-center gap-3 xl:hidden">
          <select
            value={selected ?? ""}
            onChange={(e) => setSelected(e.target.value)}
            className="input max-w-full flex-1"
            aria-label="Flagged entry"
          >
            {entries.map((e) => (
              <option key={e.id} value={e.id}>
                {reviews[e.id] ? "✓ " : "• "}
                {e.species} — {e.dateRaw ?? "no date"}
              </option>
            ))}
          </select>
          <span className="tnum text-[0.75rem] text-fg-subtle">
            {done}/{entries.length}
          </span>
        </div>

        {!current ? (
          <p className="text-[0.875rem] text-fg-muted">Nothing is flagged.</p>
        ) : (
          <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_336px]">
            {/* The artefact. This is the one page where the photograph is the point.
                self-start keeps the card the height of the photograph rather than
                stretching it to match the taller column beside it. */}
            <section className="card self-start overflow-hidden">
              <button
                onClick={() => setZoom(true)}
                className="group relative block w-full cursor-zoom-in border-0 bg-surface-sunk p-0"
                aria-label="Enlarge the page photograph"
              >
                <Image
                  src={asset(`/pages/${current.image}.jpg`)}
                  alt={`Photograph of ${current.pageLabel}`}
                  width={1400}
                  height={1050}
                  priority
                  className="h-auto w-full object-contain"
                />
                <span className="pointer-events-none absolute bottom-2.5 right-2.5 rounded-lg bg-fg/80 px-2 py-1 text-[0.6875rem] font-medium text-canvas opacity-0 transition-opacity group-hover:opacity-100">
                  Click to enlarge
                </span>
              </button>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-line px-4 py-2.5 text-[0.75rem] text-fg-subtle">
                <span>
                  {current.image} · {current.pageLabel}
                </span>
                <span>confidence {current.confidence}</span>
                <a
                  href={`/pages/${current.image}.jpg`}
                  target="_blank"
                  rel="noreferrer"
                  className="ml-auto inline-flex items-center gap-1 font-medium text-accent no-underline hover:text-accent-hover"
                >
                  Full size <Icon name="external" className="h-3 w-3" />
                </a>
              </div>
            </section>

            <div className="space-y-5">
              <section className="card p-5">
                <h2 className="text-[1.125rem] font-semibold tracking-[-0.01em] text-fg">
                  {current.species}
                </h2>
                {current.scientific && (
                  <p className="mt-0.5 font-serif text-[0.875rem] italic text-fg-muted">
                    {current.scientific}
                  </p>
                )}

                <dl className="mt-4 space-y-2.5 text-[0.8125rem]">
                  <Fact label="As written">
                    {current.dateRaw ? `“${current.dateRaw}”` : "— nothing written"}
                  </Fact>
                  <Fact label="Read as">
                    {formatDate(current.date, current.precision)}
                    {current.rereadFrom && (
                      <span className="text-flag"> · re-read from {current.rereadFrom}</span>
                    )}
                  </Fact>
                  <Fact label="Place">{current.location ?? "— nothing written"}</Fact>
                  <Fact label="Group">{current.group}</Fact>
                </dl>

                <div className="mt-4 flex flex-wrap gap-1.5">
                  {current.reasons.map((r) => (
                    <Badge key={r} tone="flag">
                      {REASONS[r]}
                    </Badge>
                  ))}
                </div>

                {current.editorial.length > 0 && (
                  <div className="mt-4 border-t border-line pt-3">
                    <p className="eyebrow mb-1.5 text-fg-subtle">Transcriber&apos;s note</p>
                    <ul className="m-0 list-none space-y-1.5 p-0">
                      {current.editorial.map((n, i) => (
                        <li key={i} className="text-[0.75rem] leading-relaxed text-fg-subtle">
                          {n}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </section>

              <VerdictForm
                key={current.id}
                entry={current}
                saved={saved}
                saving={saving}
                onSave={save}
              />

              {error && (
                <p className="rounded-card border border-flag/30 bg-flag-soft px-4 py-3 text-[0.75rem] leading-relaxed text-flag">
                  {error}
                  <button
                    onClick={copyAll}
                    className="ml-2 inline-flex items-center gap-1 font-medium underline"
                  >
                    <Icon name="copy" className="h-3 w-3" />
                    {copied ? "Copied" : "Copy all verdicts instead"}
                  </button>
                </p>
              )}

              <p className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.75rem] leading-relaxed text-fg-subtle">
                Verdicts are written to <code className="text-fg-muted">data/review.json</code>.
                Ask Claude to apply them and the transcription is updated from there.
                <button
                  onClick={copyAll}
                  className="inline-flex items-center gap-1 font-medium text-accent hover:text-accent-hover"
                >
                  <Icon name="copy" className="h-3 w-3" />
                  {copied ? "Copied" : "Copy as JSON"}
                </button>
              </p>
            </div>
          </div>
        )}
      </div>

      {zoom && current && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Page photograph, enlarged"
          onClick={() => setZoom(false)}
          className="fixed inset-0 z-50 cursor-zoom-out overflow-auto bg-fg/90 p-4 scroll-thin"
        >
          <Image
            src={asset(`/pages/${current.image}.jpg`)}
            alt={`Photograph of ${current.pageLabel}`}
            width={2800}
            height={2100}
            className="mx-auto h-auto w-[min(2600px,200%)] max-w-none rounded-md"
          />
          <p className="pointer-events-none fixed bottom-4 left-1/2 -translate-x-1/2 rounded-lg bg-canvas/90 px-3 py-1.5 text-[0.75rem] text-fg">
            Scroll to move around · click or press Esc to close
          </p>
        </div>
      )}
    </div>
  );
}

/* -------------------------------------------------------------------- form */

function VerdictForm({
  entry,
  saved,
  saving,
  onSave,
}: {
  entry: FlaggedEntry;
  saved: ReviewEntry | undefined;
  saving: boolean;
  onSave: (patch: Patch) => void;
}) {
  const [verdict, setVerdict] = useState<Verdict | null>(saved?.verdict ?? null);
  const [date, setDate] = useState(saved?.date ?? "");
  const [place, setPlace] = useState(saved?.location ?? "");
  const [note, setNote] = useState(saved?.note ?? "");

  return (
    <section className="card p-5">
      <h3 className="text-[0.9375rem] font-semibold tracking-[-0.01em] text-fg">
        Your reading
      </h3>
      <p className="mt-1 text-[0.75rem] leading-relaxed text-fg-muted">
        Look at the page above and say what it actually reads. Anything you type here
        outranks the transcription.
      </p>

      <div className="mt-4 flex flex-col gap-1.5">
        {VERDICTS.map((v) => (
          <button
            key={v.value}
            onClick={() => setVerdict(v.value)}
            aria-pressed={verdict === v.value}
            className={`rounded-lg border px-3 py-2 text-left transition-colors ${
              verdict === v.value
                ? "border-accent bg-accent-soft"
                : "border-line hover:border-line-strong hover:bg-surface-muted"
            }`}
          >
            <span
              className={`block text-[0.8125rem] font-medium ${
                verdict === v.value ? "text-accent" : "text-fg"
              }`}
            >
              {v.label}
            </span>
            <span className="block text-[0.6875rem] text-fg-subtle">{v.hint}</span>
          </button>
        ))}
      </div>

      {verdict === "corrected" && (
        <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
          <label className="block">
            <span className="eyebrow mb-1 block text-fg-subtle">Date it reads</span>
            <input
              value={date}
              onChange={(e) => setDate(e.target.value)}
              placeholder={entry.dateRaw ?? "e.g. 6/30/77"}
              className="input"
            />
          </label>
          <label className="block">
            <span className="eyebrow mb-1 block text-fg-subtle">Place it reads</span>
            <input
              value={place}
              onChange={(e) => setPlace(e.target.value)}
              placeholder={entry.location ?? "e.g. Upper Newport Bay"}
              className="input"
            />
          </label>
        </div>
      )}

      <label className="mt-3 block">
        <span className="eyebrow mb-1 block text-fg-subtle">Note</span>
        <textarea
          value={note}
          onChange={(e) => setNote(e.target.value)}
          rows={3}
          placeholder="What you can see that the transcription missed…"
          className="input resize-y"
        />
      </label>

      <div className="mt-3 flex items-center gap-2">
        <button
          disabled={!verdict || saving}
          onClick={() => onSave({ verdict, date, location: place, note })}
          className="rounded-lg bg-accent px-3 py-2 text-[0.8125rem] font-medium text-white transition-colors hover:bg-accent-hover disabled:cursor-default disabled:opacity-40"
        >
          {saving ? "Saving…" : saved ? "Update & next" : "Save & next"}
        </button>
        {saved && (
          <button
            onClick={() => {
              setVerdict(null);
              setDate("");
              setPlace("");
              setNote("");
              onSave({ verdict: null });
            }}
            className="text-[0.75rem] font-medium text-fg-subtle hover:text-fg-muted"
          >
            Clear
          </button>
        )}
        {saved?.at && (
          <span className="ml-auto text-[0.6875rem] text-fg-subtle">
            saved {new Date(saved.at).toLocaleString()}
          </span>
        )}
      </div>
    </section>
  );
}

/* ------------------------------------------------------------------- bits */

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-3">
      <dt className="eyebrow pt-[3px] text-fg-subtle">{label}</dt>
      <dd className="m-0 text-fg">{children}</dd>
    </div>
  );
}

function StatusDot({ verdict }: { verdict: Verdict | undefined }) {
  const tone =
    verdict === "confirmed"
      ? "bg-tick"
      : verdict === "corrected"
        ? "bg-accent"
        : verdict === "unsure"
          ? "bg-flag"
          : "border border-line-strong";
  return (
    <span
      title={verdict ?? "not reviewed"}
      className={`mt-[5px] h-2 w-2 shrink-0 rounded-full ${tone}`}
    />
  );
}
