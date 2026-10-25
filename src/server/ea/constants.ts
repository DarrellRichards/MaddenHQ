/**
 * Madden Companion App / Blaze constants.
 * Values change each Madden year — override via env without a code deploy.
 *
 * Protocol documented by the open-source Snallabot project (MIT):
 * https://github.com/snallabot/snallabot-service/blob/main/docs/madden/ea_api.md
 */

export type EaSystemConsole = "xone" | "ps4" | "pc" | "ps5" | "xbsx" | "stadia";

export type EaNamespace = "xbox" | "ps3" | "cem_ea_id" | "stadia";

const year = process.env.EA_MADDEN_YEAR ?? "2026";
const twoDigit = process.env.EA_MADDEN_TWO_DIGIT_YEAR ?? year.slice(-2);

export const EA_YEAR = year;
export const EA_TWO_DIGIT_YEAR = twoDigit;

export const AUTH_SOURCE = Number(process.env.EA_AUTH_SOURCE ?? "317239");
export const CLIENT_ID = process.env.EA_CLIENT_ID ?? `MCA_${twoDigit}_COMP_APP`;
export const CLIENT_SECRET =
  process.env.EA_CLIENT_SECRET ??
  // Documented Companion App client secret (public in community tools; rotates yearly)
  "teJpJ9cSXFqZAuKNW8IuHpy8D4dwWPoVrPoek38iCnrGbrUSfjqnHMBAv8iCVjeSm_20250910175618";
export const REDIRECT_URL = process.env.EA_REDIRECT_URL ?? "http://127.0.0.1/success";
export const MACHINE_KEY = process.env.EA_MACHINE_KEY ?? "444d362e8e067fe2";

export const ANDROID_UA =
  "Dalvik/2.1.0 (Linux; U; Android 13; sdk_gphone_x86_64 Build/TE1A.220922.031)";

export function getEaLoginUrl(): string {
  const params = new URLSearchParams({
    hide_create: "true",
    release_type: "prod",
    response_type: "code",
    redirect_uri: REDIRECT_URL,
    client_id: CLIENT_ID,
    machineProfileKey: MACHINE_KEY,
    authentication_source: String(AUTH_SOURCE),
  });
  return `https://accounts.ea.com/connect/auth?${params.toString()}`;
}

export const VALID_ENTITLEMENTS: Record<EaSystemConsole, string> = {
  xone: `MADDEN_${twoDigit}XONE`,
  ps4: `MADDEN_${twoDigit}PS4`,
  pc: `MADDEN_${twoDigit}PC`,
  ps5: `MADDEN_${twoDigit}PS5`,
  xbsx: `MADDEN_${twoDigit}XBSX`,
  stadia: `MADDEN_${twoDigit}SDA`,
};

export const ENTITLEMENT_TO_CONSOLE: Record<string, EaSystemConsole> = Object.fromEntries(
  Object.entries(VALID_ENTITLEMENTS).map(([console, entitlement]) => [
    entitlement,
    console as EaSystemConsole,
  ]),
);

export const ENTITLEMENT_TO_NAMESPACE: Record<string, EaNamespace> = {
  [VALID_ENTITLEMENTS.xone]: "xbox",
  [VALID_ENTITLEMENTS.ps4]: "ps3",
  [VALID_ENTITLEMENTS.pc]: "cem_ea_id",
  [VALID_ENTITLEMENTS.ps5]: "ps3",
  [VALID_ENTITLEMENTS.xbsx]: "xbox",
  [VALID_ENTITLEMENTS.stadia]: "stadia",
};

export const BLAZE_SERVICE: Record<EaSystemConsole, string> = {
  xone: `madden-${year}-xone`,
  ps4: `madden-${year}-ps4`,
  pc: `madden-${year}-pc`,
  ps5: `madden-${year}-ps5`,
  xbsx: `madden-${year}-xbsx`,
  stadia: `madden-${year}-stadia`,
};

export const BLAZE_PRODUCT_NAME: Record<EaSystemConsole, string> = {
  xone: `madden-${year}-xone-mca`,
  ps4: `madden-${year}-ps4-mca`,
  pc: `madden-${year}-pc-mca`,
  ps5: `madden-${year}-ps5-mca`,
  xbsx: `madden-${year}-xbsx-mca`,
  stadia: `madden-${year}-stadia-mca`,
};

export enum LeagueExportType {
  TEAMS = "CareerMode_GetLeagueTeamsExport",
  STANDINGS = "CareerMode_GetStandingsExport",
  WEEKLY_SCHEDULE = "CareerMode_GetWeeklySchedulesExport",
  RUSHING_STATS = "CareerMode_GetWeeklyRushingStatsExport",
  TEAM_STATS = "CareerMode_GetWeeklyTeamStatsExport",
  PUNTING_STATS = "CareerMode_GetWeeklyPuntingStatsExport",
  RECEIVING_STATS = "CareerMode_GetWeeklyReceivingStatsExport",
  DEFENSIVE_STATS = "CareerMode_GetWeeklyDefensiveStatsExport",
  KICKING_STATS = "CareerMode_GetWeeklyKickingStatsExport",
  PASSING_STATS = "CareerMode_GetWeeklyPassingStatsExport",
  TEAM_ROSTER = "CareerMode_GetTeamRostersExport",
}

export enum StageIndex {
  PRESEASON = 0,
  SEASON = 1,
}
