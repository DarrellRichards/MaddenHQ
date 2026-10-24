import type { EaClient, EaLeagueSummary, EaTokens, EaWeekExport } from "./types";

function notImplemented(): never {
  throw new Error(
    "Experimental EA client is not implemented yet. Set EA_CLIENT_MODE=stub for local development.",
  );
}

/**
 * Placeholder for a real EA Companion / Blaze client.
 * Official EA APIs for CFM export are not publicly documented; community
 * tools reverse-engineer the Companion App flow. This remains behind
 * EA_SYNC_ENABLED and is intentionally unimplemented in v1.
 */
export class ExperimentalEaClient implements EaClient {
  async exchangeCallbackUrl(callbackUrl: string): Promise<EaTokens> {
    void callbackUrl;
    return notImplemented();
  }

  async refreshTokens(tokens: EaTokens): Promise<EaTokens> {
    void tokens;
    return notImplemented();
  }

  async listLeagues(tokens: EaTokens): Promise<EaLeagueSummary[]> {
    void tokens;
    return notImplemented();
  }

  async exportWeek(
    tokens: EaTokens,
    leagueId: string,
    week: number,
  ): Promise<EaWeekExport> {
    void tokens;
    void leagueId;
    void week;
    return notImplemented();
  }

  async exportAll(tokens: EaTokens, leagueId: string): Promise<EaWeekExport[]> {
    void tokens;
    void leagueId;
    return notImplemented();
  }
}
