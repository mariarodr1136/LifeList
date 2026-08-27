import Image from "next/image";
import Link from "next/link";
import type { Journal } from "@/lib/types";

/*
  The masthead.

  The artwork is a painted plate of two longspurs among poppies (banner.jpg, cropped
  from the file the owner supplied -- a third-party illustration, fine for a private
  archive but it would need clearing before this site went public).

  The plate is 2.2:1 and the band is nearer 9:1, so covering the full width with it
  would crop away both birds' heads. Instead the plate keeps its proportions at the
  right, and WASH -- sampled down its own left edge, cream paper above and sand
  below -- continues that ground across the rest of the band. The join is hidden by
  masking the plate's left edge to transparent, so the whole banner reads as one
  painted surface with the birds standing at the end of it.
*/

const WASH =
  "linear-gradient(180deg,#f0eee7 0%,#f0eee8 60%,#e6e2d1 72%,#eae7dc 84%,#e1cfae 100%)";

export default function Masthead({ meta }: { meta: Journal["meta"] }) {
  return (
    <header className="relative isolate overflow-hidden border-b border-line bg-surface-muted">
      {/* The painted ground, and the plate standing at the right of it. */}
      <div aria-hidden className="masthead-art absolute inset-0" style={{ background: WASH }}>
        <Image
          src="/banner.jpg"
          alt=""
          width={1425}
          height={641}
          priority
          className="masthead-plate absolute inset-y-0 right-0 h-full w-auto max-w-none"
        />
      </div>

      {/* Legibility, only where the theme needs it: see globals.css. */}
      <div aria-hidden className="masthead-scrim absolute inset-0" />

      <div className="relative flex min-h-[104px] flex-col justify-center px-5 py-5 sm:min-h-[168px] sm:px-8">
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
