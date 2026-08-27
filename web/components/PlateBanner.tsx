import type { Journal } from "@/lib/types";

/*
  The masthead, drawn as one of the book's own plates.

  The Golden Guide prints its birds on a flat coloured ground -- sage green for the
  shorebirds, blue-grey for the hummingbirds -- each figure captioned in small
  capitals with its length. The ground here is sampled from the plate photographed
  on page 109 (#b2c6b4); the two waders are the ones facing the page he wrote
  "UPPER NEWPORT BAY" across.

  Each bird is one white silhouette with its plumage clipped inside it, which is how
  the printed plates read: no outline, no visible seam between head and body, the
  markings sitting flat on the shape.
*/

const PLATE = {
  ink: "#2b281f",
  white: "#f4f2e8",
  shade: "#d8d5c6",
  cinnamon: "#c08551",
  cinnamonDeep: "#a96f3f",
  legBlue: "#7d8f9e",
  legRed: "#c06a5f",
  label: "#37342a",
} as const;

export default function PlateBanner({ meta }: { meta: Journal["meta"] }) {
  return (
    <div className="plate-band relative isolate h-[112px] overflow-hidden border-b border-line bg-[linear-gradient(100deg,#a7bdab_0%,#b4c8b6_45%,#a2b9a7_100%)] sm:h-[144px]">
      {/* The mechanical stipple of a cheaply printed plate. */}
      <svg
        aria-hidden
        preserveAspectRatio="none"
        viewBox="0 0 100 100"
        className="absolute inset-0 h-full w-full opacity-[0.07] mix-blend-multiply"
      >
        <filter id="plate-grain">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="3" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="100" height="100" filter="url(#plate-grain)" />
      </svg>

      {/* The figures, anchored to the right and scaled by the band's height. */}
      <svg
        viewBox="0 -14 660 226"
        preserveAspectRatio="xMaxYMid meet"
        aria-hidden
        className="absolute inset-y-0 right-0 hidden h-full sm:block"
      >
        {/* The shallow wash the plates stand their waders in. */}
        <path d="M0 178 H660" stroke="#a0b8a6" strokeWidth="20" opacity="0.75" />
        <path d="M0 168 H660" stroke={PLATE.white} strokeWidth="1" opacity="0.28" />

        <g transform="translate(-26,0)">
          <Avocet />
        </g>
        <g transform="translate(-58,-4)">
          <Stilt />
        </g>

        {/* The plate sets its captions in a column at the right margin. */}
        <g
          fill={PLATE.label}
          fontFamily="var(--font-inter), sans-serif"
          fontSize="11.5"
          letterSpacing="1.2"
          textAnchor="end"
        >
          <text x="646" y="50">AMERICAN AVOCET</text>
          <text x="646" y="65" fontSize="10" opacity="0.7">L 18&quot;</text>
          <text x="646" y="122">BLACK-NECKED</text>
          <text x="646" y="137">STILT</text>
          <text x="646" y="152" fontSize="10" opacity="0.7">L 13&quot;</text>
        </g>
      </svg>

      {/* Set as text, not baked into the drawing: it stays selectable and sharp. */}
      <div className="relative flex h-full max-w-[62%] flex-col justify-center px-5 sm:px-8">
        <p className="text-[0.625rem] font-semibold uppercase tracking-[0.22em] text-[#4a4636]">
          Golden Press · Robbins, Bruun &amp; Zim
        </p>
        <h1 className="mt-1.5 font-serif text-[1.6rem] leading-none tracking-[0.01em] text-[#26241c] sm:text-[2.1rem]">
          A Life List
        </h1>
        <p className="mt-2 text-[0.6875rem] tracking-[0.04em] text-[#403d30] sm:text-[0.75rem]">
          Birds of North America · {meta.speciesRecorded} species recorded ·{" "}
          {meta.locations} places · {meta.firstDate?.slice(0, 4)}–
          {meta.lastDate?.slice(0, 4)}
        </p>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ figures */

/*
  Each bird is ONE closed outline -- bill, crown, nape, back, tail, belly, throat,
  and back along the bill -- filled white, with the plumage painted through a clip
  of that same outline. That is what makes a plate read as a plate: no stroke around
  the figure, no seam where the head meets the neck, the markings sitting flat
  inside a single silhouette.
*/

const AVOCET =
  "M58 26 C86 34, 112 44, 126 50 C124 40, 132 33, 143 33 C155 33, 163 42, 163 54 " +
  "C163 62, 159 68, 153 72 C161 84, 173 94, 187 100 C216 108, 248 110, 274 106 " +
  "C288 104, 297 100, 306 95 C303 109, 296 119, 287 126 C266 141, 222 147, 196 141 " +
  "C172 136, 158 123, 152 106 C147 96, 141 84, 137 74 C131 68, 119 62, 107 56 " +
  "C89 48, 72 36, 58 26 Z";

function Avocet() {
  return (
    <g>
      {/* legs, drawn behind the body */}
      <g stroke={PLATE.legBlue} strokeWidth="2.6" strokeLinecap="round" fill="none">
        <path d="M214 140 C211 150, 209 158, 207 168" />
        <path d="M240 141 C242 151, 243 159, 242 168" />
        <path d="M207 168 l-8 4 M242 168 l8 4" />
      </g>

      <clipPath id="clip-avocet">
        <path d={AVOCET} />
      </clipPath>
      <path d={AVOCET} fill={PLATE.white} />

      <g clipPath="url(#clip-avocet)">
        {/* cinnamon over the head and the length of the neck, fading into the breast */}
        <path d="M104 26 C148 16, 180 42, 178 82 C174 104, 164 116, 160 126 L120 120 Z" fill={PLATE.cinnamon} />
        <path d="M146 100 C158 112, 166 122, 170 132 L140 134 Z" fill={PLATE.cinnamonDeep} opacity="0.4" />
        {/* the folded wing: black along the back, a bar of white, then the coverts */}
        <path d="M172 92 C208 82, 258 90, 310 104 C272 118, 212 120, 176 111 Z" fill={PLATE.ink} />
        <path d="M186 122 C220 115, 262 119, 300 128 C264 140, 214 140, 190 132 Z" fill={PLATE.ink} opacity="0.9" />
        {/* the belly, shaded away from the light */}
        <path d="M172 138 C208 150, 256 150, 302 134 L306 160 L168 160 Z" fill={PLATE.shade} opacity="0.6" />
      </g>

      {/* the long upturned bill, and the eye */}
      <path
        d="M130 50 C106 42, 82 32, 54 20"
        stroke={PLATE.ink}
        strokeWidth="2.7"
        strokeLinecap="round"
        fill="none"
      />
      <circle cx="141" cy="49" r="2" fill={PLATE.ink} />
      <ellipse cx="224" cy="174" rx="44" ry="4" fill={PLATE.ink} opacity="0.09" />
    </g>
  );
}

const STILT =
  "M348 60 C372 62, 394 64, 404 66 C402 55, 410 45, 422 45 C434 45, 443 55, 443 68 " +
  "C443 76, 439 82, 433 86 C439 98, 449 108, 463 114 C492 124, 522 126, 548 122 " +
  "C562 119, 572 114, 581 108 C578 123, 570 134, 558 142 C532 157, 494 161, 468 155 " +
  "C447 150, 436 137, 431 121 C427 109, 424 96, 420 86 C414 80, 402 74, 390 70 " +
  "C374 66, 360 62, 348 60 Z";

function Stilt() {
  return (
    <g>
      <g stroke={PLATE.legRed} strokeWidth="2.4" strokeLinecap="round" fill="none">
        <path d="M478 150 C474 162, 471 172, 469 182" />
        <path d="M502 151 C505 163, 506 173, 505 182" />
        <path d="M469 182 l-8 4 M505 182 l8 4" />
      </g>

      <clipPath id="clip-stilt">
        <path d={STILT} />
      </clipPath>
      <path d={STILT} fill={PLATE.white} />

      <g clipPath="url(#clip-stilt)">
        {/* black from the crown over the nape, and the whole of the upperparts */}
        <path d="M408 38 C434 32, 452 54, 446 80 C442 96, 436 106, 432 118 L410 108 C418 88, 416 58, 408 38 Z" fill={PLATE.ink} />
        <path d="M436 106 C474 94, 528 102, 588 118 C544 134, 484 134, 440 122 Z" fill={PLATE.ink} />
        <path d="M438 146 C474 158, 528 156, 580 142 L586 168 L432 168 Z" fill={PLATE.shade} opacity="0.55" />
      </g>

      {/* the needle bill, the eye, and the white spot above it */}
      <path
        d="M406 66 L344 58"
        stroke={PLATE.ink}
        strokeWidth="2.2"
        strokeLinecap="round"
      />
      <circle cx="420" cy="62" r="2" fill={PLATE.ink} />
      <circle cx="416" cy="55" r="2.6" fill={PLATE.white} />
      <ellipse cx="490" cy="188" rx="34" ry="3.5" fill={PLATE.ink} opacity="0.09" />
    </g>
  );
}
