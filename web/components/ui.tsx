import Image from "next/image";
import type { ReactNode } from "react";
import type { Plate } from "@/lib/types";
import { asset } from "@/lib/asset";

/** The header every route opens with: eyebrow, title, one line of orientation. */
export function PageHeader({
  eyebrow,
  title,
  lead,
  children,
}: {
  eyebrow: string;
  title: string;
  lead: string;
  children?: ReactNode;
}) {
  return (
    <header className="border-b border-line bg-surface px-5 py-6 sm:px-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        {/* Wide enough for a two-sentence lead to sit on one line on a desktop
            window; it still wraps when the window cannot hold it. */}
        <div className="max-w-[68rem]">
          <p className="eyebrow text-accent">{eyebrow}</p>
          <h1 className="mt-1.5 text-[1.75rem] font-semibold leading-tight tracking-[-0.02em] text-fg">
            {title}
          </h1>
          <p className="mt-2 text-[0.875rem] leading-relaxed text-fg-muted">{lead}</p>
        </div>
        {children}
      </div>
    </header>
  );
}

export function Badge({
  tone = "neutral",
  children,
  title,
}: {
  tone?: "neutral" | "accent" | "tick" | "flag";
  children: ReactNode;
  title?: string;
}) {
  const tones = {
    neutral: "bg-surface-muted text-fg-muted border-line",
    accent: "bg-accent-soft text-accent border-accent-line",
    tick: "bg-tick-soft text-tick border-tick/25",
    flag: "bg-flag-soft text-flag border-flag/25",
  } as const;
  return (
    <span
      title={title}
      className={`inline-flex items-center gap-1 rounded-full border px-2 py-[3px] text-[0.6875rem] font-medium leading-none ${tones[tone]}`}
    >
      {children}
    </span>
  );
}

export function StatTile({
  value,
  label,
  note,
}: {
  value: string | number;
  label: string;
  note?: string;
}) {
  return (
    <div className="card p-4">
      <p className="tnum text-[1.75rem] font-semibold leading-none tracking-[-0.025em] text-fg">
        {typeof value === "number" ? value.toLocaleString() : value}
      </p>
      <p className="eyebrow mt-2 text-fg-subtle">{label}</p>
      {note && <p className="mt-1.5 text-[0.75rem] leading-snug text-fg-muted">{note}</p>}
    </div>
  );
}

/** How many bird-placeholder-N.webp exist. Written by extract/make_placeholder.py. */
const PLACEHOLDERS = 6;

/**
 * Which stand-in an unplated bird gets.
 *
 * Hashed from the species key rather than picked at random, because the choice has
 * to survive a re-render and has to agree between the server's HTML and the
 * browser's — a random pick would hydrate into a mismatch, and a bird would change
 * its picture on every keystroke in the search box.
 */
function variantFor(seed: string): number {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return (h % PLACEHOLDERS) + 1;
}

/**
 * The bird, as Audubon painted it — or the stand-in where he never painted it.
 *
 * He covers a little under half the book: he died in 1851 having barely worked
 * west of the Mississippi, and she birded California, so the Cactus Wren and the
 * Roadrunner have no plate and never will. Those 73 species get a stand-in that
 * says so — several birds at once, captioned, so it cannot be read as a claim
 * about which bird this is. Still no borrowing of one artist's bird to stand for
 * another's.
 */
export function BirdImage({
  plate,
  alt = "",
  className = "",
  sizes = "300px",
  whole = false,
  compact = false,
  seed = "",
}: {
  plate?: Plate;
  alt?: string;
  className?: string;
  sizes?: string;
  /** Show the plate as Audubon composed it, rather than the card's crop. */
  whole?: boolean;
  /** A frame of a few dozen pixels: too small for a plate or for words. */
  compact?: boolean;
  /** Chooses which stand-in an unplated bird gets. Pass the species key. */
  seed?: string;
}) {
  if (!plate) {
    // The sheet keeps its middle clear for the caption, so at thumbnail size it
    // would crop to bare paper. The line drawing was made for that size; it stays.
    if (compact) {
      return (
        <Image
          src={asset("/bird-placeholder.svg")}
          alt=""
          width={400}
          height={300}
          sizes={sizes}
          className={`h-full w-full object-contain ${className}`}
        />
      );
    }
    return (
      <span className="relative block h-full w-full">
        {/*
          A plate by one of the same hands credited elsewhere, washed back toward
          the paper -- see extract/make_placeholder.py. Which one is decided by the
          species' own key, so a bird keeps its stand-in from render to render
          while a screenful of unplated birds is not the same tile six times.
        */}
        <Image
          src={asset(`/bird-placeholder-${variantFor(seed)}.webp`)}
          alt=""
          width={800}
          height={640}
          sizes={sizes}
          className={`h-full w-full object-cover ${className}`}
        />
        <span className="absolute inset-0 flex items-center justify-center p-3">
          <span className="eyebrow rounded-full border border-line/80 bg-surface/75 px-2.5 py-1 text-center text-fg-subtle backdrop-blur-[2px]">
            No image available
          </span>
        </span>
      </span>
    );
  }
  const caption = alt ? `${alt}, painted by ${plate.artist}` : "";

  // Opened, the plate is shown whole and at its own proportions: the card's crop
  // answers "which bird is this", and the sheet answers "what did he paint".
  if (whole) {
    return (
      <Image
        src={asset(`/plates/${plate.image}.webp`)}
        alt={caption}
        width={plate.fullWidth}
        height={plate.fullHeight}
        sizes={sizes}
        className={`h-auto w-full ${className}`}
      />
    );
  }

  return (
    <Image
      src={asset(`/plates/${plate.image}-card.webp`)}
      alt={caption}
      width={plate.width}
      height={plate.height}
      sizes={sizes}
      /*
        This file is already the card's frame: card_box() in extract/fetch_plates.py
        cut it to 5:4 around the bird, taking the sheet's margin and lettering with
        it. Cover rather than contain so a rounding pixel fills rather than shows
        as a hairline of background, and no object-position -- moving the window is
        the pipeline's job, and doing it again here is what put paper down one side.
      */
      className={`h-full w-full object-cover ${className}`}
    />
  );
}

export function EmptyState({ title, note }: { title: string; note: string }) {
  return (
    <div className="card flex flex-col items-center gap-1.5 px-6 py-16 text-center">
      <p className="text-[0.9375rem] font-medium text-fg">{title}</p>
      <p className="max-w-[24rem] text-[0.8125rem] leading-relaxed text-fg-muted">{note}</p>
    </div>
  );
}
