import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Panel } from "@/components/ui";
import { computeStandings, winPct } from "@/server/stats/standings";

export default async function StandingsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const league = await prisma.league.findUnique({
    where: { slug },
    include: {
      teams: { orderBy: [{ conference: "asc" }, { division: "asc" }, { abbr: "asc" }] },
      seasons: { where: { isCurrent: true }, take: 1 },
    },
  });
  if (!league) notFound();

  const season = league.seasons[0];
  const games = season
    ? await prisma.game.findMany({
        where: { seasonId: season.id },
        select: {
          homeTeamId: true,
          awayTeamId: true,
          homeScore: true,
          awayScore: true,
          status: true,
        },
      })
    : [];

  const standings = computeStandings(games);
  const rows = league.teams
    .map((team) => {
      const record = standings.get(team.id) ?? {
        teamId: team.id,
        wins: 0,
        losses: 0,
        ties: 0,
        pointsFor: 0,
        pointsAgainst: 0,
      };
      return { team, record, pct: winPct(record) };
    })
    .sort(
      (a, b) =>
        b.pct - a.pct ||
        b.record.wins - a.record.wins ||
        b.record.pointsFor - b.record.pointsAgainst - (a.record.pointsFor - a.record.pointsAgainst),
    );

  return (
    <Panel title="Standings">
      <p className="muted">
        Computed from final synced games
        {season ? ` · ${season.label ?? season.year}` : ""}.
      </p>
      {rows.length === 0 ? (
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
              <th>T</th>
              <th>Pct</th>
              <th>PF</th>
              <th>PA</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ team, record, pct }) => (
              <tr key={team.id}>
                <td>
                  {team.city ? `${team.city} ` : ""}
                  {team.name} ({team.abbr})
                </td>
                <td>{team.conference ?? "—"}</td>
                <td>{team.division ?? "—"}</td>
                <td>{record.wins}</td>
                <td>{record.losses}</td>
                <td>{record.ties}</td>
                <td>{pct.toFixed(3)}</td>
                <td>{record.pointsFor}</td>
                <td>{record.pointsAgainst}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </Panel>
  );
}
