import Link from "next/link";
import type { Journal } from "@/lib/types";

/*
  The masthead.

  An earlier version drew this as one of the book's own plates -- sage ground,
  painted plumage, printed captions -- and it read as a scan pasted onto a product
  interface. This one keeps the same two birds but reduces them to a single stroke
  weight in the interface's own ink, so the header belongs to the application and
  the book shows up as a line, not as a texture.
*/

export default function Masthead({ meta }: { meta: Journal["meta"] }) {
  return (
    <header className="relative isolate overflow-hidden border-b border-line bg-surface-muted/50">
      <div className="flex items-center justify-between gap-6 px-5 py-5 sm:px-8 sm:py-6">
        <div className="min-w-0">
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

        <Waders className="hidden h-[76px] shrink-0 text-fg-subtle sm:block lg:h-[86px]" />
      </div>
    </header>
  );
}

function Dot() {
  return (
    <span aria-hidden className="h-[3px] w-[3px] rounded-full bg-fg-subtle/60" />
  );
}

/*
  The same avocet and stilt as before, drawn as outlines only.

  A single 2px stroke in currentColor is all the drawing there is: it inherits the
  text colour, so it follows the theme instead of being dimmed against it, and it
  sits beside Inter without competing with it.
*/

const AVOCET =
  "M58 26 C86 34, 112 44, 126 50 C124 40, 132 33, 143 33 C155 33, 163 42, 163 54 " +
  "C163 62, 159 68, 153 72 C161 84, 173 94, 187 100 C216 108, 248 110, 274 106 " +
  "C288 104, 297 100, 306 95 C303 109, 296 119, 287 126 C266 141, 222 147, 196 141 " +
  "C172 136, 158 123, 152 106 C147 96, 141 84, 137 74 C131 68, 119 62, 107 56 " +
  "C89 48, 72 36, 58 26 Z";

const STILT =
  "M348 60 C372 62, 394 64, 404 66 C402 55, 410 45, 422 45 C434 45, 443 55, 443 68 " +
  "C443 76, 439 82, 433 86 C439 98, 449 108, 463 114 C492 124, 522 126, 548 122 " +
  "C562 119, 572 114, 581 108 C578 123, 570 134, 558 142 C532 157, 494 161, 468 155 " +
  "C447 150, 436 137, 431 121 C427 109, 424 96, 420 86 C414 80, 402 74, 390 70 " +
  "C374 66, 360 62, 348 60 Z";

function Waders({ className }: { className?: string }) {
  return (
    <svg
      viewBox="30 20 570 180"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      className={className}
    >
      <g opacity="0.6">
        <path d={AVOCET} />
        <path d="M186 141 L181 178 M212 142 L214 178" />
        <path d="M130 50 C106 42, 82 32, 54 20" />
        {/* the folded wing, as one line rather than a painted mass */}
        <path d="M176 96 C214 88, 262 96, 306 110" opacity="0.75" />
        <circle cx="141" cy="49" r="1.6" fill="currentColor" stroke="none" />
      </g>

      <g opacity="0.6">
        <path d={STILT} />
        <path d="M458 154 L452 190 M482 155 L484 190" />
        <path d="M406 66 L344 58" />
        <path d="M436 110 C474 100, 528 108, 584 122" opacity="0.75" />
        <circle cx="420" cy="62" r="1.6" fill="currentColor" stroke="none" />
      </g>

      {/* the ground they stand on, kept to a hairline */}
      <path d="M40 192 H596" opacity="0.25" strokeWidth="1.5" />
    </svg>
  );
}
