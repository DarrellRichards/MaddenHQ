import { prisma } from "@/lib/prisma";
import { decryptSecret } from "@/lib/crypto";
import { getEaClient } from "./index";
import type { EaWeekExport } from "./types";

async function upsertExport(leagueId: string, data: EaWeekExport) {
  const season = await prisma.season.upsert({
    where: { leagueId_year: { leagueId, year: data.seasonYear } },
    create: {
      leagueId,
      year: data.seasonYear,
      label: `${data.seasonYear} Season`,
      isCurrent: true,
    },
    update: { isCurrent: true },
  });

  const week = await prisma.week.upsert({
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
    const row = await prisma.team.upsert({
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
    const teamId = player.teamAbbr ? teamByAbbr.get(player.teamAbbr) : undefined;
    const existing = player.rosterId
      ? await prisma.player.findFirst({
          where: { leagueId, rosterId: player.rosterId },
        })
      : await prisma.player.findFirst({
          where: {
            leagueId,
            firstName: player.firstName,
            lastName: player.lastName,
            position: player.position,
          },
        });

    const row = existing
      ? await prisma.player.update({
          where: { id: existing.id },
          data: {
            teamId,
            overall: player.overall,
            jerseyNumber: player.jerseyNumber,
            rosterId: player.rosterId ?? existing.rosterId,
          },
        })
      : await prisma.player.create({
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

    const existing = await prisma.game.findFirst({
      where: { weekId: week.id, homeTeamId, awayTeamId },
    });

    const gameRow = existing
      ? await prisma.game.update({
          where: { id: existing.id },
          data: {
            homeScore: game.homeScore,
            awayScore: game.awayScore,
            status: game.status,
          },
        })
      : await prisma.game.create({
          data: {
            seasonId: season.id,
            weekId: week.id,
            homeTeamId,
            awayTeamId,
            homeScore: game.homeScore,
            awayScore: game.awayScore,
            status: game.status,
          },
        });

    for (const stat of data.playerGameStats) {
      if (stat.homeAbbr !== game.homeAbbr || stat.awayAbbr !== game.awayAbbr) continue;
      const playerId = playerByKey.get(stat.playerKey);
      if (!playerId) continue;

      await prisma.playerGameStat.upsert({
        where: { gameId_playerId: { gameId: gameRow.id, playerId } },
        create: {
          gameId: gameRow.id,
          playerId,
          teamId:
            stat.homeOrAway === "home"
              ? homeTeamId
              : awayTeamId,
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
    for (const weekExport of exports) {
      await upsertExport(leagueId, weekExport);
    }

    await prisma.eaConnection.update({
      where: { id: connection.id },
      data: {
        eaLeagueId,
        lastSyncAt: new Date(),
        lastSyncStatus: "ok",
      },
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
}
