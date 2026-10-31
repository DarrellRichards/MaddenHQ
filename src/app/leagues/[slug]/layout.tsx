import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { LeagueNav } from "@/components/league-nav";

export default async function LeagueLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const league = await prisma.league.findUnique({ where: { slug } });
  if (!league) notFound();

  return (
    <div className="shell">
      <p className="page-kicker">League</p>
      <h1 className="display page-title">{league.name}</h1>
      {league.description ? <p className="muted">{league.description}</p> : null}
      <LeagueNav slug={slug} />
      {children}
    </div>
  );
}
