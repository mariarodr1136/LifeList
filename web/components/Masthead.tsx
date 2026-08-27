import Image from "next/image";
import Link from "next/link";
import type { Journal } from "@/lib/types";

/*
  The masthead.

  The artwork is an Audubon plate of Carolina parakeets (banner.jpg -- a third-party
  image, fine for a private archive, but it would need clearing before this site went
  public).

  The file arrives already cropped to 3:1, so running it full bleed costs far less
  than the plates before it: the band shows about half the strip's height rather than
  a fifth of a portrait plate, and the birds survive the crop. Its left end is pale
  paper and bare branches, which is where the type goes -- the scrim there only has
  to take the edge off, not blot the picture out.
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
          className="object-cover object-[50%_66%]"
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
