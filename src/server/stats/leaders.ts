import { fantasyPoints, statNumber, type StatBag } from "./fantasy";

export type LeaderCategory = "passing" | "rushing" | "receiving" | "defense" | "fantasy";

export type LeaderStatRow = {
  playerId: string;
  firstName: string;
  lastName: string;
  position: string;
  teamAbbr: string | null;
  stats: StatBag;
};

export type LeaderEntry = {
  playerId: string;
  name: string;
  position: string;
  teamAbbr: string | null;
  primary: number;
  secondary: number;
  tertiary: number;
  games: number;
};

export type LeaderColumn = {
  key: "primary" | "secondary" | "tertiary";
  label: string;
};

export const LEADER_CATEGORIES: Array<{
  id: LeaderCategory;
  label: string;
  columns: LeaderColumn[];
}> = [
  {
    id: "passing",
    label: "Passing",
    columns: [
      { key: "primary", label: "Yds" },
      { key: "secondary", label: "TD" },
      { key: "tertiary", label: "INT" },
    ],
  },
  {
    id: "rushing",
    label: "Rushing",
    columns: [
      { key: "primary", label: "Yds" },
      { key: "secondary", label: "TD" },
      { key: "tertiary", label: "Att" },
    ],
  },
  {
    id: "receiving",
    label: "Receiving",
    columns: [
      { key: "primary", label: "Yds" },
      { key: "secondary", label: "TD" },
      { key: "tertiary", label: "Rec" },
    ],
  },
  {
    id: "defense",
    label: "Defense",
    columns: [
      { key: "primary", label: "Tkl" },
      { key: "secondary", label: "Sacks" },
      { key: "tertiary", label: "INT" },
    ],
  },
  {
    id: "fantasy",
    label: "Fantasy",
    columns: [
      { key: "primary", label: "Pts" },
      { key: "secondary", label: "G" },
      { key: "tertiary", label: "PPG" },
    ],
  },
];

function metricsForCategory(
  category: LeaderCategory,
  totals: StatBag,
  games: number,
): { primary: number; secondary: number; tertiary: number } | null {
  switch (category) {
    case "passing": {
      const yds = statNumber(totals, "passYds");
      if (yds <= 0 && statNumber(totals, "passTd") <= 0) return null;
      return {
        primary: yds,
        secondary: statNumber(totals, "passTd"),
        tertiary: statNumber(totals, "int"),
      };
    }
    case "rushing": {
      const yds = statNumber(totals, "rushYds");
      if (yds <= 0 && statNumber(totals, "rushTd") <= 0) return null;
      return {
        primary: yds,
        secondary: statNumber(totals, "rushTd"),
        tertiary: statNumber(totals, "rushAtt"),
      };
    }
    case "receiving": {
      const yds = statNumber(totals, "recYds");
      if (yds <= 0 && statNumber(totals, "rec") <= 0) return null;
      return {
        primary: yds,
        secondary: statNumber(totals, "recTd"),
        tertiary: statNumber(totals, "rec"),
      };
    }
    case "defense": {
      const tkl = statNumber(totals, "tackles");
      const sacks = statNumber(totals, "sacks");
      const defInt = statNumber(totals, "defInt");
      if (tkl <= 0 && sacks <= 0 && defInt <= 0) return null;
      return { primary: tkl, secondary: sacks, tertiary: defInt };
    }
    case "fantasy": {
      const pts = fantasyPoints(totals);
      if (pts <= 0) return null;
      return {
        primary: Number(pts.toFixed(1)),
        secondary: games,
        tertiary: games > 0 ? Number((pts / games).toFixed(1)) : 0,
      };
    }
  }
}

function asStatBag(value: unknown): StatBag {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as StatBag;
  }
  return {};
}

/**
 * Aggregate per-player counting stats and rank by category primary metric.
 */
export function computeLeaders(
  rows: LeaderStatRow[],
  category: LeaderCategory,
  limit = 25,
): LeaderEntry[] {
  type Agg = {
    playerId: string;
    firstName: string;
    lastName: string;
    position: string;
    teamAbbr: string | null;
    totals: StatBag;
    games: number;
  };

  const byPlayer = new Map<string, Agg>();
  for (const row of rows) {
    const stats = asStatBag(row.stats);
    const existing = byPlayer.get(row.playerId);
    if (!existing) {
      byPlayer.set(row.playerId, {
        playerId: row.playerId,
        firstName: row.firstName,
        lastName: row.lastName,
        position: row.position,
        teamAbbr: row.teamAbbr,
        totals: { ...stats },
        games: 1,
      });
      continue;
    }
    existing.games += 1;
    for (const [key, value] of Object.entries(stats)) {
      if (typeof value !== "number" || !Number.isFinite(value)) continue;
      const prev = existing.totals[key];
      existing.totals[key] =
        typeof prev === "number" ? prev + value : value;
    }
  }

  const leaders: LeaderEntry[] = [];
  for (const agg of byPlayer.values()) {
    const metrics = metricsForCategory(category, agg.totals, agg.games);
    if (!metrics) continue;
    leaders.push({
      playerId: agg.playerId,
      name: `${agg.firstName} ${agg.lastName}`,
      position: agg.position,
      teamAbbr: agg.teamAbbr,
      games: agg.games,
      ...metrics,
    });
  }

  return leaders
    .sort((a, b) => b.primary - a.primary || b.secondary - a.secondary)
    .slice(0, limit);
}

export function parseLeaderCategory(value: string | undefined): LeaderCategory {
  const allowed: LeaderCategory[] = [
    "passing",
    "rushing",
    "receiving",
    "defense",
    "fantasy",
  ];
  if (value && (allowed as string[]).includes(value)) {
    return value as LeaderCategory;
  }
  return "passing";
}
