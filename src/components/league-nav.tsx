"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const tabs = [
  { suffix: "", label: "Overview" },
  { suffix: "/standings", label: "Standings" },
  { suffix: "/scores", label: "Scores" },
  { suffix: "/stats", label: "Stats" },
  { suffix: "/trades", label: "Trades" },
  { suffix: "/awards", label: "Awards" },
  { suffix: "/sync", label: "Sync" },
] as const;

export function LeagueNav({ slug }: { slug: string }) {
  const pathname = usePathname();
  const base = `/leagues/${slug}`;

  return (
    <nav className="league-nav" aria-label="League sections">
      {tabs.map((tab) => {
        const href = `${base}${tab.suffix}`;
        const isActive =
          tab.suffix === ""
            ? pathname === base
            : tab.suffix === "/scores"
              ? pathname.startsWith(href) || pathname.startsWith(`${base}/games/`)
              : pathname.startsWith(href);
        return (
          <Link
            key={tab.label}
            href={href}
            className={isActive ? "league-nav__link is-active" : "league-nav__link"}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
