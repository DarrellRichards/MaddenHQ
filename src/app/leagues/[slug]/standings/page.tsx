import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";

export default async function StandingsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const league = await prisma.league.findUnique({
    where: { slug },
    include: { teams: { orderBy: [{ conference: "asc" }, { abbr: "asc" }] } },
  });
  if (!league) notFound();

  return (
    <section className="panel">
      <h2 className="display" style={{ marginTop: 0, fontSize: "1.05rem" }}>
        Standings
      </h2>
      <p className="muted">
        Win/loss standings will compute from synced games. Teams currently in the league:
      </p>
      {league.teams.length === 0 ? (
        <div className="empty">No teams yet.</div>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Team</th>
              <th>Conf</th>
              <th>Div</th>
              <th>W</th>
              <th>L</th>
            </tr>
          </thead>
          <tbody>
            {league.teams.map((team) => (
              <tr key={team.id}>
                <td>
                  {team.city ? `${team.city} ` : ""}
                  {team.name} ({team.abbr})
                </td>
                <td>{team.conference ?? "—"}</td>
                <td>{team.division ?? "—"}</td>
                <td>0</td>
                <td>0</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
