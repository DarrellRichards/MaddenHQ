/** Fantasy-style scoring over MaddenHQ `PlayerGameStat.stats` JSON. */

export type StatBag = Record<string, number | string | undefined>;

function num(stats: StatBag, key: string): number {
  const value = stats[key];
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

export function fantasyPoints(stats: StatBag): number {
  return (
    num(stats, "passYds") / 25 +
    num(stats, "passTd") * 4 -
    num(stats, "int") * 2 +
    num(stats, "rushYds") / 10 +
    num(stats, "rushTd") * 6 +
    num(stats, "recYds") / 10 +
    num(stats, "recTd") * 6 +
    num(stats, "rec") * 0.5 +
    num(stats, "sacks") * 4 +
    num(stats, "defInt") * 6 +
    num(stats, "ff") * 4 +
    num(stats, "tackles") * 0.5
  );
}

export function summarizeStats(stats: StatBag): string {
  const parts: string[] = [];
  if (num(stats, "passYds") || num(stats, "passTd")) {
    parts.push(
      `${num(stats, "passComp")}/${num(stats, "passAtt")}, ${num(stats, "passYds")} pass yds, ${num(stats, "passTd")} TD, ${num(stats, "int")} INT`,
    );
  }
  if (num(stats, "rushYds") || num(stats, "rushTd")) {
    parts.push(
      `${num(stats, "rushAtt")} rush, ${num(stats, "rushYds")} yds, ${num(stats, "rushTd")} TD`,
    );
  }
  if (num(stats, "rec") || num(stats, "recYds") || num(stats, "recTd")) {
    parts.push(
      `${num(stats, "rec")} rec, ${num(stats, "recYds")} yds, ${num(stats, "recTd")} TD`,
    );
  }
  if (num(stats, "tackles") || num(stats, "sacks") || num(stats, "defInt") || num(stats, "ff")) {
    parts.push(
      `${num(stats, "tackles")} tkl, ${num(stats, "sacks")} sk, ${num(stats, "defInt")} INT, ${num(stats, "ff")} FF`,
    );
  }
  return parts.join(" · ") || "No counting stats";
}

const OFFENSE_POSITIONS = new Set([
  "QB",
  "HB",
  "FB",
  "WR",
  "TE",
  "LT",
  "LG",
  "C",
  "RG",
  "RT",
]);

const DEFENSE_POSITIONS = new Set([
  "LE",
  "RE",
  "DT",
  "LOLB",
  "MLB",
  "ROLB",
  "CB",
  "FS",
  "SS",
  "DB",
  "LB",
  "DE",
  "NT",
]);

export function isOffensePosition(position: string): boolean {
  return OFFENSE_POSITIONS.has(position.toUpperCase());
}

export function isDefensePosition(position: string): boolean {
  return DEFENSE_POSITIONS.has(position.toUpperCase());
}
