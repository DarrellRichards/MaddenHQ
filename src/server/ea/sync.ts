import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/crypto";
import { getEaClient } from "./index";
import type { EaWeekExport } from "./types";

async function withLeagueSyncLock<T>(
  leagueId: string,
  fn: () => Promise<T>,
): Promise<T> {
  // Serialize syncs per league so concurrent commissioner/CLI runs cannot double-insert.
  await prisma.$executeRaw`SELECT pg_advisory_lock(hashtext(${leagueId}))`;
  try {
    return await fn();
  } finally {
    await prisma.$executeRaw`SELECT pg_advisory_unlock(hashtext(${leagueId}))`;
  }
}

async function upsertExport(
  tx: Prisma.TransactionClient,
  leagueId: string,
  data: EaWeekExport,
  currentSeasonYear: number,
) {
  const season = await tx.season.upsert({
    where: { leagueId_year: { leagueId, year: data.seasonYear } },
    create: {
      leagueId,
      year: data.seasonYear,
      label: `${data.seasonYear} Season`,
      isCurrent: data.seasonYear === currentSeasonYear,
    },
    update: {
      isCurrent: data.seasonYear === currentSeasonYear,
    },
  });

  const week = await tx.week.upsert({
    where: { seasonId_number: { seasonId: season.id, number: data.weekNumber } },
    create: {
      seasonId: season.id,
      number: data.weekNumber,
      label: `Week ${data.weekNumber}`,
    },
    update: {},
  });

  const teamByAbbr = new Map<string, string>();
  for (const team of data.teams) {
    const row = await tx.team.upsert({
      where: { leagueId_abbr: { leagueId, abbr: team.abbr } },
      create: {
        leagueId,
        abbr: team.abbr,
        name: team.name,
        city: team.city,
        conference: team.conference,
        division: team.division,
      },
      update: {
        name: team.name,
        city: team.city,
        conference: team.conference,
        division: team.division,
      },
    });
    teamByAbbr.set(team.abbr, row.id);
  }

  const playerByKey = new Map<string, string>();
  for (const player of data.players) {
    const teamId = player.teamAbbr ? (teamByAbbr.get(player.teamAbbr) ?? null) : null;

    let existing = player.rosterId
      ? await tx.player.findUnique({
          where: {
            leagueId_rosterId: { leagueId, rosterId: player.rosterId },
          },
        })
      : null;

    // Reconcile seeded players that lack rosterId with incoming fixture/export rows.
    if (!existing) {
      existing = await tx.player.findUnique({
        where: {
          leagueId_firstName_lastName_position: {
            leagueId,
            firstName: player.firstName,
            lastName: player.lastName,
            position: player.position,
          },
        },
      });
    }

    const row = existing
      ? await tx.player.update({
          where: { id: existing.id },
          data: {
            teamId,
            overall: player.overall,
            jerseyNumber: player.jerseyNumber,
            rosterId: player.rosterId ?? existing.rosterId,
          },
        })
      : await tx.player.create({
          data: {
            leagueId,
            teamId,
            rosterId: player.rosterId,
            firstName: player.firstName,
            lastName: player.lastName,
            position: player.position,
            jerseyNumber: player.jerseyNumber,
            overall: player.overall,
          },
        });

    const key = player.rosterId ?? `${player.lastName}|${player.firstName}|${player.position}`;
    playerByKey.set(key, row.id);
  }

  for (const game of data.games) {
    const homeTeamId = teamByAbbr.get(game.homeAbbr);
    const awayTeamId = teamByAbbr.get(game.awayAbbr);
    if (!homeTeamId || !awayTeamId) continue;

    const gameRow = await tx.game.upsert({
      where: {
        weekId_homeTeamId_awayTeamId: {
          weekId: week.id,
          homeTeamId,
          awayTeamId,
        },
      },
      create: {
        seasonId: season.id,
        weekId: week.id,
        homeTeamId,
        awayTeamId,
        homeScore: game.homeScore,
        awayScore: game.awayScore,
        status: game.status,
      },
      update: {
        homeScore: game.homeScore,
        awayScore: game.awayScore,
        status: game.status,
      },
    });

    for (const stat of data.playerGameStats) {
      if (stat.homeAbbr !== game.homeAbbr || stat.awayAbbr !== game.awayAbbr) continue;
      const playerId = playerByKey.get(stat.playerKey);
      if (!playerId) continue;

      await tx.playerGameStat.upsert({
        where: { gameId_playerId: { gameId: gameRow.id, playerId } },
        create: {
          gameId: gameRow.id,
          playerId,
          teamId: stat.homeOrAway === "home" ? homeTeamId : awayTeamId,
          stats: stat.stats,
        },
        update: { stats: stat.stats },
      });
    }
  }

  return { seasonId: season.id, weekId: week.id };
}

export async function syncLeagueFromEa(leagueId: string) {
  const connection = await prisma.eaConnection.findUnique({ where: { leagueId } });
  if (!connection) {
    throw new Error("No EA connection for this league");
  }

  return withLeagueSyncLock(leagueId, async () => {
    const client = getEaClient();
    const tokens = {
      accessToken: decryptSecret(connection.accessTokenEncrypted),
      refreshToken: decryptSecret(connection.refreshTokenEncrypted),
      expiresAt: connection.accessTokenExpiresAt ?? undefined,
    };

    const eaLeagueId = connection.eaLeagueId ?? (await client.listLeagues(tokens))[0]?.id;
    if (!eaLeagueId) {
      throw new Error("Could not resolve EA league id");
    }

    try {
      const exports = await client.exportAll(tokens, eaLeagueId);
      const currentSeasonYear =
        exports.length > 0
          ? Math.max(...exports.map((weekExport) => weekExport.seasonYear))
          : new Date().getFullYear();

      await prisma.$transaction(async (tx) => {
        // Clear current flags first so only the chosen season remains current.
        await tx.season.updateMany({
          where: { leagueId, isCurrent: true },
          data: { isCurrent: false },
        });

        for (const weekExport of exports) {
          await upsertExport(tx, leagueId, weekExport, currentSeasonYear);
        }

        await tx.eaConnection.update({
          where: { id: connection.id },
          data: {
            eaLeagueId,
            lastSyncAt: new Date(),
            lastSyncStatus: "ok",
          },
        });
      });

      return { weeks: exports.length };
    } catch (error) {
      await prisma.eaConnection.update({
        where: { id: connection.id },
        data: {
          lastSyncAt: new Date(),
          lastSyncStatus: error instanceof Error ? error.message : "error",
        },
      });
      throw error;
    }
  });
}
