import { notFound } from "next/navigation";
import { auth } from "@/auth";
import { createTradeAction, reevaluateTradeAction } from "@/app/actions/trades";
import { Button, Panel } from "@/components/ui";
import { prisma } from "@/lib/prisma";

export default async function TradesPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ error?: string; created?: string; fromTeamId?: string; toTeamId?: string }>;
}) {
  const { slug } = await params;
  const { error, created, fromTeamId, toTeamId } = await searchParams;
  const session = await auth();

  const league = await prisma.league.findUnique({
    where: { slug },
    include: {
      teams: { orderBy: { abbr: "asc" } },
      players: {
        include: { team: true },
        orderBy: [{ overall: "desc" }, { lastName: "asc" }],
      },
      trades: {
        include: {
          evaluation: true,
          assets: { include: { player: true, team: true } },
          proposer: true,
        },
        orderBy: { createdAt: "desc" },
      },
      memberships: session?.user?.id
        ? { where: { userId: session.user.id }, take: 1 }
        : false,
    },
  });
  if (!league) notFound();

  const isMember = Array.isArray(league.memberships) && league.memberships.length > 0;
  const selectedFrom = fromTeamId ?? league.teams[0]?.id ?? "";
  const selectedTo =
    toTeamId ??
    league.teams.find((team) => team.id !== selectedFrom)?.id ??
    "";

  const fromPlayers = league.players.filter((player) => player.teamId === selectedFrom);
  const toPlayers = league.players.filter((player) => player.teamId === selectedTo);

  return (
    <div className="stack">
      {error ? (
        <Panel tone="alert">
          <strong>Trade issue:</strong> {error}
        </Panel>
      ) : null}
      {created ? <Panel>Trade proposed and graded with rules-v1.</Panel> : null}

      <Panel title="Propose a trade">
        <p className="muted">
          Pick assets leaving each club. Valuation uses overall + draft-pick heuristics (
          <code>rules-v1</code>). LLM grading can replace <code>evaluateTrade()</code> later.
        </p>

        {!isMember ? (
          <div className="empty">Sign in as a league member to propose trades.</div>
        ) : league.teams.length < 2 ? (
          <div className="empty">Need at least two teams (sync or seed first).</div>
        ) : (
          <>
            <form method="get" className="form-grid">
              <label>
                From team
                <select name="fromTeamId" defaultValue={selectedFrom}>
                  {league.teams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.abbr} — {team.name}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                To team
                <select name="toTeamId" defaultValue={selectedTo}>
                  {league.teams.map((team) => (
                    <option key={team.id} value={team.id}>
                      {team.abbr} — {team.name}
                    </option>
                  ))}
                </select>
              </label>
              <Button type="submit" variant="outline">
                Load rosters
              </Button>
            </form>

            <form action={createTradeAction} className="stack">
              <input type="hidden" name="leagueId" value={league.id} />
              <input type="hidden" name="slug" value={slug} />
              <input type="hidden" name="fromTeamId" value={selectedFrom} />
              <input type="hidden" name="toTeamId" value={selectedTo} />

              <div className="form-grid">
                <fieldset>
                  <legend>Players leaving from team</legend>
                  <div className="choice-stack">
                    {fromPlayers.length === 0 ? (
                      <span className="muted">No players on this roster.</span>
                    ) : (
                      fromPlayers.map((player) => (
                        <label key={player.id} className="choice">
                          <input type="checkbox" name="fromPlayerIds" value={player.id} />
                          <span>
                            {player.position} {player.firstName} {player.lastName} (OVR{" "}
                            {player.overall ?? "?"})
                          </span>
                        </label>
                      ))
                    )}
                  </div>
                </fieldset>
                <fieldset>
                  <legend>Players leaving to team</legend>
                  <div className="choice-stack">
                    {toPlayers.length === 0 ? (
                      <span className="muted">No players on this roster.</span>
                    ) : (
                      toPlayers.map((player) => (
                        <label key={player.id} className="choice">
                          <input type="checkbox" name="toPlayerIds" value={player.id} />
                          <span>
                            {player.position} {player.firstName} {player.lastName} (OVR{" "}
                            {player.overall ?? "?"})
                          </span>
                        </label>
                      ))
                    )}
                  </div>
                </fieldset>
              </div>

              <div className="form-grid">
                <label>
                  Pick from (optional)
                  <input name="fromPick" placeholder="2027 1st" />
                </label>
                <label>
                  Pick to (optional)
                  <input name="toPick" placeholder="2027 3rd" />
                </label>
              </div>

              <label>
                Notes
                <textarea name="notes" rows={2} placeholder="Commissioner notes" />
              </label>

              <Button type="submit" variant="primary">
                Propose &amp; grade trade
              </Button>
            </form>
          </>
        )}
      </Panel>

      <Panel title="Trades">
        {league.trades.length === 0 ? (
          <div className="empty">No trades yet.</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Status</th>
                <th>Proposer</th>
                <th>Assets</th>
                <th>Grade</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {league.trades.map((trade) => (
                <tr key={trade.id}>
                  <td>{trade.status}</td>
                  <td>{trade.proposer.name ?? trade.proposer.email}</td>
                  <td>
                    <ul className="list-compact">
                      {trade.assets.map((asset) => (
                        <li key={asset.id}>
                          <strong>{asset.side}</strong>:{" "}
                          {asset.player
                            ? `${asset.player.firstName} ${asset.player.lastName}`
                            : (asset.pickDesc ?? "—")}
                          {asset.team ? ` (${asset.team.abbr})` : ""}
                        </li>
                      ))}
                    </ul>
                  </td>
                  <td>
                    {trade.evaluation?.score != null
                      ? `${trade.evaluation.score > 0 ? "+" : ""}${trade.evaluation.score}`
                      : "—"}
                    <div className="muted-sm">{trade.evaluation?.summary}</div>
                  </td>
                  <td>
                    <form action={reevaluateTradeAction}>
                      <input type="hidden" name="leagueId" value={league.id} />
                      <input type="hidden" name="slug" value={slug} />
                      <input type="hidden" name="tradeId" value={trade.id} />
                      <Button type="submit" variant="outline">
                        Re-grade
                      </Button>
                    </form>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </div>
  );
}
