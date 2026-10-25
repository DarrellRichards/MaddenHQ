import type { SeasonAwardType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import {
  fantasyPoints,
  isDefensePosition,
  isOffensePosition,
  type StatBag,
} from "@/server/stats/fantasy";
import { computeStandings, winPct } from "@/server/stats/standings";

export type SeasonAwardSuggestion = {
  type: SeasonAwardType;
  playerId?: string;
  rationale: string;
  model: string;
};

function asStatBag(value: unknown): StatBag {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as StatBag;
  }
  return {};
}

/**
 * Rule-based yearly awards from season aggregates.
 */
export async function suggestSeasonAwards(input: {
  leagueId: string;
  seasonId: string;
}): Promise<SeasonAwardSuggestion[]> {
  const games = await prisma.game.findMany({
    where: { seasonId: input.seasonId, status: "final" },
    include: {
      homeTeam: true,
      awayTeam: true,
      playerStats: {
        include: { player: true },
      },
    },
  });

  if (games.length === 0) {
    return [
      {
        type: "MVP",
        rationale: "No final games in this season yet.",
        model: "rules-v1",
      },
    ];
  }

  type Agg = {
    playerId: string;
    name: string;
    position: string;
    yearsPro: number | null;
    points: number;
    games: number;
  };

  const byPlayer = new Map<string, Agg>();
  for (const game of games) {
    for (const row of game.playerStats) {
      const points = fantasyPoints(asStatBag(row.stats));
      if (points <= 0) continue;
      const existing = byPlayer.get(row.playerId);
      if (existing) {
        existing.points += points;
        existing.games += 1;
      } else {
        byPlayer.set(row.playerId, {
          playerId: row.playerId,
          name: `${row.player.firstName} ${row.player.lastName}`,
          position: row.player.position,
          yearsPro: row.player.yearsPro,
          points,
          games: 1,
        });
      }
    }
  }

  const players = [...byPlayer.values()].sort((a, b) => b.points - a.points);
  const offense = players.filter((p) => isOffensePosition(p.position));
  const defense = players.filter((p) => isDefensePosition(p.position));
  const rookies = players.filter((p) => p.yearsPro === 0 || p.yearsPro === 1);

  const standings = computeStandings(games);
  const teams = await prisma.team.findMany({
    where: { leagueId: input.leagueId },
  });
  const rankedTeams = teams
    .map((team) => {
      const row = standings.get(team.id) ?? {
        teamId: team.id,
        wins: 0,
        losses: 0,
        ties: 0,
        pointsFor: 0,
        pointsAgainst: 0,
      };
      return { team, standing: row, pct: winPct(row) };
    })
    .sort((a, b) => b.pct - a.pct || b.standing.wins - a.standing.wins);

  function pick(
    type: SeasonAwardType,
    player: Agg | undefined,
    rationale: string,
  ): SeasonAwardSuggestion {
    if (!player) {
      return { type, rationale, model: "rules-v1" };
    }
    return {
      type,
      playerId: player.playerId,
      rationale: `${player.name} (${player.position}) — ${player.points.toFixed(1)} season fantasy pts over ${player.games} games.`,
      model: "rules-v1",
    };
  }

  const topTeam = rankedTeams[0];
  const coach: SeasonAwardSuggestion = topTeam
    ? {
        type: "COACH_OF_THE_YEAR",
        rationale: `${topTeam.team.city ?? ""} ${topTeam.team.name} (${topTeam.team.abbr}) lead the league at ${topTeam.standing.wins}-${topTeam.standing.losses}-${topTeam.standing.ties}.`.trim(),
        model: "rules-v1",
      }
    : {
        type: "COACH_OF_THE_YEAR",
        rationale: "No standings available yet.",
        model: "rules-v1",
      };

  // Comeback: best points-per-game among players with at least 2 games — proxy until YoY data exists.
  const comeback = [...players]
    .filter((p) => p.games >= 2)
    .sort((a, b) => b.points / b.games - a.points / a.games)[0];

  return [
    pick("MVP", players[0], "No offensive/defensive stats logged yet."),
    pick("OFFENSIVE_PLAYER", offense[0], "No offense stats logged yet."),
    pick("DEFENSIVE_PLAYER", defense[0], "No defense stats logged yet."),
    pick(
      "ROOKIE_OF_THE_YEAR",
      rookies[0],
      "No rookie markers (yearsPro 0–1) on roster yet.",
    ),
    coach,
    pick(
      "COMEBACK_PLAYER",
      comeback,
      "Need at least two games logged to estimate a comeback candidate.",
    ),
  ];
}

export async function persistSeasonAwards(input: {
  leagueId: string;
  seasonId: string;
  suggestions: SeasonAwardSuggestion[];
}) {
  for (const suggestion of input.suggestions) {
    await prisma.seasonAward.upsert({
      where: {
        leagueId_seasonId_type: {
          leagueId: input.leagueId,
          seasonId: input.seasonId,
          type: suggestion.type,
        },
      },
      create: {
        leagueId: input.leagueId,
        seasonId: input.seasonId,
        type: suggestion.type,
        playerId: suggestion.playerId,
        rationale: suggestion.rationale,
        model: suggestion.model,
      },
      update: {
        playerId: suggestion.playerId,
        rationale: suggestion.rationale,
        model: suggestion.model,
      },
    });
  }
}
