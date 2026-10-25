import { notFound } from "next/navigation";
import { MembershipRole } from "@prisma/client";
import { auth } from "@/auth";
import {
  generateSeasonAwardsAction,
  generateWeeklyAwardsAction,
} from "@/app/actions/awards";
import { prisma } from "@/lib/prisma";
import { suggestSeasonAwards } from "@/server/awards/season";
import { suggestWeeklyAwards } from "@/server/awards/weekly";

export default async function AwardsPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ week?: string; error?: string; saved?: string }>;
}) {
  const { slug } = await params;
  const { week: weekParam, error, saved } = await searchParams;
  const session = await auth();

  const league = await prisma.league.findUnique({
    where: { slug },
    include: {
      weeklyAwards: {
        include: { player: true, week: true, game: { include: { homeTeam: true, awayTeam: true } } },
        orderBy: { createdAt: "desc" },
        take: 40,
      },
      seasonAwards: {
        include: { player: true, season: true },
        orderBy: { createdAt: "desc" },
        take: 20,
      },
      seasons: {
        where: { isCurrent: true },
        include: { weeks: { orderBy: { number: "asc" } } },
        take: 1,
      },
      memberships: session?.user?.id
        ? { where: { userId: session.user.id }, take: 1 }
        : false,
    },
  });
  if (!league) notFound();

  const membership = Array.isArray(league.memberships)
    ? league.memberships[0]
    : null;
  const canManage =
    membership?.role === MembershipRole.OWNER ||
    membership?.role === MembershipRole.COMMISSIONER;

  const season = league.seasons[0];
  const weeks = season?.weeks ?? [];
  const selectedWeek =
    weeks.find((week) => String(week.number) === weekParam) ??
    weeks[weeks.length - 1];

  const weeklyPreview = selectedWeek
    ? await suggestWeeklyAwards({ leagueId: league.id, weekId: selectedWeek.id })
    : [];
  const seasonPreview = season
    ? await suggestSeasonAwards({ leagueId: league.id, seasonId: season.id })
    : [];

  return (
    <div className="stack">
      {error ? (
        <div
          className="panel"
          style={{ borderColor: "var(--accent)", color: "var(--accent)", margin: 0 }}
        >
          <strong>Awards issue:</strong> {error}
        </div>
      ) : null}
      {saved ? (
        <div className="panel" style={{ margin: 0 }}>
          Saved {saved} awards.
        </div>
      ) : null}

      <section className="panel stack">
        <h2 className="display" style={{ marginTop: 0, fontSize: "1.05rem" }}>
          Weekly awards
        </h2>
        <p className="muted">
          Rule-based Game of the Week and AFC/NFC offense &amp; defense Players of the
          Week. Swap in an LLM later without changing this UI.
        </p>

        {weeks.length === 0 ? (
          <div className="empty">Need a current season with weeks (run EA sync).</div>
        ) : (
          <>
            <form method="get" className="form-grid">
              <label>
                Week
                <select name="week" defaultValue={String(selectedWeek?.number ?? "")}>
                  {weeks.map((week) => (
                    <option key={week.id} value={week.number}>
                      Week {week.number}
                    </option>
                  ))}
                </select>
              </label>
              <button type="submit" className="btn">
                Preview week
              </button>
            </form>

            <table className="table">
              <thead>
                <tr>
                  <th>Award</th>
                  <th>Suggestion</th>
                </tr>
              </thead>
              <tbody>
                {weeklyPreview.map((award) => (
                  <tr key={award.type}>
                    <td>{award.type.replaceAll("_", " ")}</td>
                    <td>{award.rationale}</td>
                  </tr>
                ))}
              </tbody>
            </table>

            {canManage && selectedWeek ? (
              <form action={generateWeeklyAwardsAction}>
                <input type="hidden" name="leagueId" value={league.id} />
                <input type="hidden" name="slug" value={slug} />
                <input type="hidden" name="weekId" value={selectedWeek.id} />
                <button type="submit" className="btn btn--primary">
                  Save weekly awards (Week {selectedWeek.number})
                </button>
              </form>
            ) : null}
          </>
        )}
      </section>

      <section className="panel stack">
        <h2 className="display" style={{ marginTop: 0, fontSize: "1.05rem" }}>
          Season awards
        </h2>
        {seasonPreview.length === 0 ? (
          <div className="empty">No current season.</div>
        ) : (
          <>
            <table className="table">
              <thead>
                <tr>
                  <th>Award</th>
                  <th>Suggestion</th>
                </tr>
              </thead>
              <tbody>
                {seasonPreview.map((award) => (
                  <tr key={award.type}>
                    <td>{award.type.replaceAll("_", " ")}</td>
                    <td>{award.rationale}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {canManage && season ? (
              <form action={generateSeasonAwardsAction}>
                <input type="hidden" name="leagueId" value={league.id} />
                <input type="hidden" name="slug" value={slug} />
                <input type="hidden" name="seasonId" value={season.id} />
                <button type="submit" className="btn btn--primary">
                  Save season awards
                </button>
              </form>
            ) : null}
          </>
        )}
      </section>

      <section className="panel">
        <h2 className="display" style={{ marginTop: 0, fontSize: "1.05rem" }}>
          Saved awards
        </h2>
        {league.weeklyAwards.length + league.seasonAwards.length === 0 ? (
          <div className="empty">No persisted awards yet.</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Type</th>
                <th>Scope</th>
                <th>Winner</th>
                <th>Notes</th>
              </tr>
            </thead>
            <tbody>
              {league.weeklyAwards.map((award) => (
                <tr key={award.id}>
                  <td>{award.type.replaceAll("_", " ")}</td>
                  <td>Week {award.week.number}</td>
                  <td>
                    {award.player
                      ? `${award.player.firstName} ${award.player.lastName}`
                      : award.game
                        ? `${award.game.awayTeam.abbr} @ ${award.game.homeTeam.abbr}`
                        : "—"}
                  </td>
                  <td>{award.rationale ?? "—"}</td>
                </tr>
              ))}
              {league.seasonAwards.map((award) => (
                <tr key={award.id}>
                  <td>{award.type.replaceAll("_", " ")}</td>
                  <td>{award.season.label ?? award.season.year}</td>
                  <td>
                    {award.player
                      ? `${award.player.firstName} ${award.player.lastName}`
                      : "—"}
                  </td>
                  <td>{award.rationale ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
