"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
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
    </nav>
  );
}
