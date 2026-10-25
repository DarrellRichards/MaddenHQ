import { prisma } from "@/lib/prisma";
import {
  computeLeaders,
  parseLeaderCategory,
  type LeaderCategory,
  type LeaderStatRow,
} from "./leaders";
import type { StatBag } from "./fantasy";

function asStatBag(value: unknown): StatBag {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as StatBag;
  }
  return {};
}

export async function getCurrentSeason(leagueId: string) {
  return prisma.season.findFirst({
    where: { leagueId, isCurrent: true },
    include: { weeks: { orderBy: { number: "asc" } } },
  });
}

export async function getSeasonGames(seasonId: string, weekId?: string) {
  return prisma.game.findMany({
    where: {
      seasonId,
      ...(weekId ? { weekId } : {}),
    },
    include: {
      homeTeam: true,
      awayTeam: true,
      week: true,
    },
    orderBy: [{ week: { number: "asc" } }, { createdAt: "asc" }],
  });
}

export async function getGameBoxScore(gameId: string, leagueId: string) {
  const game = await prisma.game.findFirst({
    where: { id: gameId, season: { leagueId } },
    include: {
      homeTeam: true,
      awayTeam: true,
      week: true,
      season: true,
      playerStats: {
        include: {
          player: { include: { team: true } },
        },
        orderBy: { player: { lastName: "asc" } },
      },
    },
  });
  return game;
}

export async function getLeaderRows(input: {
  leagueId: string;
  seasonId: string;
  weekId?: string;
}): Promise<LeaderStatRow[]> {
  const stats = await prisma.playerGameStat.findMany({
    where: {
      game: {
        seasonId: input.seasonId,
        ...(input.weekId ? { weekId: input.weekId } : {}),
      },
      player: { leagueId: input.leagueId },
    },
    include: {
      player: { include: { team: true } },
    },
  });

  return stats.map((row) => ({
    playerId: row.playerId,
    firstName: row.player.firstName,
    lastName: row.player.lastName,
    position: row.player.position,
    teamAbbr: row.player.team?.abbr ?? null,
    stats: asStatBag(row.stats),
  }));
}

export async function getCategoryLeaders(input: {
  leagueId: string;
  seasonId: string;
  weekId?: string;
  category?: string;
  limit?: number;
}) {
  const category: LeaderCategory = parseLeaderCategory(input.category);
  const rows = await getLeaderRows({
    leagueId: input.leagueId,
    seasonId: input.seasonId,
    weekId: input.weekId,
  });
  return {
    category,
    leaders: computeLeaders(rows, category, input.limit ?? 25),
  };
}
