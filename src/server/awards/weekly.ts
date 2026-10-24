import type { WeeklyAwardType } from "@prisma/client";

export type WeeklyAwardSuggestion = {
  type: WeeklyAwardType;
  playerId?: string;
  gameId?: string;
  rationale: string;
  model: string;
};

/**
 * Weekly GOTW + AFC/NFC offense/defense POTW stub powered by AI later.
 */
export async function suggestWeeklyAwards(input: {
  leagueId: string;
  weekId: string;
}): Promise<WeeklyAwardSuggestion[]> {
  void input;
  const types: WeeklyAwardType[] = [
    "GAME_OF_THE_WEEK",
    "AFC_OFFENSE_POTW",
    "AFC_DEFENSE_POTW",
    "NFC_OFFENSE_POTW",
    "NFC_DEFENSE_POTW",
  ];

  return types.map((type) => ({
    type,
    rationale: "Weekly award AI is not enabled yet.",
    model: "stub",
  }));
}
