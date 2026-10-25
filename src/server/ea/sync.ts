import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { getEaClient } from "./index";
import { dedupeExportPlayers } from "./player-dedupe";
import type { EaWeekExport } from "./types";

type ExportPlayer = EaWeekExport["players"][number];

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}

async function upsertSyncedPlayer(
  tx: Prisma.TransactionClient,
  leagueId: string,
  player: ExportPlayer,
  teamByAbbr: Map<string, string>,
) {
  const teamId = player.teamAbbr ? (teamByAbbr.get(player.teamAbbr) ?? null) : null;
  const rosterId = player.rosterId?.trim() || null;

  let existing = rosterId
    ? await tx.player.findUnique({
        where: { leagueId_rosterId: { leagueId, rosterId } },
      })
    : null;

  // Reconcile seeded / prior rows that lack rosterId.
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

  // If name match would steal another row's rosterId, keep the rosterId row canonical.
  if (existing && rosterId && existing.rosterId !== rosterId) {
    const byRoster = await tx.player.findUnique({
      where: { leagueId_rosterId: { leagueId, rosterId } },
    });
    if (byRoster) {
      existing = byRoster;
    }
  }

  const data = {
    teamId,
    overall: player.overall,
    jerseyNumber: player.jerseyNumber,
    firstName: player.firstName,
    lastName: player.lastName,
    position: player.position,
    rosterId: rosterId ?? existing?.rosterId ?? null,
  };

  if (existing) {
    return tx.player.update({
      where: { id: existing.id },
      data,
    });
  }

  try {
    return await tx.player.create({
      data: {
        leagueId,
        ...data,
      },
    });
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;

    // Unique race / missed lookup — resolve and update instead of failing the sync.
    const recovered =
      (rosterId
        ? await tx.player.findUnique({
            where: { leagueId_rosterId: { leagueId, rosterId } },
          })
        : null) ??
      (await tx.player.findUnique({
        where: {
          leagueId_firstName_lastName_position: {
            leagueId,
            firstName: player.firstName,
            lastName: player.lastName,
            position: player.position,
          },
        },
      }));

    if (!recovered) throw error;

    // If create lost on rosterId but recovered by name (or vice versa), still update.
    if (
      rosterId &&
      recovered.rosterId &&
      recovered.rosterId !== rosterId
    ) {
      const owner = await tx.player.findUnique({
        where: { leagueId_rosterId: { leagueId, rosterId } },
      });
      if (owner) {
        return tx.player.update({
          where: { id: owner.id },
          data: {
            teamId,
            overall: player.overall,
            jerseyNumber: player.jerseyNumber,
            firstName: player.firstName,
            lastName: player.lastName,
            position: player.position,
          },
        });
      }
    }

    return tx.player.update({
      where: { id: recovered.id },
      data: {
        teamId,
        overall: player.overall,
        jerseyNumber: player.jerseyNumber,
        rosterId: rosterId ?? recovered.rosterId,
        firstName: player.firstName,
        lastName: player.lastName,
        position: player.position,
      },
    });
  }
}

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
  for (const player of dedupeExportPlayers(data.players)) {
    const row = await upsertSyncedPlayer(tx, leagueId, player, teamByAbbr);
    const key =
      (player.rosterId?.trim() || null) ??
      `${player.lastName}|${player.firstName}|${player.position}`;
    playerByKey.set(key, row.id);
    // Stats often key only by rosterId — keep that alias even when name key differs.
    if (player.rosterId?.trim()) {
      playerByKey.set(player.rosterId.trim(), row.id);
    }
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

export type SyncScope = "all" | "week";

export async function syncLeagueFromEa(
  leagueId: string,
  options: { scope?: SyncScope; weekNumber?: number } = {},
) {
  const scope = options.scope ?? "all";
  const connection = await prisma.eaConnection.findUnique({ where: { leagueId } });
  if (!connection) {
    throw new Error("No EA connection for this league");
  }

  return withLeagueSyncLock(leagueId, async () => {
    const client = getEaClient();
    let tokens = {
      accessToken: decryptSecret(connection.accessTokenEncrypted),
      refreshToken: decryptSecret(connection.refreshTokenEncrypted),
      expiresAt: connection.accessTokenExpiresAt ?? undefined,
      console: (connection.console ?? undefined) as
        | "xone"
        | "ps4"
        | "pc"
        | "ps5"
        | "xbsx"
        | "stadia"
        | undefined,
      personaId: connection.personaId ?? undefined,
      blazeId: connection.blazeId ?? undefined,
    };

    // Refresh early so long exportAll runs use a valid access token.
    tokens = {
      ...tokens,
      ...(await client.refreshTokens(tokens)),
    };

    const eaLeagueId = connection.eaLeagueId ?? (await client.listLeagues(tokens))[0]?.id;
    if (!eaLeagueId) {
      throw new Error("Could not resolve EA league id");
    }

    try {
      let exports: EaWeekExport[];
      if (scope === "week") {
        const weekNumber =
          options.weekNumber ??
          (
            await prisma.week.findFirst({
              where: { season: { leagueId, isCurrent: true } },
              orderBy: { number: "desc" },
            })
          )?.number ??
          1;
        exports = [await client.exportWeek(tokens, eaLeagueId, weekNumber)];
      } else {
        exports = await client.exportAll(tokens, eaLeagueId);
      }

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
            accessTokenEncrypted: encryptSecret(tokens.accessToken),
            refreshTokenEncrypted: encryptSecret(tokens.refreshToken),
            accessTokenExpiresAt: tokens.expiresAt,
            blazeId: tokens.blazeId ?? connection.blazeId,
            lastSyncAt: new Date(),
            lastSyncStatus: scope === "week" ? "ok (week)" : "ok",
          },
        });
      });

      return { weeks: exports.length, scope };
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
