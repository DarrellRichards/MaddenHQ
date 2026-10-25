import {
  BLAZE_PRODUCT_NAME,
  BLAZE_SERVICE,
  MACHINE_KEY,
  LeagueExportType,
  StageIndex,
  type EaSystemConsole,
} from "./constants";
import { eaFetch, sanitizeJsonText } from "./http";
import { calculateMessageAuth } from "./message-auth";
import type { EaSessionTokens } from "./auth";
import { refreshAccountToken } from "./auth";

export type BlazeSession = {
  blazeId: number;
  sessionKey: string;
  requestId: number;
};

type BlazeLoginResponse = {
  userLoginInfo?: {
    sessionKey?: string;
    personaDetails?: { personaId?: number };
  };
  error?: {
    errorcode?: number;
    errorname?: string;
  };
};

const TRANSIENT_BLAZE_CODES = new Set([
  67606, // MCA_ERR_SERVER_ERROR
  1073807360, // high load / timeout style (ERR_SYSTEM)
]);

const BLAZE_LOGIN_ATTEMPTS = 5;

export function isTransientBlazeCode(code: number | undefined): boolean {
  return code !== undefined && TRANSIENT_BLAZE_CODES.has(code);
}

export class BlazeRpcError extends Error {
  errorcode?: number;
  errorname?: string;

  constructor(message: string, errorcode?: number, errorname?: string) {
    super(message);
    this.name = "BlazeRpcError";
    this.errorcode = errorcode;
    this.errorname = errorname;
  }
}

function blazeHeaders(console: EaSystemConsole) {
  return {
    "Accept-Charset": "UTF-8",
    Accept: "application/json",
    "X-BLAZE-ID": BLAZE_SERVICE[console],
    "X-BLAZE-VOID-RESP": "XML",
    "X-Application-Key": "MADDEN-MCA",
    "Content-Type": "application/json",
    "User-Agent":
      "Dalvik/2.1.0 (Linux; U; Android 13; sdk_gphone_x86_64 Build/TE1A.220922.031)",
  };
}

export async function ensureFreshTokens(
  tokens: EaSessionTokens,
): Promise<EaSessionTokens> {
  if (tokens.expiresAt && tokens.expiresAt.getTime() > Date.now() + 60_000) {
    return tokens;
  }
  const refreshed = await refreshAccountToken(tokens.refreshToken);
  return {
    ...tokens,
    accessToken: refreshed.access_token,
    refreshToken: refreshed.refresh_token,
    expiresAt: new Date(Date.now() + refreshed.expires_in * 1000),
  };
}

export async function createBlazeSession(
  tokens: EaSessionTokens,
): Promise<{ tokens: EaSessionTokens; session: BlazeSession }> {
  let fresh = await ensureFreshTokens(tokens);
  let lastError: unknown;

  for (let attempt = 0; attempt < BLAZE_LOGIN_ATTEMPTS; attempt++) {
    // Refresh once before the final attempts in case the access token aged out mid-retry.
    if (attempt > 0 && attempt % 2 === 0) {
      fresh = await ensureFreshTokens({ ...fresh, expiresAt: new Date(0) });
    }

    try {
      const res = await eaFetch(
        "https://wal2.tools.gos.bio-iad.ea.com/wal/authentication/login",
        {
          blaze: true,
          method: "POST",
          headers: blazeHeaders(fresh.console),
          body: JSON.stringify({
            accessToken: fresh.accessToken,
            productName: BLAZE_PRODUCT_NAME[fresh.console],
          }),
        },
      );
      const text = await res.text();
      let parsed: BlazeLoginResponse;
      try {
        parsed = JSON.parse(sanitizeJsonText(text)) as BlazeLoginResponse;
      } catch {
        throw new Error(`Blaze login failed: ${text.slice(0, 400)}`);
      }

      if (parsed.error?.errorcode || parsed.error?.errorname) {
        const code = parsed.error.errorcode;
        const name = parsed.error.errorname ?? "UNKNOWN";
        if (isTransientBlazeCode(code) && attempt < BLAZE_LOGIN_ATTEMPTS - 1) {
          lastError = new BlazeRpcError(
            `Blaze login transient error (${name}/${code})`,
            code,
            name,
          );
          await new Promise((resolve) =>
            setTimeout(resolve, 1000 * 2 ** attempt),
          );
          continue;
        }
        throw new BlazeRpcError(
          `Blaze login failed (${name}): ${text.slice(0, 400)}`,
          code,
          name,
        );
      }

      const sessionKey = parsed.userLoginInfo?.sessionKey;
      const blazeId = parsed.userLoginInfo?.personaDetails?.personaId;
      if (!sessionKey || !blazeId) {
        // Some transient failures omit a structured error object.
        const looksTransient = /1073807360|ERR_SYSTEM|MCA_ERR_SERVER/i.test(text);
        if ((looksTransient || attempt < 2) && attempt < BLAZE_LOGIN_ATTEMPTS - 1) {
          lastError = new Error(`Blaze login missing session: ${text.slice(0, 400)}`);
          await new Promise((resolve) =>
            setTimeout(resolve, 1000 * 2 ** attempt),
          );
          continue;
        }
        throw new Error(`Blaze login missing session: ${text.slice(0, 400)}`);
      }

      return {
        tokens: { ...fresh, blazeId: String(blazeId) },
        session: { blazeId, sessionKey, requestId: 1 },
      };
    } catch (error) {
      lastError = error;
      const code = error instanceof BlazeRpcError ? error.errorcode : undefined;
      if (isTransientBlazeCode(code) && attempt < BLAZE_LOGIN_ATTEMPTS - 1) {
        await new Promise((resolve) =>
          setTimeout(resolve, 1000 * 2 ** attempt),
        );
        continue;
      }
      if (attempt < BLAZE_LOGIN_ATTEMPTS - 1 && !(error instanceof BlazeRpcError)) {
        // Network / parse flakes — retry a couple times.
        const message = error instanceof Error ? error.message : String(error);
        if (/fetch failed|network|ECONNRESET|ETIMEDOUT|Blaze login failed:/i.test(message)) {
          await new Promise((resolve) =>
            setTimeout(resolve, 1000 * 2 ** attempt),
          );
          continue;
        }
      }
      throw error;
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("Blaze login failed after retries");
}

async function sendProcessRequest<T>(
  tokens: EaSessionTokens,
  session: BlazeSession,
  request: {
    commandName: string;
    componentId: number;
    commandId: number;
    componentName: string;
    requestPayload: Record<string, unknown>;
  },
): Promise<T> {
  const auth = calculateMessageAuth(session.blazeId, session.requestId);
  session.requestId += 1;
  const messageExpiration = Math.floor(Date.now() / 1000);
  const body = {
    apiVersion: 2,
    clientDevice: 3,
    requestInfo: JSON.stringify({
      commandName: request.commandName,
      componentId: request.componentId,
      commandId: request.commandId,
      componentName: request.componentName,
      messageAuthData: auth,
      messageExpirationTime: messageExpiration,
      deviceId: MACHINE_KEY,
      ipAddress: "127.0.0.1",
      requestPayload: JSON.stringify(request.requestPayload),
    }),
  };

  const res = await eaFetch(
    `https://wal2.tools.gos.bio-iad.ea.com/wal/mca/Process/${session.sessionKey}`,
    {
      blaze: true,
      method: "POST",
      headers: blazeHeaders(tokens.console),
      body: JSON.stringify(body),
    },
  );
  const text = sanitizeJsonText(await res.text());
  const parsed = JSON.parse(text) as T & {
    error?: { errorcode?: number; errorname?: string };
  };
  if (parsed && typeof parsed === "object" && "error" in parsed && parsed.error) {
    throw new BlazeRpcError(
      `Blaze RPC error: ${text.slice(0, 500)}`,
      parsed.error.errorcode,
      parsed.error.errorname,
    );
  }
  return parsed as T;
}

async function withBlazeRpcRetry<T>(
  tokens: EaSessionTokens,
  session: BlazeSession,
  run: (active: { tokens: EaSessionTokens; session: BlazeSession }) => Promise<T>,
): Promise<T> {
  let activeTokens = tokens;
  let activeSession = session;
  let lastError: unknown;

  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      return await run({ tokens: activeTokens, session: activeSession });
    } catch (error) {
      lastError = error;
      const code = error instanceof BlazeRpcError ? error.errorcode : undefined;
      if (isTransientBlazeCode(code) && attempt < 2) {
        await new Promise((resolve) => setTimeout(resolve, 750 * 2 ** attempt));
        const refreshed = await createBlazeSession(activeTokens);
        activeTokens = refreshed.tokens;
        activeSession = {
          ...refreshed.session,
          requestId: Math.max(activeSession.requestId, refreshed.session.requestId),
        };
        continue;
      }
      throw error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error("Blaze RPC failed");
}

export async function getMyLeagues(
  tokens: EaSessionTokens,
  session: BlazeSession,
): Promise<
  Array<{
    leagueId: number;
    leagueName: string;
    calendarYear?: number;
    seasonText?: string;
  }>
> {
  // Companion uses franchisemode for league list/hub RPC (not careermode).
  const response = await withBlazeRpcRetry(tokens, session, ({ tokens: t, session: s }) =>
    sendProcessRequest<{
      responseInfo?: {
        value?: {
          leagues?: Array<{
            leagueId: number;
            leagueName: string;
            calendarYear?: number;
            seasonText?: string;
          }>;
        };
      };
    }>(t, s, {
      commandName: "Mobile_GetMyLeagues",
      componentId: 2060,
      commandId: 801,
      componentName: "franchisemode",
      requestPayload: {},
    }),
  );

  return response.responseInfo?.value?.leagues ?? [];
}

export async function getLeagueHub(
  tokens: EaSessionTokens,
  session: BlazeSession,
  leagueId: number,
) {
  return withBlazeRpcRetry(tokens, session, ({ tokens: t, session: s }) =>
    sendProcessRequest<{
      responseInfo?: {
        value?: {
          careerHubInfo?: {
            seasonInfo?: {
              calendarYear?: number;
              seasonWeek?: number;
              seasonWeekType?: number;
            };
          };
          teamIdInfoList?: Array<{
            teamId: number;
            teamIndex: number;
            shortName?: string;
            displayName?: string;
          }>;
          availableWeekInfoList?: Array<{
            stageIndex: number;
            weekIndex: number;
            weekTitle?: string;
          }>;
        };
      };
    }>(t, s, {
      commandName: "Mobile_Career_GetLeagueHub",
      componentId: 2060,
      commandId: 811,
      componentName: "franchisemode",
      requestPayload: { leagueId },
    }),
  );
}

async function getExportData<T>(
  tokens: EaSessionTokens,
  session: BlazeSession,
  exportType: LeagueExportType,
  payload: Record<string, unknown>,
  retries = 5,
): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt < retries; attempt++) {
    const res = await eaFetch(
      `https://wal2.tools.gos.bio-iad.ea.com/wal/mca/${exportType}/${session.sessionKey}`,
      {
        blaze: true,
        method: "POST",
        headers: blazeHeaders(tokens.console),
        body: JSON.stringify(payload),
      },
    );
    const text = sanitizeJsonText(await res.text());
    try {
      const parsed = JSON.parse(text) as T & {
        error?: { errorcode?: number; errorname?: string };
      };
      if (parsed && typeof parsed === "object" && "error" in parsed && parsed.error) {
        const code = parsed.error.errorcode;
        if (isTransientBlazeCode(code) && attempt < retries - 1) {
          await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
          continue;
        }
        throw new Error(`Blaze export error (${exportType}): ${text.slice(0, 400)}`);
      }
      return parsed as T;
    } catch (error) {
      lastError = error;
      if (attempt < retries - 1) {
        await new Promise((r) => setTimeout(r, 1000 * 2 ** attempt));
        continue;
      }
    }
  }
  throw lastError instanceof Error
    ? lastError
    : new Error(`Blaze export failed for ${exportType}`);
}

export async function exportTeams(
  tokens: EaSessionTokens,
  session: BlazeSession,
  leagueId: number,
) {
  return getExportData<{
    leagueTeamInfoList?: Array<{
      teamId: number;
      abbrName: string;
      cityName?: string;
      displayName?: string;
      divName?: string;
    }>;
  }>(tokens, session, LeagueExportType.TEAMS, { leagueId });
}

export async function exportSchedules(
  tokens: EaSessionTokens,
  session: BlazeSession,
  leagueId: number,
  stageIndex: StageIndex,
  weekIndex: number,
) {
  return getExportData<{
    gameScheduleInfoList?: Array<{
      scheduleId: number;
      homeTeamId: number;
      awayTeamId: number;
      homeScore?: number;
      awayScore?: number;
      status?: number;
      weekIndex: number;
      stageIndex: number;
    }>;
  }>(tokens, session, LeagueExportType.WEEKLY_SCHEDULE, {
    leagueId,
    stageIndex,
    weekIndex,
  });
}

export async function exportPassing(
  tokens: EaSessionTokens,
  session: BlazeSession,
  leagueId: number,
  stageIndex: StageIndex,
  weekIndex: number,
) {
  return getExportData<{
    playerPassingStatInfoList?: Array<Record<string, unknown>>;
  }>(tokens, session, LeagueExportType.PASSING_STATS, {
    leagueId,
    stageIndex,
    weekIndex,
  });
}

export async function exportRushing(
  tokens: EaSessionTokens,
  session: BlazeSession,
  leagueId: number,
  stageIndex: StageIndex,
  weekIndex: number,
) {
  return getExportData<{
    playerRushingStatInfoList?: Array<Record<string, unknown>>;
  }>(tokens, session, LeagueExportType.RUSHING_STATS, {
    leagueId,
    stageIndex,
    weekIndex,
  });
}

export async function exportReceiving(
  tokens: EaSessionTokens,
  session: BlazeSession,
  leagueId: number,
  stageIndex: StageIndex,
  weekIndex: number,
) {
  return getExportData<{
    playerReceivingStatInfoList?: Array<Record<string, unknown>>;
  }>(tokens, session, LeagueExportType.RECEIVING_STATS, {
    leagueId,
    stageIndex,
    weekIndex,
  });
}

export async function exportDefense(
  tokens: EaSessionTokens,
  session: BlazeSession,
  leagueId: number,
  stageIndex: StageIndex,
  weekIndex: number,
) {
  return getExportData<{
    playerDefensiveStatInfoList?: Array<Record<string, unknown>>;
  }>(tokens, session, LeagueExportType.DEFENSIVE_STATS, {
    leagueId,
    stageIndex,
    weekIndex,
  });
}

export async function exportTeamRoster(
  tokens: EaSessionTokens,
  session: BlazeSession,
  leagueId: number,
  teamId: number,
  listIndex: number,
) {
  return getExportData<{
    rosterInfoList?: Array<{
      rosterId?: number;
      firstName?: string;
      lastName?: string;
      position?: string;
      jerseyNum?: number;
      playerBestOvr?: number;
      teamId?: number;
    }>;
  }>(tokens, session, LeagueExportType.TEAM_ROSTER, {
    leagueId,
    listIndex,
    returnFreeAgents: false,
    teamId,
  });
}

export async function exportFreeAgents(
  tokens: EaSessionTokens,
  session: BlazeSession,
  leagueId: number,
) {
  return getExportData<{
    rosterInfoList?: Array<{
      rosterId?: number;
      firstName?: string;
      lastName?: string;
      position?: string;
      jerseyNum?: number;
      playerBestOvr?: number;
    }>;
  }>(tokens, session, LeagueExportType.TEAM_ROSTER, {
    leagueId,
    listIndex: -1,
    returnFreeAgents: true,
    teamId: 0,
  });
}

export { StageIndex };
