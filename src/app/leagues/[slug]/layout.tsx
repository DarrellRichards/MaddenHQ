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
      <p className="muted" style={{ marginBottom: "0.35rem", letterSpacing: "0.08em", textTransform: "uppercase", fontSize: "0.75rem", fontWeight: 700 }}>
        League
      </p>
      <h1 className="display" style={{ marginTop: 0 }}>
        {league.name}
      </h1>
      {league.description ? <p className="muted">{league.description}</p> : null}
      <LeagueNav slug={slug} />
      {children}
    </div>
  );
}
