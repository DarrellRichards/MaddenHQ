import { notFound, redirect } from "next/navigation";
import { MembershipRole } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { triggerSyncAction } from "@/app/actions/leagues";
import {
  discoverEaPersonasAction,
  retryEaLeagueListAction,
  selectEaLeagueAction,
  selectEaPersonaAction,
} from "@/app/actions/ea-connect";
import { getEaClient } from "@/server/ea";
import {
  getPendingEaTokens,
  getPendingLeagues,
  getPendingPersonas,
} from "@/server/ea/pending-cookie";

export default async function SyncPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ step?: string; error?: string }>;
}) {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const { slug } = await params;
  const { step, error } = await searchParams;
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

  const client = getEaClient();
  const loginUrl = client.getLoginUrl();
  const mode = process.env.EA_CLIENT_MODE ?? "stub";

  const pendingPersonas = step === "persona" ? await getPendingPersonas() : [];
  const pendingTokens = step === "league" ? await getPendingEaTokens() : null;
  const pendingLeagues = step === "league" ? await getPendingLeagues() : [];
  const activeStep = step ?? "connect";

  return (
    <div className="stack">
      <section className="panel stack">
        <h2 className="display" style={{ marginTop: 0, fontSize: "1.05rem" }}>
          Connect EA
        </h2>
        <p className="muted" style={{ margin: 0 }}>
          MaddenHQ does <strong>not</strong> store your EA password. Open EA login, paste
          the <code>http://127.0.0.1/...</code> callback URL, pick your persona and league.
          Tokens are encrypted at rest. Mode: <code>{mode}</code> (set{" "}
          <code>EA_CLIENT_MODE=live</code> for real Companion/Blaze sync).
        </p>

        {error ? (
          <div
            className="panel"
            style={{ borderColor: "var(--accent)", color: "var(--accent)", margin: 0 }}
          >
            <strong>EA sync issue:</strong> {error}
            <p className="muted" style={{ margin: "0.5rem 0 0", color: "inherit" }}>
              EA sometimes returns temporary server errors. Retry in a minute, or enter your
              EA league id manually below if you already know it.
            </p>
          </div>
        ) : null}

        {!canManage ? (
          <div className="empty">Only commissioners can connect EA for this league.</div>
        ) : activeStep === "persona" ? (
          <form action={selectEaPersonaAction} className="form-grid">
            <input type="hidden" name="leagueId" value={league.id} />
            <input type="hidden" name="slug" value={slug} />
            <label>
              Madden persona
              <select name="personaId" required defaultValue="">
                <option value="" disabled>
                  Select persona…
                </option>
                {pendingPersonas.map((persona) => (
                  <option key={persona.personaId} value={persona.personaId}>
                    {persona.displayName} · {persona.console}
                  </option>
                ))}
              </select>
            </label>
            <button type="submit" className="btn btn--accent">
              Continue
            </button>
          </form>
        ) : activeStep === "league" ? (
          <div className="stack">
            {pendingLeagues.length > 0 ? (
              <form action={selectEaLeagueAction} className="form-grid">
                <input type="hidden" name="leagueId" value={league.id} />
                <input type="hidden" name="slug" value={slug} />
                <label>
                  EA franchise league
                  <select name="eaLeagueId" required defaultValue="">
                    <option value="" disabled>
                      Select league…
                    </option>
                    {pendingLeagues.map((entry) => (
                      <option key={entry.id} value={entry.id}>
                        {entry.name}
                        {entry.seasonText ? ` · ${entry.seasonText}` : ""}
                      </option>
                    ))}
                  </select>
                </label>
                <button type="submit" className="btn btn--accent">
                  Save EA connection
                </button>
              </form>
            ) : (
              <>
                <div className="empty">
                  No EA leagues were loaded
                  {pendingTokens ? " (session is saved)." : "."} Retry the Blaze list, or
                  paste the numeric EA league id if you already know it.
                </div>
                <form action={retryEaLeagueListAction}>
                  <input type="hidden" name="leagueId" value={league.id} />
                  <input type="hidden" name="slug" value={slug} />
                  <button type="submit" className="btn btn--primary">
                    Retry league list
                  </button>
                </form>
                <form action={selectEaLeagueAction} className="form-grid">
                  <input type="hidden" name="leagueId" value={league.id} />
                  <input type="hidden" name="slug" value={slug} />
                  <label>
                    EA league id (manual)
                    <input name="eaLeagueId" required placeholder="e.g. 2890093" />
                  </label>
                  <button type="submit" className="btn btn--accent">
                    Save with manual league id
                  </button>
                </form>
              </>
            )}
          </div>
        ) : (
          <div className="stack">
            <a
              href={loginUrl}
              className="btn btn--primary"
              target="_blank"
              rel="noreferrer"
            >
              Open EA login
            </a>
            <form action={discoverEaPersonasAction} className="form-grid">
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
                Continue with callback URL
              </button>
            </form>
          </div>
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
                  <th>EA league</th>
                  <td>
                    {league.eaConnection.eaLeagueName ?? "—"}
                    {league.eaConnection.eaLeagueId
                      ? ` (${league.eaConnection.eaLeagueId})`
                      : ""}
                  </td>
                </tr>
                <tr>
                  <th>Console</th>
                  <td>{league.eaConnection.console ?? "—"}</td>
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
                  <td>{mode}</td>
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
