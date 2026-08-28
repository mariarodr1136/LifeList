import Image from "next/image";
import Link from "next/link";
import type { Journal } from "@/lib/types";
import { asset } from "@/lib/asset";

/*
  The masthead.

  The artwork is an Audubon plate of Carolina parakeets (banner.jpg -- a third-party
  image, fine for a private archive, but it would need clearing before this site went
  public).

  The file arrives already cropped to 3:1. Covering the band with it meant scaling it
  up until only half its height showed, so instead it is fitted whole -- full height,
  right-anchored -- and MOUNT, the plate's own paper tone, carries on across the rest
  of the band. Its left edge is masked into that mount, so the picture ends the way a
  plate ends on paper rather than on a cut line, and the type sits on the mount.
*/

/** The plate's own paper, sampled from behind its figures. */
const MOUNT = "#ded2c0";

export default function Masthead({ meta }: { meta: Journal["meta"] }) {
  const progress = Math.round((meta.speciesRecorded / meta.speciesOnPages) * 100);

  return (
    <header className="relative isolate overflow-hidden border-b border-line bg-surface-muted">
      {/* The plate, fitted whole to the band, on a mount of its own paper. */}
      <div
        aria-hidden
        className="masthead-art absolute inset-0"
        style={{ backgroundColor: MOUNT }}
      >
        <Image
          src={asset("/banner.jpg")}
          alt=""
          width={1920}
          height={640}
          priority
          className="masthead-plate absolute inset-y-0 right-0 h-full w-auto max-w-none"
        />
      </div>

      {/* Ground for the type: see globals.css. */}
      <div aria-hidden className="masthead-scrim absolute inset-0" />

      <div className="relative flex min-h-[132px] flex-col justify-center px-5 py-5 sm:min-h-[280px] sm:px-8">
        <p className="eyebrow text-fg-subtle">
          Golden Press · Robbins, Bruun &amp; Zim
        </p>
        {/* The name lives here now rather than in the sidebar, so it doubles as
            the way home. */}
        <h1 className="mt-1.5 text-[1.5rem] font-semibold leading-none tracking-[-0.025em] sm:text-[1.875rem]">
          <Link href="/" className="text-fg no-underline transition-colors hover:text-accent">
            A Life List
          </Link>
        </h1>
        <p className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1 text-[0.8125rem] text-fg-muted">
          <span>Birds of North America</span>
          <Dot />
          <span className="tnum">{meta.locations} places</span>
          <Dot />
          <span className="tnum">
            {meta.firstDate?.slice(0, 4)}–{meta.lastDate?.slice(0, 4)}
          </span>
        </p>

        {/* The running total, which used to sit in the sidebar. */}
        <div className="mt-4 max-w-[19rem]">
          <div className="flex items-baseline justify-between gap-3">
            <span className="eyebrow text-fg-subtle">Recorded</span>
            <span className="tnum text-[0.6875rem] text-fg-subtle">{progress}%</span>
          </div>
          <p className="mt-1 text-[1.25rem] font-semibold leading-none tracking-[-0.02em] text-fg">
            <span className="tnum">{meta.speciesRecorded}</span>
            <span className="ml-1 text-[0.8125rem] font-normal text-fg-muted">
              of {meta.speciesOnPages.toLocaleString()} species
            </span>
          </p>
          <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-fg/10">
            <div className="h-full rounded-full bg-accent" style={{ width: `${progress}%` }} />
          </div>
          <p className="tnum mt-1.5 text-[0.6875rem] text-fg-muted">
            {meta.observations} entries · {meta.families} groups
          </p>
        </div>
      </div>
    </header>
  );
}

function Dot() {
  return <span aria-hidden className="h-[3px] w-[3px] rounded-full bg-fg-subtle/60" />;
}
