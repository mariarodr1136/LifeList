import type { Metadata } from "next";
import { Inter, Newsreader } from "next/font/google";
import Sidebar from "@/components/Sidebar";
import { getJournal } from "@/lib/data";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

// A serif for the two places that want one: scientific names and the owner's own
// field notes, which should read as quoted writing rather than interface text.
const newsreader = Newsreader({
  variable: "--font-newsreader",
  subsets: ["latin"],
  style: ["normal", "italic"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "A Life List — Birds of North America",
  description:
    "A hand-annotated Golden Guide, read page by page: 449 species recorded across 148 places between 1912 and 1995.",
};

// Applied before first paint so a stored theme choice never flashes the other one.
const THEME_BOOT = `try{var t=localStorage.getItem("lifelist-theme");if(t==="dark"||t==="light")document.documentElement.dataset.theme=t}catch(e){}`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const { meta } = getJournal();

  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOT }} />
      </head>
      <body className={`${inter.variable} ${newsreader.variable} min-h-screen`}>
        <Sidebar meta={meta} />
        <div className="flex min-h-screen flex-col lg:pl-[268px]">{children}</div>
      </body>
    </html>
  );
}
