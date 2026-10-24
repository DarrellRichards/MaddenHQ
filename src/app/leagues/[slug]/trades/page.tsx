import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { evaluateTrade } from "@/server/trades/evaluate";

export default async function TradesPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const league = await prisma.league.findUnique({
    where: { slug },
    include: {
      trades: {
        include: { evaluation: true, assets: true, proposer: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!league) notFound();

  const stub = await evaluateTrade({
    id: "stub",
    leagueId: league.id,
    proposerId: "stub",
    status: "DRAFT",
    notes: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    resolvedAt: null,
  });

  return (
    <div className="stack">
      <section className="panel">
        <h2 className="display" style={{ marginTop: 0, fontSize: "1.05rem" }}>
          Trade center
        </h2>
        <p className="muted">
          Propose and review trades. AI valuation hooks live in{" "}
          <code>src/server/trades/evaluate.ts</code>.
        </p>
        <div className="empty">
          Evaluator status: {stub.summary} (model: {stub.model})
        </div>
      </section>

      <section className="panel">
        <h2 className="display" style={{ marginTop: 0, fontSize: "1.05rem" }}>
          Trades
        </h2>
        {league.trades.length === 0 ? (
          <div className="empty">No trades yet. UI for proposing trades comes next.</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Status</th>
                <th>Proposer</th>
                <th>Assets</th>
                <th>AI score</th>
              </tr>
            </thead>
            <tbody>
              {league.trades.map((trade) => (
                <tr key={trade.id}>
                  <td>{trade.status}</td>
                  <td>{trade.proposer.name ?? trade.proposer.email}</td>
                  <td>{trade.assets.length}</td>
                  <td>{trade.evaluation?.score ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
