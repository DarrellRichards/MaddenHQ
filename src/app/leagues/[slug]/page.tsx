import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";

export default async function LeagueOverviewPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const league = await prisma.league.findUnique({
    where: { slug },
    include: {
      seasons: { where: { isCurrent: true }, take: 1 },
      teams: { orderBy: { abbr: "asc" } },
      _count: { select: { players: true, trades: true, weeklyAwards: true } },
      eaConnection: true,
    },
  });
  if (!league) notFound();

  const season = league.seasons[0];
  const recentGames = season
    ? await prisma.game.findMany({
        where: { seasonId: season.id },
        include: { homeTeam: true, awayTeam: true, week: true },
        orderBy: { createdAt: "desc" },
        take: 5,
      })
    : [];

  return (
    <div className="stack">
      <section className="panel">
        <h2 className="display" style={{ marginTop: 0, fontSize: "1.05rem" }}>
          Snapshot
        </h2>
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
      </section>

      <section className="panel">
        <h2 className="display" style={{ marginTop: 0, fontSize: "1.05rem" }}>
          Recent games
        </h2>
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
                    {game.awayTeam.abbr} @ {game.homeTeam.abbr}
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
      </section>
    </div>
  );
}
