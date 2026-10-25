import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { getEaClient } from "./index";
import { dedupeExportPlayers } from "./player-dedupe";
import type { EaWeekExport } from "./types";

type ExportPlayer = EaWeekExport["players"][number];
type DbClient = Prisma.TransactionClient | typeof prisma;

const SYNC_TX_OPTIONS = {
  // Full rosters are large; default 5s interactive tx times out and later
  // findFirst/update calls fail with opaque "Invalid invocation" errors.
  maxWait: 15_000,
  timeout: 180_000,
} as const;

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: string }).code === "P2002"
  );
}

function asOptionalInt(value: unknown): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(n)) return null;
  return Math.trunc(n);
}

async function findPlayerByRosterId(
  db: DbClient,
  leagueId: string,
  rosterId: string,
) {
  return db.player.findFirst({
    where: {
      leagueId: String(leagueId),
      rosterId: String(rosterId),
    },
  });
}

async function findPlayerByName(
  db: DbClient,
  leagueId: string,
  firstName: string,
  lastName: string,
  position: string,
) {
  return db.player.findFirst({
    where: {
      leagueId: String(leagueId),
      firstName: String(firstName),
      lastName: String(lastName),
      position: String(position),
    },
  });
}

async function upsertSyncedPlayer(
  db: DbClient,
  leagueId: string,
  player: ExportPlayer,
  teamByAbbr: Map<string, string>,
) {
  const firstName = player.firstName?.trim() ?? "";
  const lastName = player.lastName?.trim() ?? "";
  const position = player.position?.trim() ?? "";
  if (!firstName || !lastName || !position) {
    return null;
  }

  const teamId = player.teamAbbr ? (teamByAbbr.get(player.teamAbbr) ?? null) : null;
  const rosterId = player.rosterId?.trim() || null;
  const overall = asOptionalInt(player.overall);
  const jerseyNumber = asOptionalInt(player.jerseyNumber);

  let existing = rosterId
    ? await findPlayerByRosterId(db, leagueId, rosterId)
    : null;

  if (!existing) {
    existing = await findPlayerByName(
      db,
      leagueId,
      firstName,
      lastName,
      position,
    );
  }

  if (existing && rosterId && existing.rosterId !== rosterId) {
    const byRoster = await findPlayerByRosterId(db, leagueId, rosterId);
    if (byRoster) {
      existing = byRoster;
    }
  }

  const data = {
    teamId,
    overall,
    jerseyNumber,
    firstName,
    lastName,
    position,
    rosterId: rosterId ?? existing?.rosterId ?? null,
  };

  if (existing) {
    return db.player.update({
      where: { id: existing.id },
      data,
    });
  }

  try {
    return await db.player.create({
      data: {
        leagueId,
        ...data,
      },
    });
  } catch (error) {
    if (!isUniqueViolation(error)) throw error;

    const recovered =
      (rosterId
        ? await findPlayerByRosterId(db, leagueId, rosterId)
        : null) ??
      (await findPlayerByName(db, leagueId, firstName, lastName, position));

    if (!recovered) throw error;

    if (rosterId && recovered.rosterId && recovered.rosterId !== rosterId) {
      const owner = await findPlayerByRosterId(db, leagueId, rosterId);
      if (owner) {
        return db.player.update({
          where: { id: owner.id },
          data: {
            teamId,
            overall,
            jerseyNumber,
            firstName,
            lastName,
            position,
          },
        });
      }
    }

    return db.player.update({
      where: { id: recovered.id },
      data: {
        teamId,
        overall,
        jerseyNumber,
        rosterId: rosterId ?? recovered.rosterId,
        firstName,
        lastName,
        position,
      },
    });
  }
}

async function withLeagueSyncLock<T>(
  leagueId: string,
  fn: () => Promise<T>,
): Promise<T> {
  await prisma.$executeRaw`SELECT pg_advisory_lock(hashtext(${leagueId}))`;
  try {
    return await fn();
  } finally {
    await prisma.$executeRaw`SELECT pg_advisory_unlock(hashtext(${leagueId}))`;
  }
}

async function upsertTeams(
  db: DbClient,
  leagueId: string,
  teams: EaWeekExport["teams"],
) {
  const teamByAbbr = new Map<string, string>();
  for (const team of teams) {
    const abbr = team.abbr?.trim();
    if (!abbr) continue;
    const row = await db.team.upsert({
      where: { leagueId_abbr: { leagueId, abbr } },
      create: {
        leagueId,
        abbr,
        name: team.name || abbr,
        city: team.city,
        conference: team.conference,
        division: team.division,
      },
      update: {
        name: team.name || abbr,
        city: team.city,
        conference: team.conference,
        division: team.division,
      },
    });
    teamByAbbr.set(abbr, row.id);
  }
  return teamByAbbr;
}

async function upsertPlayers(
  db: DbClient,
  leagueId: string,
  players: ExportPlayer[],
  teamByAbbr: Map<string, string>,
) {
  const playerByKey = new Map<string, string>();
  for (const player of dedupeExportPlayers(players)) {
    const row = await upsertSyncedPlayer(db, leagueId, player, teamByAbbr);
    if (!row) continue;
    const rosterId = player.rosterId?.trim() || null;
    const key =
      rosterId ?? `${player.lastName}|${player.firstName}|${player.position}`;
    playerByKey.set(key, row.id);
    if (rosterId) {
      playerByKey.set(rosterId, row.id);
    }
  }
  return playerByKey;
}

async function loadPlayerKeyMap(leagueId: string) {
  const rows = await prisma.player.findMany({
    where: { leagueId },
    select: {
      id: true,
      rosterId: true,
      firstName: true,
      lastName: true,
      position: true,
    },
  });
  const playerByKey = new Map<string, string>();
  for (const row of rows) {
    if (row.rosterId) playerByKey.set(row.rosterId, row.id);
    playerByKey.set(
      `${row.lastName}|${row.firstName}|${row.position}`,
      row.id,
    );
  }
  return playerByKey;
}

async function upsertWeekGames(
  db: DbClient,
  seasonId: string,
  weekId: string,
  data: EaWeekExport,
  teamByAbbr: Map<string, string>,
  playerByKey: Map<string, string>,
) {
  for (const game of data.games) {
    const homeTeamId = teamByAbbr.get(game.homeAbbr);
    const awayTeamId = teamByAbbr.get(game.awayAbbr);
    if (!homeTeamId || !awayTeamId) continue;

    const gameRow = await db.game.upsert({
      where: {
        weekId_homeTeamId_awayTeamId: {
          weekId,
          homeTeamId,
          awayTeamId,
        },
      },
      create: {
        seasonId,
        weekId,
        homeTeamId,
        awayTeamId,
        homeScore: asOptionalInt(game.homeScore),
        awayScore: asOptionalInt(game.awayScore),
        status: game.status,
      },
      update: {
        homeScore: asOptionalInt(game.homeScore),
        awayScore: asOptionalInt(game.awayScore),
        status: game.status,
      },
    });

    for (const stat of data.playerGameStats) {
      if (stat.homeAbbr !== game.homeAbbr || stat.awayAbbr !== game.awayAbbr) {
        continue;
      }
      const playerId = playerByKey.get(stat.playerKey);
      if (!playerId) continue;

      await db.playerGameStat.upsert({
        where: { gameId_playerId: { gameId: gameRow.id, playerId } },
        create: {
          gameId: gameRow.id,
          playerId,
          teamId: stat.homeOrAway === "home" ? homeTeamId : awayTeamId,
          stats: stat.stats as Prisma.InputJsonValue,
        },
        update: { stats: stat.stats as Prisma.InputJsonValue },
      });
    }
  }
}

async function upsertSeasonAndWeek(
  db: DbClient,
  leagueId: string,
  data: EaWeekExport,
  currentSeasonYear: number,
) {
  const season = await db.season.upsert({
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

  const week = await db.week.upsert({
    where: { seasonId_number: { seasonId: season.id, number: data.weekNumber } },
    create: {
      seasonId: season.id,
      number: data.weekNumber,
      label: `Week ${data.weekNumber}`,
    },
    update: {},
  });

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

      // Clear current season flags once up front (outside per-week txs).
      await prisma.season.updateMany({
        where: { leagueId, isCurrent: true },
        data: { isCurrent: false },
      });

      // Teams + players once from the richest roster snapshot (first export).
      // Re-running this inside every week blew past Prisma's interactive tx timeout.
      const rosterSource = exports[0];
      if (rosterSource) {
        await prisma.$transaction(async (tx) => {
          const teamByAbbr = await upsertTeams(tx, leagueId, rosterSource.teams);
          await upsertPlayers(tx, leagueId, rosterSource.players, teamByAbbr);
        }, SYNC_TX_OPTIONS);
      }

      const teamRows = await prisma.team.findMany({
        where: { leagueId },
        select: { id: true, abbr: true },
      });
      const teamByAbbr = new Map(teamRows.map((team) => [team.abbr, team.id]));
      const playerByKey = await loadPlayerKeyMap(leagueId);

      for (const weekExport of exports) {
        await prisma.$transaction(async (tx) => {
          const { seasonId, weekId } = await upsertSeasonAndWeek(
            tx,
            leagueId,
            weekExport,
            currentSeasonYear,
          );
          await upsertWeekGames(
            tx,
            seasonId,
            weekId,
            weekExport,
            teamByAbbr,
            playerByKey,
          );
        }, SYNC_TX_OPTIONS);
      }

      await prisma.eaConnection.update({
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

      return { weeks: exports.length, scope };
    } catch (error) {
      await prisma.eaConnection.update({
        where: { id: connection.id },
        data: {
          lastSyncAt: new Date(),
          lastSyncStatus: error instanceof Error ? error.message.slice(0, 500) : "error",
        },
      });
      throw error;
    }
  });
}
