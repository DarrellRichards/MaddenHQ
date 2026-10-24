import type { EaClient, EaLeagueSummary, EaTokens, EaWeekExport } from "./types";
import fixture from "./fixtures/demo-week.json";

/**
 * Local/dev client that never talks to EA.
 * Lets contributors run sync flows against fixture data.
 */
export class StubEaClient implements EaClient {
  async exchangeCallbackUrl(callbackUrl: string): Promise<EaTokens> {
    void callbackUrl;
    return {
      accessToken: "stub-access-token",
      refreshToken: "stub-refresh-token",
      expiresAt: new Date(Date.now() + 4 * 60 * 60 * 1000),
    };
  }

  async refreshTokens(tokens: EaTokens): Promise<EaTokens> {
    return {
      ...tokens,
      accessToken: "stub-access-token-refreshed",
      expiresAt: new Date(Date.now() + 4 * 60 * 60 * 1000),
    };
  }

  async listLeagues(tokens: EaTokens): Promise<EaLeagueSummary[]> {
    void tokens;
    return [
      { id: "stub-league-1", name: "MaddenHQ Demo League", platform: "playstation" },
    ];
  }

  async exportWeek(
    tokens: EaTokens,
    leagueId: string,
    week: number,
  ): Promise<EaWeekExport> {
    void tokens;
    const data = fixture as unknown as EaWeekExport;
    return { ...data, leagueId, weekNumber: week };
  }

  async exportAll(tokens: EaTokens, leagueId: string): Promise<EaWeekExport[]> {
    const week1 = await this.exportWeek(tokens, leagueId, 1);
    return [week1];
  }
}
