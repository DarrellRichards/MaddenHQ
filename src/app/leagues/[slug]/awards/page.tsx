import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { suggestWeeklyAwards } from "@/server/awards/weekly";
import { suggestSeasonAwards } from "@/server/awards/season";

export default async function AwardsPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const league = await prisma.league.findUnique({
    where: { slug },
    include: {
      weeklyAwards: { include: { player: true, week: true }, orderBy: { createdAt: "desc" }, take: 20 },
      seasonAwards: { include: { player: true, season: true }, orderBy: { createdAt: "desc" }, take: 20 },
      seasons: { where: { isCurrent: true }, include: { weeks: { orderBy: { number: "desc" }, take: 1 } }, take: 1 },
    },
  });
  if (!league) notFound();

  const currentWeek = league.seasons[0]?.weeks[0];
  const weeklyStub = currentWeek
    ? await suggestWeeklyAwards({ leagueId: league.id, weekId: currentWeek.id })
    : [];
  const seasonStub = league.seasons[0]
    ? await suggestSeasonAwards({ leagueId: league.id, seasonId: league.seasons[0].id })
    : [];

  return (
    <div className="stack">
      <section className="panel">
        <h2 className="display" style={{ marginTop: 0, fontSize: "1.05rem" }}>
          Weekly awards (AI)
        </h2>
        <p className="muted">
          Game of the Week plus AFC/NFC offense and defense Players of the Week.
        </p>
        {weeklyStub.length === 0 ? (
          <div className="empty">Need a current season/week before suggestions run.</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Award</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {weeklyStub.map((award) => (
                <tr key={award.type}>
                  <td>{award.type.replaceAll("_", " ")}</td>
                  <td>{award.rationale}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="panel">
        <h2 className="display" style={{ marginTop: 0, fontSize: "1.05rem" }}>
          Yearly awards (AI)
        </h2>
        {seasonStub.length === 0 ? (
          <div className="empty">No current season.</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Award</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {seasonStub.map((award) => (
                <tr key={award.type}>
                  <td>{award.type.replaceAll("_", " ")}</td>
                  <td>{award.rationale}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="panel">
        <h2 className="display" style={{ marginTop: 0, fontSize: "1.05rem" }}>
          Saved awards
        </h2>
        {league.weeklyAwards.length + league.seasonAwards.length === 0 ? (
          <div className="empty">No persisted awards yet.</div>
        ) : (
          <ul>
            {league.weeklyAwards.map((award) => (
              <li key={award.id}>
                {award.type} · Week {award.week.number}
                {award.player
                  ? ` · ${award.player.firstName} ${award.player.lastName}`
                  : ""}
              </li>
            ))}
            {league.seasonAwards.map((award) => (
              <li key={award.id}>
                {award.type} · {award.season.label}
                {award.player
                  ? ` · ${award.player.firstName} ${award.player.lastName}`
                  : ""}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
