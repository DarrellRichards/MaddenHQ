export type StandingGame = {
  homeTeamId: string;
  awayTeamId: string;
  homeScore: number | null;
  awayScore: number | null;
  status: string;
};

export type TeamStanding = {
  teamId: string;
  wins: number;
  losses: number;
  ties: number;
  pointsFor: number;
  pointsAgainst: number;
};

/**
 * Compute W/L/T from final games. Scheduled / in-progress games are ignored.
 */
export function computeStandings(games: StandingGame[]): Map<string, TeamStanding> {
  const standings = new Map<string, TeamStanding>();

  function row(teamId: string): TeamStanding {
    let entry = standings.get(teamId);
    if (!entry) {
      entry = {
        teamId,
        wins: 0,
        losses: 0,
        ties: 0,
        pointsFor: 0,
        pointsAgainst: 0,
      };
      standings.set(teamId, entry);
    }
    return entry;
  }

  for (const game of games) {
    if (game.status !== "final") continue;
    if (game.homeScore == null || game.awayScore == null) continue;

    const home = row(game.homeTeamId);
    const away = row(game.awayTeamId);
    home.pointsFor += game.homeScore;
    home.pointsAgainst += game.awayScore;
    away.pointsFor += game.awayScore;
    away.pointsAgainst += game.homeScore;

    if (game.homeScore > game.awayScore) {
      home.wins += 1;
      away.losses += 1;
    } else if (game.awayScore > game.homeScore) {
      away.wins += 1;
      home.losses += 1;
    } else {
      home.ties += 1;
      away.ties += 1;
    }
  }

  return standings;
}

export function winPct(standing: TeamStanding): number {
  const played = standing.wins + standing.losses + standing.ties;
  if (played === 0) return 0;
  return (standing.wins + standing.ties * 0.5) / played;
}
