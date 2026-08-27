"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore, useState } from "react";
import { Icon } from "@/components/Icon";
import type { Journal } from "@/lib/types";

type Props = { meta: Journal["meta"] };

const NAV = [
  { href: "/overview", label: "Overview", icon: "chart", hint: "The numbers" },
  { href: "/", label: "Life List", icon: "bird", hint: "Species recorded" },
  { href: "/checklist", label: "Checklist", icon: "check", hint: "Every printed bird" },
  { href: "/places", label: "Places", icon: "pin", hint: "Where he went" },
  { href: "/review", label: "Review", icon: "flag", hint: "Needs a human eye" },
] as const;

export default function Sidebar({ meta }: Props) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const close = () => setOpen(false);

  const nav = (
    <nav className="flex flex-col gap-0.5">
      {NAV.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            onClick={close}
            className={`group flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-[0.8125rem] font-medium no-underline transition-colors ${
              active
                ? "bg-accent-soft text-accent"
                : "text-fg-muted hover:bg-surface-muted hover:text-fg"
            }`}
          >
            <Icon name={item.icon} className="h-4 w-4 shrink-0" />
            <span>{item.label}</span>
            <span className="ml-auto text-[0.6875rem] font-normal text-fg-subtle opacity-0 transition-opacity group-hover:opacity-100">
              {item.hint}
            </span>
          </Link>
        );
      })}
    </nav>
  );

  const progress = Math.round((meta.speciesRecorded / meta.speciesOnPages) * 100);

  const body = (
    <div className="flex h-full flex-col gap-6 px-4 py-5">
      <Link href="/" onClick={close} className="flex items-center gap-2.5 no-underline">
        <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-accent text-white">
          <Icon name="bird" className="h-[18px] w-[18px]" />
        </span>
        <span className="leading-tight">
          <span className="block text-[0.875rem] font-semibold tracking-[-0.01em] text-fg">
            A Life List
          </span>
          <span className="block text-[0.6875rem] text-fg-subtle">
            Birds of North America
          </span>
        </span>
      </Link>

      {nav}

      <div className="rounded-card border border-line bg-surface-muted/60 p-3">
        <div className="flex items-baseline justify-between">
          <span className="eyebrow text-fg-subtle">Recorded</span>
          <span className="tnum text-[0.6875rem] text-fg-subtle">{progress}%</span>
        </div>
        <p className="mt-1.5 text-[1.375rem] font-semibold leading-none tracking-[-0.02em] text-fg">
          <span className="tnum">{meta.speciesRecorded}</span>
          <span className="ml-1 text-[0.8125rem] font-normal text-fg-subtle">
            of {meta.speciesOnPages.toLocaleString()}
          </span>
        </p>
        <div className="mt-2.5 h-1.5 overflow-hidden rounded-full bg-surface-sunk">
          <div className="h-full rounded-full bg-accent" style={{ width: `${progress}%` }} />
        </div>
        <p className="mt-2 text-[0.6875rem] leading-snug text-fg-subtle">
          {meta.observations} entries · {meta.locations} places · {meta.families} groups
        </p>
      </div>

      <div className="mt-auto flex flex-col gap-3">
        <ThemeToggle />
        <p className="text-[0.6875rem] leading-relaxed text-fg-subtle">
          Robbins, Bruun &amp; Zim · Golden Press.
          <br />
          Annotated by hand, {meta.firstDate?.slice(0, 4)}–{meta.lastDate?.slice(0, 4)}.
        </p>
      </div>
    </div>
  );

  return (
    <>
      {/* Mobile bar. The same nav lives behind it in a slide-over. */}
      <div className="sticky top-0 z-40 flex items-center gap-3 border-b border-line bg-surface/90 px-4 py-2.5 backdrop-blur lg:hidden">
        <button
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label="Toggle navigation"
          className="flex h-8 w-8 items-center justify-center rounded-lg border border-line text-fg-muted"
        >
          <Icon name={open ? "close" : "menu"} className="h-4 w-4" />
        </button>
        <span className="text-[0.8125rem] font-semibold text-fg">A Life List</span>
        <span className="tnum ml-auto text-[0.75rem] text-fg-subtle">
          {meta.speciesRecorded} species
        </span>
      </div>

      {open && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-fg/25"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <aside className="panel-in absolute inset-y-0 left-0 w-[268px] overflow-y-auto border-r border-line bg-surface">
            {body}
          </aside>
        </div>
      )}

      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[268px] border-r border-line bg-surface lg:block">
        {body}
      </aside>
    </>
  );
}

/* ---------------------------------------------------------------- theme */

type Theme = "light" | "dark";

const THEME_EVENT = "lifelist-theme-change";

function readTheme(): Theme {
  const set = document.documentElement.getAttribute("data-theme");
  if (set === "dark" || set === "light") return set;
  return matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function subscribeToTheme(onChange: () => void) {
  const media = matchMedia("(prefers-color-scheme: dark)");
  media.addEventListener("change", onChange);
  window.addEventListener(THEME_EVENT, onChange);
  return () => {
    media.removeEventListener("change", onChange);
    window.removeEventListener(THEME_EVENT, onChange);
  };
}

function ThemeToggle() {
  // The stored choice lives on <html>, and the fallback is the system setting --
  // both of them outside React, so they are read as an external store rather than
  // synchronised into state on mount.
  const theme = useSyncExternalStore(subscribeToTheme, readTheme, () => null);

  const set = (next: Theme) => {
    document.documentElement.setAttribute("data-theme", next);
    localStorage.setItem("lifelist-theme", next);
    window.dispatchEvent(new Event(THEME_EVENT));
  };

  return (
    <div className="flex rounded-lg border border-line p-0.5" role="group" aria-label="Theme">
      {(["light", "dark"] as const).map((t) => (
        <button
          key={t}
          onClick={() => set(t)}
          aria-pressed={theme === t}
          className={`flex flex-1 items-center justify-center gap-1.5 rounded-[6px] px-2 py-1 text-[0.6875rem] font-medium capitalize transition-colors ${
            theme === t ? "bg-surface-muted text-fg" : "text-fg-subtle hover:text-fg-muted"
          }`}
        >
          <Icon name={t === "light" ? "sun" : "moon"} className="h-3.5 w-3.5" />
          {t}
        </button>
      ))}
    </div>
  );
}
