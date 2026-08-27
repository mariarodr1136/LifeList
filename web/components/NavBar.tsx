"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useSyncExternalStore } from "react";
import { Icon } from "@/components/Icon";

/*
  The navigation, as a bar under the masthead rather than a rail beside it.

  It sticks to the top on its own (h-12), which every in-page rail and toolbar is
  offset against -- see the top-12 in LifeList, Checklist, Places and Review. On a
  narrow screen the tabs scroll sideways instead of collapsing into a drawer: five
  items do not need a menu.
*/

const NAV = [
  { href: "/overview", label: "Overview", icon: "chart" },
  { href: "/", label: "Life List", icon: "bird" },
  { href: "/checklist", label: "Checklist", icon: "check" },
  { href: "/places", label: "Places", icon: "pin" },
  { href: "/review", label: "Review", icon: "flag" },
] as const;

export default function NavBar() {
  const pathname = usePathname();

  return (
    <nav className="sticky top-0 z-40 flex h-12 items-center gap-1 border-b border-line bg-surface/95 px-3 backdrop-blur sm:px-6">
      <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto scroll-thin">
        {NAV.map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={`flex shrink-0 items-center gap-2 rounded-lg px-2.5 py-1.5 text-[0.8125rem] font-medium no-underline transition-colors ${
                active
                  ? "bg-accent-soft text-accent"
                  : "text-fg-muted hover:bg-surface-muted hover:text-fg"
              }`}
            >
              <Icon name={item.icon} className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          );
        })}
      </div>

      <ThemeToggle />
    </nav>
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
    <div
      className="ml-2 flex shrink-0 rounded-lg border border-line p-0.5"
      role="group"
      aria-label="Theme"
    >
      {(["light", "dark"] as const).map((t) => (
        <button
          key={t}
          onClick={() => set(t)}
          aria-pressed={theme === t}
          aria-label={`${t} theme`}
          className={`flex items-center justify-center rounded-[6px] p-1.5 transition-colors ${
            theme === t ? "bg-surface-muted text-fg" : "text-fg-subtle hover:text-fg-muted"
          }`}
        >
          <Icon name={t === "light" ? "sun" : "moon"} className="h-3.5 w-3.5" />
        </button>
      ))}
    </div>
  );
}
