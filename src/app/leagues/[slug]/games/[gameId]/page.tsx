import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { Panel } from "@/components/ui";
import { summarizeStats, type StatBag } from "@/server/stats/fantasy";
import { getGameBoxScore } from "@/server/stats/queries";

function asStatBag(value: unknown): StatBag {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as StatBag;
  }
  return {};
}

export default async function GameBoxScorePage({
  params,
}: {
  params: Promise<{ slug: string; gameId: string }>;
}) {
  const { slug, gameId } = await params;
  const league = await prisma.league.findUnique({ where: { slug } });
  if (!league) notFound();

  const game = await getGameBoxScore(gameId, league.id);
  if (!game) notFound();

  type BoxStatRow = (typeof game.playerStats)[number];

  const homeStats = game.playerStats.filter(
    (row) => row.teamId === game.homeTeamId || row.player.teamId === game.homeTeamId,
  );
  const awayStats = game.playerStats.filter(
    (row) => row.teamId === game.awayTeamId || row.player.teamId === game.awayTeamId,
  );

  function renderSide(title: string, rows: BoxStatRow[]) {
    return (
      <Panel title={title}>
        {rows.length === 0 ? (
          <div className="empty">No player stats logged for this side.</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Player</th>
                <th>Pos</th>
                <th>Line</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>
                    {row.player.firstName} {row.player.lastName}
                  </td>
                  <td>{row.player.position}</td>
                  <td>{summarizeStats(asStatBag(row.stats))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    );
  }

  return (
    <div className="stack">
      <p className="muted">
        <Link href={`/leagues/${slug}/scores`}>← Scores</Link>
      </p>
      <Panel
        title={`${game.awayTeam.abbr} ${game.awayScore ?? "—"} @ ${game.homeTeam.abbr} ${game.homeScore ?? "—"}`}
      >
        <p className="muted">
          {game.season.label ?? game.season.year} · Week {game.week.number} · {game.status}
        </p>
      </Panel>
      {renderSide(
        `${game.awayTeam.city ? `${game.awayTeam.city} ` : ""}${game.awayTeam.name}`,
        awayStats,
      )}
      {renderSide(
        `${game.homeTeam.city ? `${game.homeTeam.city} ` : ""}${game.homeTeam.name}`,
        homeStats,
      )}
    </div>
  );
}
