import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { LEADER_CATEGORIES } from "@/server/stats/leaders";
import {
  getCategoryLeaders,
  getCurrentSeason,
} from "@/server/stats/queries";

export default async function StatsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ cat?: string; week?: string }>;
}) {
  const { slug } = await params;
  const { cat, week: weekParam } = await searchParams;

  const league = await prisma.league.findUnique({ where: { slug } });
  if (!league) notFound();

  const season = await getCurrentSeason(league.id);
  if (!season) {
    return (
      <section className="panel">
        <h2 className="display" style={{ marginTop: 0, fontSize: "1.05rem" }}>
          Stats
        </h2>
        <div className="empty">No current season yet. Sync EA data first.</div>
      </section>
    );
  }

  const weekScope = weekParam === "all" || !weekParam ? "all" : weekParam;
  const selectedWeek =
    weekScope === "all"
      ? undefined
      : season.weeks.find((week) => String(week.number) === weekScope);

  const { category, leaders } = await getCategoryLeaders({
    leagueId: league.id,
    seasonId: season.id,
    weekId: selectedWeek?.id,
    category: cat,
  });

  const meta = LEADER_CATEGORIES.find((entry) => entry.id === category)!;

  return (
    <div className="stack">
      <section className="panel stack">
        <h2 className="display" style={{ marginTop: 0, fontSize: "1.05rem" }}>
          Leaderboards
        </h2>
        <p className="muted">
          {season.label ?? season.year}
          {selectedWeek ? ` · Week ${selectedWeek.number}` : " · full season"}.
        </p>

        <form method="get" className="form-grid">
          <label>
            Category
            <select name="cat" defaultValue={category}>
              {LEADER_CATEGORIES.map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.label}
                </option>
              ))}
            </select>
          </label>
          <label>
            Scope
            <select name="week" defaultValue={weekScope}>
              <option value="all">Full season</option>
              {season.weeks.map((week) => (
                <option key={week.id} value={week.number}>
                  Week {week.number}
                </option>
              ))}
            </select>
          </label>
          <button type="submit" className="btn btn--primary">
            Update board
          </button>
        </form>

        {leaders.length === 0 ? (
          <div className="empty">
            No {meta.label.toLowerCase()} stats logged for this scope yet.
          </div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>#</th>
                <th>Player</th>
                <th>Pos</th>
                <th>Team</th>
                {meta.columns.map((column) => (
                  <th key={column.key}>{column.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {leaders.map((entry, index) => (
                <tr key={entry.playerId}>
                  <td>{index + 1}</td>
                  <td>{entry.name}</td>
                  <td>{entry.position}</td>
                  <td>{entry.teamAbbr ?? "FA"}</td>
                  <td>{entry.primary}</td>
                  <td>{entry.secondary}</td>
                  <td>{entry.tertiary}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
