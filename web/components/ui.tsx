import Image from "next/image";
import type { ReactNode } from "react";

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
        <div className="max-w-[46rem]">
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
 * Stand-in artwork.
 *
 * Every bird shows the same illustration for now — the book's plates are not
 * digitised, and inventing a photograph for a species would be a worse lie than an
 * obvious placeholder.
 */
export function BirdImage({
  className = "",
  sizes = "300px",
}: {
  className?: string;
  sizes?: string;
}) {
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

export function EmptyState({ title, note }: { title: string; note: string }) {
  return (
    <div className="card flex flex-col items-center gap-1.5 px-6 py-16 text-center">
      <p className="text-[0.9375rem] font-medium text-fg">{title}</p>
      <p className="max-w-[24rem] text-[0.8125rem] leading-relaxed text-fg-muted">{note}</p>
    </div>
  );
}
