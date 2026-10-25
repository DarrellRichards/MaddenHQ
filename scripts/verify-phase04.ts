import { PrismaClient, TradeStatus } from "@prisma/client";
import {
  persistWeeklyAwards,
  suggestWeeklyAwards,
} from "../src/server/awards/weekly";
import { evaluateAndPersistTrade } from "../src/server/trades/evaluate";

async function main() {
  const prisma = new PrismaClient();
  try {
    const league = await prisma.league.findUniqueOrThrow({
      where: { slug: "demo-cfm" },
    });
    const week = await prisma.week.findFirstOrThrow({
      where: { season: { leagueId: league.id, isCurrent: true } },
      orderBy: { number: "desc" },
    });
    const suggestions = await suggestWeeklyAwards({
      leagueId: league.id,
      weekId: week.id,
    });
    await persistWeeklyAwards({ leagueId: league.id, weekId: week.id, suggestions });
    console.log(
      "weekly awards saved:",
      suggestions
        .map(
          (s) =>
            `${s.type}=${s.playerId ? "player" : s.gameId ? "game" : "none"}`,
        )
        .join(", "),
    );

    const mahomes = await prisma.player.findFirstOrThrow({
      where: { leagueId: league.id, lastName: "Mahomes" },
    });
    const allen = await prisma.player.findFirstOrThrow({
      where: { leagueId: league.id, lastName: "Allen" },
    });
    const user = await prisma.user.findFirstOrThrow({
      where: { email: "dev@maddenhq.local" },
    });
    const trade = await prisma.trade.create({
      data: {
        leagueId: league.id,
        proposerId: user.id,
        status: TradeStatus.PROPOSED,
        notes: "phase-04 verify",
        assets: {
          create: [
            { side: "from", teamId: mahomes.teamId!, playerId: mahomes.id },
            { side: "to", teamId: allen.teamId!, playerId: allen.id },
          ],
        },
      },
    });
    const grade = await evaluateAndPersistTrade(trade.id);
    console.log("trade grade:", grade.summary);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
