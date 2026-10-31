import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { createLeagueAction } from "@/app/actions/leagues";
import { Button, Panel } from "@/components/ui";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login");
  }

  const memberships = await prisma.leagueMembership.findMany({
    where: { userId: session.user.id },
    include: { league: true },
    orderBy: { createdAt: "desc" },
  });

  return (
    <div className="shell stack">
      <header className="stack stack--tight">
        <h1 className="display page-title">Your leagues</h1>
        <p className="muted">
          Signed in as {session.user.name ?? session.user.email}. Create a league, then
          connect EA from the Sync tab.
        </p>
      </header>

      <Panel title="Create league">
        <form action={createLeagueAction} className="form-grid">
          <label>
            League name
            <input name="name" required placeholder="Sunday Night CFM" />
          </label>
          <label>
            Description
            <textarea name="description" rows={3} placeholder="Optional" />
          </label>
          <label>
            Platform
            <select name="platform" defaultValue="">
              <option value="">Select…</option>
              <option value="playstation">PlayStation</option>
              <option value="xbox">Xbox</option>
              <option value="pc">PC</option>
            </select>
          </label>
          <Button type="submit" variant="accent">
            Create league
          </Button>
        </form>
      </Panel>

      <Panel title="Leagues">
        {memberships.length === 0 ? (
          <div className="empty">No leagues yet. Create one to get started.</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Name</th>
                <th>Role</th>
                <th>Platform</th>
              </tr>
            </thead>
            <tbody>
              {memberships.map((m) => (
                <tr key={m.id}>
                  <td>
                    <Link href={`/leagues/${m.league.slug}`}>{m.league.name}</Link>
                  </td>
                  <td>{m.role}</td>
                  <td>{m.league.platform ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Panel>
    </div>
  );
}
