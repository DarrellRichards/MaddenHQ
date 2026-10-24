export type EaTokens = {
  accessToken: string;
  refreshToken: string;
  expiresAt?: Date;
};

export type EaLeagueSummary = {
  id: string;
  name: string;
  platform?: string;
};

export type EaWeekExport = {
  leagueId: string;
  seasonYear: number;
  weekNumber: number;
  teams: Array<{
    abbr: string;
    name: string;
    city?: string;
    conference?: string;
    division?: string;
  }>;
  games: Array<{
    homeAbbr: string;
    awayAbbr: string;
    homeScore?: number;
    awayScore?: number;
    status: "scheduled" | "final" | "in_progress";
  }>;
  players: Array<{
    rosterId?: string;
    teamAbbr?: string;
    firstName: string;
    lastName: string;
    position: string;
    jerseyNumber?: number;
    overall?: number;
  }>;
  playerGameStats: Array<{
    playerKey: string; // lastName|firstName|position or rosterId
    homeOrAway: "home" | "away";
    homeAbbr: string;
    awayAbbr: string;
    stats: Record<string, number | string>;
  }>;
};

export interface EaClient {
  exchangeCallbackUrl(callbackUrl: string): Promise<EaTokens>;
  refreshTokens(tokens: EaTokens): Promise<EaTokens>;
  listLeagues(tokens: EaTokens): Promise<EaLeagueSummary[]>;
  exportWeek(tokens: EaTokens, leagueId: string, week: number): Promise<EaWeekExport>;
  exportAll(tokens: EaTokens, leagueId: string): Promise<EaWeekExport[]>;
}
