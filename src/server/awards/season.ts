import type { SeasonAwardType } from "@prisma/client";

export type SeasonAwardSuggestion = {
  type: SeasonAwardType;
  playerId?: string;
  rationale: string;
  model: string;
};

/**
 * Yearly league awards stub (MVP, OPOTY, DPOTY, etc.).
 */
export async function suggestSeasonAwards(input: {
  leagueId: string;
  seasonId: string;
}): Promise<SeasonAwardSuggestion[]> {
  void input;
  const types: SeasonAwardType[] = [
    "MVP",
    "OFFENSIVE_PLAYER",
    "DEFENSIVE_PLAYER",
    "ROOKIE_OF_THE_YEAR",
    "COACH_OF_THE_YEAR",
    "COMEBACK_PLAYER",
  ];

  return types.map((type) => ({
    type,
    rationale: "Season award AI is not enabled yet.",
    model: "stub",
  }));
}
