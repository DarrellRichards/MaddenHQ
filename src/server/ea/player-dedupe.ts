import type { EaWeekExport } from "./types";

type ExportPlayer = EaWeekExport["players"][number];

/** Prefer rosterId identity; drop duplicate rows from a single Blaze export. */
export function dedupeExportPlayers(players: ExportPlayer[]): ExportPlayer[] {
  const byKey = new Map<string, ExportPlayer>();
  for (const player of players) {
    const rosterId = player.rosterId?.trim();
    const key = rosterId
      ? `r:${rosterId}`
      : `n:${player.firstName}|${player.lastName}|${player.position}`;
    byKey.set(key, player);
  }
  return [...byKey.values()];
}
