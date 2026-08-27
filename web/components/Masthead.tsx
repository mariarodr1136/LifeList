import Image from "next/image";
import Link from "next/link";
import type { Journal } from "@/lib/types";

/*
  The masthead.

  The artwork is a painted plate of two longspurs among poppies (banner.jpg, cropped
  from the file the owner supplied -- a third-party illustration, fine for a private
  archive but it would need clearing before this site went public). It is set to the
  band's height rather than cropped to it, so neither bird loses its head, and its
  left edge is masked to transparent rather than covered by a matching rectangle --
  the image dissolves into whatever surface is behind it, in either theme.
*/

export default function Masthead({ meta }: { meta: Journal["meta"] }) {
  return (
    <header className="relative isolate overflow-hidden border-b border-line bg-surface-muted">
      {/* The plate, flush with the right edge and the full height of the band. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-y-0 right-0 hidden sm:block"
      >
        <Image
          src="/banner.jpg"
          alt=""
          width={1425}
          height={641}
          priority
          className="masthead-art h-full w-auto max-w-none object-cover"
        />
      </div>

      <div className="relative flex min-h-[104px] flex-col justify-center px-5 py-5 sm:min-h-[160px] sm:px-8">
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
