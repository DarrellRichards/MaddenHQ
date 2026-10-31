import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Panel } from "@/components/ui";
import { getCategoryLeaders, getCurrentSeason, getSeasonGames } from "@/server/stats/queries";

export default async function LeagueOverviewPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const league = await prisma.league.findUnique({
    where: { slug },
    include: {
      teams: { orderBy: { abbr: "asc" } },
      _count: { select: { players: true, trades: true, weeklyAwards: true } },
      eaConnection: true,
    },
  });
  if (!league) notFound();

  const season = await getCurrentSeason(league.id);
  const recentGames = season
    ? (await getSeasonGames(season.id)).slice(-5).reverse()
    : [];
  const passingLeaders = season
    ? (
        await getCategoryLeaders({
          leagueId: league.id,
          seasonId: season.id,
          category: "passing",
          limit: 3,
        })
      ).leaders
    : [];

  return (
    <div className="stack">
      <Panel title="Snapshot">
        <table className="table">
          <tbody>
            <tr>
              <th>Season</th>
              <td>{season?.label ?? "Not started"}</td>
            </tr>
            <tr>
              <th>Teams</th>
              <td>{league.teams.length}</td>
            </tr>
            <tr>
              <th>Players</th>
              <td>{league._count.players}</td>
            </tr>
            <tr>
              <th>Weeks synced</th>
              <td>{season?.weeks.length ?? 0}</td>
            </tr>
            <tr>
              <th>EA sync</th>
              <td>
                {league.eaConnection
                  ? `Connected${league.eaConnection.lastSyncAt ? ` · last sync ${league.eaConnection.lastSyncAt.toLocaleString()}` : ""}`
                  : "Not connected"}{" "}
                · <Link href={`/leagues/${slug}/sync`}>Manage</Link>
              </td>
            </tr>
          </tbody>
        </table>
      </Panel>

      <Panel>
        <div className="panel__toolbar">
          <h2 className="panel__title display">Recent games</h2>
          <Link href={`/leagues/${slug}/scores`}>All scores</Link>
        </div>
        {recentGames.length === 0 ? (
          <div className="empty">
            No games yet. Connect EA and run a sync, or seed the demo league.
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Week</th>
                <th>Matchup</th>
                <th>Score</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {recentGames.map((game) => (
                <tr key={game.id}>
                  <td>{game.week.label ?? game.week.number}</td>
                  <td>
                    <Link href={`/leagues/${slug}/games/${game.id}`}>
                      {game.awayTeam.abbr} @ {game.homeTeam.abbr}
                    </Link>
                  </td>
                  <td>
                    {game.awayScore ?? "—"} – {game.homeScore ?? "—"}
                  </td>
                  <td>{game.status}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>

      <Panel>
        <div className="panel__toolbar">
          <h2 className="panel__title display">Passing leaders</h2>
          <Link href={`/leagues/${slug}/stats?cat=passing`}>Full board</Link>
        </div>
        {passingLeaders.length === 0 ? (
          <div className="empty">No passing stats logged yet.</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Player</th>
                <th>Team</th>
                <th>Yds</th>
                <th>TD</th>
              </tr>
            </thead>
            <tbody>
              {passingLeaders.map((entry) => (
                <tr key={entry.playerId}>
                  <td>{entry.name}</td>
                  <td>{entry.teamAbbr ?? "FA"}</td>
                  <td>{entry.primary}</td>
                  <td>{entry.secondary}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </div>
  );
}
