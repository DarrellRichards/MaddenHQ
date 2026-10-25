import Link from "next/link";
import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { getCurrentSeason, getSeasonGames } from "@/server/stats/queries";

export default async function ScoresPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ week?: string }>;
}) {
  const { slug } = await params;
  const { week: weekParam } = await searchParams;

  const league = await prisma.league.findUnique({ where: { slug } });
  if (!league) notFound();

  const season = await getCurrentSeason(league.id);
  if (!season) {
    return (
      <section className="panel">
        <h2 className="display" style={{ marginTop: 0, fontSize: "1.05rem" }}>
          Scores
        </h2>
        <div className="empty">No current season yet. Sync EA data first.</div>
      </section>
    );
  }

  const selectedWeek =
    season.weeks.find((week) => String(week.number) === weekParam) ??
    season.weeks[season.weeks.length - 1];

  const games = await getSeasonGames(
    season.id,
    selectedWeek ? selectedWeek.id : undefined,
  );

  return (
    <div className="stack">
      <section className="panel stack">
        <h2 className="display" style={{ marginTop: 0, fontSize: "1.05rem" }}>
          Scores
        </h2>
        <p className="muted">
          {season.label ?? season.year} · pick a week to browse finals and
          scheduled games.
        </p>

        {season.weeks.length === 0 ? (
          <div className="empty">No weeks synced yet.</div>
        ) : (
          <form method="get" className="form-grid">
            <label>
              Week
              <select name="week" defaultValue={String(selectedWeek?.number ?? "")}>
                {season.weeks.map((week) => (
                  <option key={week.id} value={week.number}>
                    Week {week.number}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className="btn">
              Show week
            </button>
          </form>
        )}

        {games.length === 0 ? (
          <div className="empty">No games for this week.</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Matchup</th>
                <th>Score</th>
                <th>Status</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {games.map((game) => (
                <tr key={game.id}>
                  <td>
                    {game.awayTeam.abbr} @ {game.homeTeam.abbr}
                  </td>
                  <td>
                    {game.awayScore ?? "—"} – {game.homeScore ?? "—"}
                  </td>
                  <td>{game.status}</td>
                  <td>
                    <Link href={`/leagues/${slug}/games/${game.id}`}>Box score</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
