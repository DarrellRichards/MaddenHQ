import type { WeeklyAwardType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  fantasyPoints,
  isDefensePosition,
  isOffensePosition,
  summarizeStats,
  type StatBag,
} from "@/server/stats/fantasy";

export type WeeklyAwardSuggestion = {
  type: WeeklyAwardType;
  playerId?: string;
  gameId?: string;
  rationale: string;
  model: string;
};

type PlayerWeekRow = {
  playerId: string;
  gameId: string;
  position: string;
  conference: string | null;
  stats: StatBag;
  points: number;
  name: string;
};

function asStatBag(value: unknown): StatBag {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as StatBag;
  }
  return {};
}

function gameOfTheWeekScore(input: {
  homeScore: number;
  awayScore: number;
}): number {
  const total = input.homeScore + input.awayScore;
  const margin = Math.abs(input.homeScore - input.awayScore);
  // Prefer high-scoring, close games.
  return total - margin * 3;
}

/**
 * Rule-based weekly GOTW + AFC/NFC offense/defense Players of the Week.
 * Optional LLM rationale can wrap these picks later without changing the contract.
 */
export async function suggestWeeklyAwards(input: {
  leagueId: string;
  weekId: string;
}): Promise<WeeklyAwardSuggestion[]> {
  const games = await prisma.game.findMany({
    where: { weekId: input.weekId, status: "final" },
    include: {
      homeTeam: true,
      awayTeam: true,
      playerStats: {
        include: {
          player: { include: { team: true } },
        },
      },
    },
  });

  if (games.length === 0) {
    return [
      {
        type: "GAME_OF_THE_WEEK",
        rationale: "No final games in this week yet.",
        model: "rules-v1",
      },
    ];
  }

  let gotw = games[0];
  let bestGameScore = -Infinity;
  for (const game of games) {
    if (game.homeScore == null || game.awayScore == null) continue;
    const score = gameOfTheWeekScore({
      homeScore: game.homeScore,
      awayScore: game.awayScore,
    });
    if (score > bestGameScore) {
      bestGameScore = score;
      gotw = game;
    }
  }

  const performances: PlayerWeekRow[] = [];
  for (const game of games) {
    for (const row of game.playerStats) {
      const stats = asStatBag(row.stats);
      const points = fantasyPoints(stats);
      if (points <= 0) continue;
      performances.push({
        playerId: row.playerId,
        gameId: game.id,
        position: row.player.position,
        conference: row.player.team?.conference ?? null,
        stats,
        points,
        name: `${row.player.firstName} ${row.player.lastName}`,
      });
    }
  }

  function bestOf(
    predicate: (row: PlayerWeekRow) => boolean,
  ): PlayerWeekRow | undefined {
    return performances
      .filter(predicate)
      .sort((a, b) => b.points - a.points)[0];
  }

  const suggestions: WeeklyAwardSuggestion[] = [
    {
      type: "GAME_OF_THE_WEEK",
      gameId: gotw.id,
      rationale: `${gotw.awayTeam.abbr} ${gotw.awayScore} @ ${gotw.homeTeam.abbr} ${gotw.homeScore} — closest high-scoring final.`,
      model: "rules-v1",
    },
  ];

  const potw: Array<{
    type: WeeklyAwardType;
    conference: "AFC" | "NFC";
    side: "offense" | "defense";
  }> = [
    { type: "AFC_OFFENSE_POTW", conference: "AFC", side: "offense" },
    { type: "AFC_DEFENSE_POTW", conference: "AFC", side: "defense" },
    { type: "NFC_OFFENSE_POTW", conference: "NFC", side: "offense" },
    { type: "NFC_DEFENSE_POTW", conference: "NFC", side: "defense" },
  ];

  for (const award of potw) {
    const winner = bestOf(
      (row) =>
        row.conference === award.conference &&
        (award.side === "offense"
          ? isOffensePosition(row.position)
          : isDefensePosition(row.position)),
    );
    if (!winner) {
      suggestions.push({
        type: award.type,
        rationale: `No ${award.conference} ${award.side} stats logged this week.`,
        model: "rules-v1",
      });
      continue;
    }
    suggestions.push({
      type: award.type,
      playerId: winner.playerId,
      gameId: winner.gameId,
      rationale: `${winner.name} (${winner.position}) — ${winner.points.toFixed(1)} fantasy pts · ${summarizeStats(winner.stats)}`,
      model: "rules-v1",
    });
  }

  return suggestions;
}

export async function persistWeeklyAwards(input: {
  leagueId: string;
  weekId: string;
  suggestions: WeeklyAwardSuggestion[];
}) {
  for (const suggestion of input.suggestions) {
    await prisma.weeklyAward.upsert({
      where: {
        leagueId_weekId_type: {
          leagueId: input.leagueId,
          weekId: input.weekId,
          type: suggestion.type,
        },
      },
      create: {
        leagueId: input.leagueId,
        weekId: input.weekId,
        type: suggestion.type,
        playerId: suggestion.playerId,
        gameId: suggestion.gameId,
        rationale: suggestion.rationale,
        model: suggestion.model,
      },
      update: {
        playerId: suggestion.playerId,
        gameId: suggestion.gameId,
        rationale: suggestion.rationale,
        model: suggestion.model,
      },
    });
  }
}
