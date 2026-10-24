import { notFound, redirect } from "next/navigation";
import { MembershipRole } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { connectEaAction, triggerSyncAction } from "@/app/actions/leagues";

export default async function SyncPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const { slug } = await params;
  const league = await prisma.league.findUnique({
    where: { slug },
    include: { eaConnection: true },
  });
  if (!league) notFound();

  const membership = await prisma.leagueMembership.findUnique({
    where: {
      leagueId_userId: { leagueId: league.id, userId: session.user.id },
    },
  });

  const canManage =
    membership?.role === MembershipRole.OWNER ||
    membership?.role === MembershipRole.COMMISSIONER;

  return (
    <div className="stack">
      <section className="panel stack">
        <h2 className="display" style={{ marginTop: 0, fontSize: "1.05rem" }}>
          Connect EA
        </h2>
        <p className="muted" style={{ margin: 0 }}>
          MaddenHQ does <strong>not</strong> store your EA password. Sign in with EA in
          another tab, then paste the <code>http://127.0.0.1/...</code> callback URL
          here. Tokens are encrypted at rest. EA APIs are unofficial and may break —
          local/dev uses a stub client when <code>EA_CLIENT_MODE=stub</code>.
        </p>
        {!canManage ? (
          <div className="empty">Only commissioners can connect EA for this league.</div>
        ) : (
          <form action={connectEaAction} className="form-grid">
            <input type="hidden" name="leagueId" value={league.id} />
            <input type="hidden" name="slug" value={slug} />
            <label>
              EA callback URL
              <input
                name="callbackUrl"
                required
                placeholder="http://127.0.0.1/success?code=..."
              />
            </label>
            <button type="submit" className="btn btn--accent">
              Save EA connection
            </button>
          </form>
        )}
      </section>

      <section className="panel stack">
        <h2 className="display" style={{ marginTop: 0, fontSize: "1.05rem" }}>
          Sync status
        </h2>
        {league.eaConnection ? (
          <>
            <table className="table">
              <tbody>
                <tr>
                  <th>EA league id</th>
                  <td>{league.eaConnection.eaLeagueId ?? "—"}</td>
                </tr>
                <tr>
                  <th>Last sync</th>
                  <td>
                    {league.eaConnection.lastSyncAt
                      ? league.eaConnection.lastSyncAt.toLocaleString()
                      : "Never"}
                  </td>
                </tr>
                <tr>
                  <th>Status</th>
                  <td>{league.eaConnection.lastSyncStatus ?? "—"}</td>
                </tr>
                <tr>
                  <th>Client mode</th>
                  <td>{process.env.EA_CLIENT_MODE ?? "stub"}</td>
                </tr>
              </tbody>
            </table>
            {canManage ? (
              <form action={triggerSyncAction}>
                <input type="hidden" name="leagueId" value={league.id} />
                <input type="hidden" name="slug" value={slug} />
                <button type="submit" className="btn btn--primary">
                  Run sync now
                </button>
              </form>
            ) : null}
          </>
        ) : (
          <div className="empty">No EA connection yet.</div>
        )}
      </section>
    </div>
  );
}
