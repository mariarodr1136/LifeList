import Image from "next/image";
import Link from "next/link";
import type { Journal } from "@/lib/types";

/*
  The masthead.

  The artwork is an Audubon blue jay plate (banner.jpg -- a third-party image, fine
  for a private archive, but it would need clearing before this site went public).

  Unlike the longspur plate this one is painted corner to corner, so it can be run
  full bleed: object-cover crops it to a band through the upper bird, whose tail,
  wing and head happen to lie across the full width of the plate. The scrim over the
  left is not decoration -- dark type on painted feathers is unreadable without it,
  and it fades out by the middle so most of the plate is untouched.
*/

export default function Masthead({ meta }: { meta: Journal["meta"] }) {
  return (
    <header className="relative isolate overflow-hidden border-b border-line bg-surface-muted">
      {/* The plate, run full bleed across the band. */}
      <div aria-hidden className="masthead-art absolute inset-0">
        <Image
          src="/banner.jpg"
          alt=""
          fill
          priority
          sizes="100vw"
          className="object-cover object-[50%_26%]"
        />
      </div>

      {/* Ground for the type: see globals.css. */}
      <div aria-hidden className="masthead-scrim absolute inset-0" />

      <div className="relative flex min-h-[132px] flex-col justify-center px-5 py-5 sm:min-h-[232px] sm:px-8">
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
          <span className="tnum">{meta.speciesRecorded} species recorded</span>
          <Dot />
          <span className="tnum">{meta.locations} places</span>
          <Dot />
          <span className="tnum">
            {meta.firstDate?.slice(0, 4)}–{meta.lastDate?.slice(0, 4)}
          </span>
        </p>
      </div>
    </header>
  );
}

function Dot() {
  return <span aria-hidden className="h-[3px] w-[3px] rounded-full bg-fg-subtle/60" />;
}
