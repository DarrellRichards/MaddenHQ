import {
  exchangePersonaTokens,
  listPersonasFromCallback,
  refreshAccountToken,
  type EaPersonaOption,
  type EaSessionTokens,
} from "./auth";
import {
  StageIndex,
  createBlazeSession,
  ensureFreshTokens,
  exportDefense,
  exportFreeAgents,
  exportPassing,
  exportReceiving,
  exportRushing,
  exportSchedules,
  exportTeamRoster,
  exportTeams,
  getLeagueHub,
  getMyLeagues,
  type BlazeSession,
} from "./blaze";
import { getEaLoginUrl } from "./constants";
import { mapWeekExport } from "./map-export";
import type { EaClient, EaLeagueSummary, EaTokens, EaWeekExport } from "./types";

type LeagueHub = Awaited<ReturnType<typeof getLeagueHub>>;

type TeamRow = {
  teamId: number;
  abbrName: string;
  cityName?: string;
  displayName?: string;
  divName?: string;
};

type RosterRow = {
  rosterId?: number;
  firstName?: string;
  lastName?: string;
  position?: string;
  jerseyNum?: number;
  playerBestOvr?: number;
  teamAbbr?: string;
};

function toSessionTokens(tokens: EaTokens): EaSessionTokens {
  if (!tokens.console || !tokens.personaId) {
    throw new Error(
      "Live EA client requires console + personaId on stored tokens. Reconnect EA for this league.",
    );
  }
  return {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresAt: tokens.expiresAt ?? new Date(0),
    console: tokens.console,
    personaId: tokens.personaId,
    blazeId: tokens.blazeId,
  };
}

function fromSessionTokens(tokens: EaSessionTokens): EaTokens {
  return {
    accessToken: tokens.accessToken,
    refreshToken: tokens.refreshToken,
    expiresAt: tokens.expiresAt,
    console: tokens.console,
    personaId: tokens.personaId,
    blazeId: tokens.blazeId,
  };
}

async function sleep(ms: number) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Live Madden Companion / Blaze client.
 * Protocol: https://github.com/snallabot/snallabot-service/blob/main/docs/madden/ea_api.md (MIT)
 */
export class LiveEaClient implements EaClient {
  getLoginUrl(): string {
    return getEaLoginUrl();
  }

  async listPersonas(callbackUrl: string): Promise<EaPersonaOption[]> {
    const { personas } = await listPersonasFromCallback(callbackUrl);
    return personas;
  }

  /**
   * Exchange callback URL (+ selected persona) for a durable persona-scoped token pair.
   */
  async exchangeCallbackUrl(
    callbackUrl: string,
    personaId?: string,
  ): Promise<EaTokens> {
    const { tempAccessToken, personas } = await listPersonasFromCallback(callbackUrl);
    const persona =
      (personaId
        ? personas.find((entry) => entry.personaId === personaId)
        : undefined) ?? (personas.length === 1 ? personas[0] : undefined);

    if (!persona) {
      const names = personas.map((entry) => `${entry.displayName} (${entry.console})`).join(", ");
      throw new Error(
        `Multiple Madden personas found — pass personaId. Available: ${names}`,
      );
    }

    const sessionTokens = await exchangePersonaTokens({
      tempAccessToken,
      persona,
    });
    const { tokens } = await createBlazeSession(sessionTokens);
    return fromSessionTokens(tokens);
  }

  async refreshTokens(tokens: EaTokens): Promise<EaTokens> {
    const session = toSessionTokens(tokens);
    const refreshed = await ensureFreshTokens(session);
    // Keep blaze session metadata; refreshAccountToken already applied inside ensureFreshTokens
    if (!refreshed.accessToken) {
      const raw = await refreshAccountToken(session.refreshToken);
      return fromSessionTokens({
        ...session,
        accessToken: raw.access_token,
        refreshToken: raw.refresh_token,
        expiresAt: new Date(Date.now() + raw.expires_in * 1000),
      });
    }
    return fromSessionTokens(refreshed);
  }

  async listLeagues(tokens: EaTokens): Promise<EaLeagueSummary[]> {
    const sessionTokens = toSessionTokens(tokens);
    const { tokens: fresh, session } = await createBlazeSession(sessionTokens);
    const rows = await getMyLeagues(fresh, session);
    return rows.map((league) => ({
      id: String(league.leagueId),
      name: league.leagueName,
      platform: fresh.console,
      seasonText: league.seasonText,
      calendarYear: league.calendarYear,
    }));
  }

  async exportWeek(
    tokens: EaTokens,
    leagueId: string,
    week: number,
  ): Promise<EaWeekExport> {
    const sessionTokens = toSessionTokens(tokens);
    const { tokens: fresh, session } = await createBlazeSession(sessionTokens);
    const hub = await getLeagueHub(fresh, session, Number(leagueId));
    const { teams, rosters } = await this.pullTeamsAndRosters(
      fresh,
      session,
      Number(leagueId),
      hub,
    );
    return this.exportWeekStats(
      fresh,
      session,
      leagueId,
      StageIndex.SEASON,
      week - 1,
      teams,
      rosters,
      hub,
    );
  }

  async exportAll(tokens: EaTokens, leagueId: string): Promise<EaWeekExport[]> {
    const sessionTokens = toSessionTokens(tokens);
    // One Blaze login for the whole sync — EA rate-limits / flakes on login churn.
    const { tokens: fresh, session } = await createBlazeSession(sessionTokens);
    const hub = await getLeagueHub(fresh, session, Number(leagueId));
    const available = hub.responseInfo?.value?.availableWeekInfoList ?? [];
    const seasonYear =
      hub.responseInfo?.value?.careerHubInfo?.seasonInfo?.calendarYear ??
      new Date().getFullYear();

    // Prefer regular-season weeks; fall back to a single current week export.
    const seasonWeeks = available.filter((week) => week.stageIndex === StageIndex.SEASON);
    const weeksToPull =
      seasonWeeks.length > 0
        ? seasonWeeks
        : [
            {
              stageIndex: StageIndex.SEASON,
              weekIndex: Math.max(
                0,
                (hub.responseInfo?.value?.careerHubInfo?.seasonInfo?.seasonWeek ?? 1) - 1,
              ),
            },
          ];

    // Rosters are season-scoped — pull once, reuse for every week.
    // Re-fetching 32 teams × N weeks is what triggers EA ERR_SYSTEM high-load.
    const { teams, rosters } = await this.pullTeamsAndRosters(
      fresh,
      session,
      Number(leagueId),
      hub,
    );

    const exports: EaWeekExport[] = [];
    for (const week of weeksToPull) {
      // Skip Pro Bowl week index 21 when present
      if (week.weekIndex === 21) continue;
      exports.push(
        await this.exportWeekStats(
          fresh,
          session,
          leagueId,
          week.stageIndex as StageIndex,
          week.weekIndex,
          teams,
          rosters,
          hub,
          seasonYear,
        ),
      );
      // Brief pause between weeks to ease EA load.
      await sleep(400);
    }
    return exports;
  }

  private async pullTeamsAndRosters(
    tokens: EaSessionTokens,
    session: BlazeSession,
    numericLeagueId: number,
    hub: LeagueHub,
  ): Promise<{ teams: TeamRow[]; rosters: RosterRow[] }> {
    const teamsPayload = await exportTeams(tokens, session, numericLeagueId);
    const teams = teamsPayload.leagueTeamInfoList ?? [];
    const teamIndexById = new Map(
      (hub.responseInfo?.value?.teamIdInfoList ?? []).map((team) => [
        team.teamId,
        team.teamIndex,
      ]),
    );

    const rosters: RosterRow[] = [];
    const rosterErrors: string[] = [];

    for (let i = 0; i < teams.length; i++) {
      const team = teams[i];
      const listIndex = teamIndexById.get(team.teamId) ?? 0;
      try {
        const roster = await exportTeamRoster(
          tokens,
          session,
          numericLeagueId,
          team.teamId,
          listIndex,
        );
        for (const player of roster.rosterInfoList ?? []) {
          rosters.push({ ...player, teamAbbr: team.abbrName });
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        rosterErrors.push(`${team.abbrName}: ${message.slice(0, 120)}`);
      }
      // Throttle roster pulls — 32 back-to-back calls trip EA high-load.
      if (i < teams.length - 1) {
        await sleep(350);
      }
    }

    try {
      const freeAgents = await exportFreeAgents(tokens, session, numericLeagueId);
      for (const player of freeAgents.rosterInfoList ?? []) {
        rosters.push(player);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      rosterErrors.push(`FA: ${message.slice(0, 120)}`);
    }

    // Fail only if we got almost no roster data — partial leagues are still usable.
    if (rosters.length === 0 && teams.length > 0) {
      throw new Error(
        `Blaze roster export failed for every team. Last errors: ${rosterErrors.slice(0, 3).join(" | ")}`,
      );
    }

    return { teams, rosters };
  }

  private async exportWeekStats(
    tokens: EaSessionTokens,
    session: BlazeSession,
    leagueId: string,
    stageIndex: StageIndex,
    weekIndex: number,
    teams: TeamRow[],
    rosters: RosterRow[],
    hub: LeagueHub,
    seasonYearOverride?: number,
  ): Promise<EaWeekExport> {
    const numericLeagueId = Number(leagueId);
    const seasonYear =
      seasonYearOverride ??
      hub.responseInfo?.value?.careerHubInfo?.seasonInfo?.calendarYear ??
      new Date().getFullYear();

    // Sequential week exports — parallel Promise.all was another high-load trigger.
    const schedules = await exportSchedules(
      tokens,
      session,
      numericLeagueId,
      stageIndex,
      weekIndex,
    );
    await sleep(250);
    const passing = await exportPassing(
      tokens,
      session,
      numericLeagueId,
      stageIndex,
      weekIndex,
    );
    await sleep(250);
    const rushing = await exportRushing(
      tokens,
      session,
      numericLeagueId,
      stageIndex,
      weekIndex,
    );
    await sleep(250);
    const receiving = await exportReceiving(
      tokens,
      session,
      numericLeagueId,
      stageIndex,
      weekIndex,
    );
    await sleep(250);
    const defense = await exportDefense(
      tokens,
      session,
      numericLeagueId,
      stageIndex,
      weekIndex,
    );

    return mapWeekExport({
      leagueId,
      seasonYear,
      weekNumber: weekIndex + 1,
      stageIndex,
      teams,
      schedules: schedules.gameScheduleInfoList ?? [],
      rosters,
      passing: passing.playerPassingStatInfoList,
      rushing: rushing.playerRushingStatInfoList,
      receiving: receiving.playerReceivingStatInfoList,
      defense: defense.playerDefensiveStatInfoList,
    });
  }
}
