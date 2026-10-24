import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";

export default async function StatsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const league = await prisma.league.findUnique({ where: { slug } });
  if (!league) notFound();

  const players = await prisma.player.findMany({
    where: { leagueId: league.id },
    include: { team: true, gameStats: true },
    orderBy: [{ overall: "desc" }, { lastName: "asc" }],
    take: 50,
  });

  return (
    <section className="panel">
      <h2 className="display" style={{ marginTop: 0, fontSize: "1.05rem" }}>
        Player stats
      </h2>
      <p className="muted">
        Per-game and year-over-year leaderboards will expand here. Showing roster with
        attached game-stat rows.
      </p>
      {players.length === 0 ? (
        <div className="empty">No players synced yet.</div>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Player</th>
              <th>Pos</th>
              <th>Team</th>
              <th>OVR</th>
              <th>Games logged</th>
            </tr>
          </thead>
          <tbody>
            {players.map((player) => (
              <tr key={player.id}>
                <td>
                  {player.firstName} {player.lastName}
                </td>
                <td>{player.position}</td>
                <td>{player.team?.abbr ?? "FA"}</td>
                <td>{player.overall ?? "—"}</td>
                <td>{player.gameStats.length}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
