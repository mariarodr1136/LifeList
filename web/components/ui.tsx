import Image from "next/image";
import type { ReactNode } from "react";
import type { Plate } from "@/lib/types";

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

/**
 * The bird, as Audubon painted it — or the stand-in where he never painted it.
 *
 * He covers a little under half the book: he died in 1851 having barely worked
 * west of the Mississippi, and she birded California, so the Cactus Wren and the
 * Roadrunner have no plate and never will. The rest keep the obvious placeholder
 * rather than borrowing another artist's bird and passing it off as the record.
 */
export function BirdImage({
  plate,
  alt = "",
  className = "",
  sizes = "300px",
  whole = false,
}: {
  plate?: Plate;
  alt?: string;
  className?: string;
  sizes?: string;
  /** Show the plate as Audubon composed it, rather than the card's crop. */
  whole?: boolean;
}) {
  if (!plate) {
    return (
      <Image
        src="/bird-placeholder.svg"
        alt=""
        width={400}
        height={300}
        sizes={sizes}
        className={`h-full w-full object-contain ${className}`}
      />
    );
  }
  const caption = alt ? `${alt}, from Audubon's plate ${plate.plate}` : "";

  // Opened, the plate is shown whole and at its own proportions: the card's crop
  // answers "which bird is this", and the sheet answers "what did he paint".
  if (whole) {
    return (
      <Image
        src={`/plates/plate-${plate.plate}.webp`}
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
      src={`/plates/plate-${plate.plate}-card.webp`}
      alt={caption}
      width={plate.width}
      height={plate.height}
      sizes={sizes}
      /*
        Filled rather than fitted, so the bird reads at card size. Even cropped to
        the paint, a portrait plate loses half its height to a landscape frame, so
        each carries its own focal point; see focus_y() in extract/build_web.py.
      */
      style={{ objectPosition: `50% ${plate.focusY}%` }}
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
