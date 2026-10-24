import type { EaWeekExport } from "./types";
import { StageIndex } from "./constants";

type TeamRow = {
  teamId: number;
  abbrName: string;
  cityName?: string;
  displayName?: string;
  divName?: string;
};

type ScheduleRow = {
  scheduleId: number;
  homeTeamId: number;
  awayTeamId: number;
  homeScore?: number;
  awayScore?: number;
  status?: number;
};

type RosterRow = {
  rosterId?: number;
  firstName?: string;
  lastName?: string;
  position?: string;
  jerseyNum?: number;
  playerBestOvr?: number;
  teamId?: number;
};

function conferenceFromDivision(divName?: string): string | undefined {
  if (!divName) return undefined;
  if (divName.startsWith("AFC")) return "AFC";
  if (divName.startsWith("NFC")) return "NFC";
  return undefined;
}

function divisionShort(divName?: string): string | undefined {
  if (!divName) return undefined;
  return divName.replace(/^AFC\s+/, "").replace(/^NFC\s+/, "");
}

function gameStatus(status?: number): "scheduled" | "final" | "in_progress" {
  // Companion statuses: 1 scheduled-ish, 2/3 completed variants (observed in sample dumps)
  if (status === 2 || status === 3) return "final";
  if (status === 1) return "in_progress";
  return "scheduled";
}

function mergeStatMaps(
  target: Map<string, Record<string, number | string>>,
  rows: Array<Record<string, unknown>> | undefined,
  fieldMap: Record<string, string>,
) {
  if (!rows) return;
  for (const row of rows) {
    const rosterId = row.rosterId != null ? String(row.rosterId) : null;
    if (!rosterId) continue;
    const current = target.get(rosterId) ?? {};
    for (const [source, dest] of Object.entries(fieldMap)) {
      const value = row[source];
      if (typeof value === "number" || typeof value === "string") {
        current[dest] = value;
      }
    }
    if (row.teamId != null) current.teamId = String(row.teamId);
    if (row.scheduleId != null) current.scheduleId = String(row.scheduleId);
    target.set(rosterId, current);
  }
}

export function mapWeekExport(input: {
  leagueId: string;
  seasonYear: number;
  weekNumber: number;
  stageIndex: StageIndex;
  teams: TeamRow[];
  schedules: ScheduleRow[];
  rosters: Array<RosterRow & { teamAbbr?: string }>;
  passing?: Array<Record<string, unknown>>;
  rushing?: Array<Record<string, unknown>>;
  receiving?: Array<Record<string, unknown>>;
  defense?: Array<Record<string, unknown>>;
}): EaWeekExport {
  const teamById = new Map(input.teams.map((team) => [team.teamId, team]));

  const teams = input.teams.map((team) => ({
    abbr: team.abbrName,
    name: team.displayName ?? team.abbrName,
    city: team.cityName,
    conference: conferenceFromDivision(team.divName),
    division: divisionShort(team.divName),
  }));

  const games = input.schedules.map((game) => {
    const home = teamById.get(game.homeTeamId);
    const away = teamById.get(game.awayTeamId);
    return {
      homeAbbr: home?.abbrName ?? String(game.homeTeamId),
      awayAbbr: away?.abbrName ?? String(game.awayTeamId),
      homeScore: game.homeScore,
      awayScore: game.awayScore,
      status: gameStatus(game.status),
    };
  });

  const players = input.rosters
    .filter((player) => player.firstName && player.lastName && player.position)
    .map((player) => ({
      rosterId: player.rosterId != null ? String(player.rosterId) : undefined,
      teamAbbr: player.teamAbbr,
      firstName: player.firstName!,
      lastName: player.lastName!,
      position: player.position!,
      jerseyNumber: player.jerseyNum,
      overall: player.playerBestOvr,
    }));

  const statsByRoster = new Map<string, Record<string, number | string>>();
  mergeStatMaps(statsByRoster, input.passing, {
    passYds: "passYds",
    passTDs: "passTd",
    passInts: "int",
    passAtt: "passAtt",
    passComp: "passComp",
  });
  mergeStatMaps(statsByRoster, input.rushing, {
    rushYds: "rushYds",
    rushTDs: "rushTd",
    rushAtt: "rushAtt",
  });
  mergeStatMaps(statsByRoster, input.receiving, {
    recYds: "recYds",
    recTDs: "recTd",
    receptions: "rec",
  });
  mergeStatMaps(statsByRoster, input.defense, {
    tackles: "tackles",
    sacks: "sacks",
    defInts: "defInt",
    forcedFum: "ff",
  });

  const scheduleById = new Map(input.schedules.map((game) => [game.scheduleId, game]));
  const playerGameStats: EaWeekExport["playerGameStats"] = [];

  for (const [rosterId, stats] of statsByRoster) {
    const scheduleId = Number(stats.scheduleId);
    const teamId = Number(stats.teamId);
    const schedule = scheduleById.get(scheduleId);
    if (!schedule) continue;
    const home = teamById.get(schedule.homeTeamId);
    const away = teamById.get(schedule.awayTeamId);
    if (!home || !away) continue;

    const homeOrAway = teamId === schedule.homeTeamId ? "home" : "away";
    const cleanStats = { ...stats };
    delete cleanStats.teamId;
    delete cleanStats.scheduleId;
    playerGameStats.push({
      playerKey: rosterId,
      homeOrAway,
      homeAbbr: home.abbrName,
      awayAbbr: away.abbrName,
      stats: cleanStats,
    });
  }

  return {
    leagueId: input.leagueId,
    seasonYear: input.seasonYear,
    weekNumber: input.weekNumber,
    teams,
    games,
    players,
    playerGameStats,
  };
}
