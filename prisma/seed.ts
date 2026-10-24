import { PrismaClient, MembershipRole } from "@prisma/client";
import { hash } from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const passwordHash = await hash(
    process.env.DEV_LOGIN_PASSWORD ?? "maddenhq-dev",
    10,
  );

  const user = await prisma.user.upsert({
    where: { email: process.env.DEV_LOGIN_EMAIL ?? "dev@maddenhq.local" },
    create: {
      email: process.env.DEV_LOGIN_EMAIL ?? "dev@maddenhq.local",
      name: "MaddenHQ Dev",
      passwordHash,
    },
    update: { passwordHash, name: "MaddenHQ Dev" },
  });

  const league = await prisma.league.upsert({
    where: { slug: "demo-cfm" },
    create: {
      name: "MaddenHQ Demo CFM",
      slug: "demo-cfm",
      description: "Sample league so the UI is never empty locally.",
      platform: "playstation",
    },
    update: {
      description: "Sample league so the UI is never empty locally.",
    },
  });

  await prisma.leagueMembership.upsert({
    where: { leagueId_userId: { leagueId: league.id, userId: user.id } },
    create: {
      leagueId: league.id,
      userId: user.id,
      role: MembershipRole.OWNER,
    },
    update: { role: MembershipRole.OWNER },
  });

  const season = await prisma.season.upsert({
    where: { leagueId_year: { leagueId: league.id, year: 2026 } },
    create: {
      leagueId: league.id,
      year: 2026,
      label: "2026 Season",
      isCurrent: true,
    },
    update: { isCurrent: true },
  });

  const week = await prisma.week.upsert({
    where: { seasonId_number: { seasonId: season.id, number: 1 } },
    create: { seasonId: season.id, number: 1, label: "Week 1" },
    update: {},
  });

  const teams = [
    { abbr: "KC", name: "Chiefs", city: "Kansas City", conference: "AFC", division: "West" },
    { abbr: "BUF", name: "Bills", city: "Buffalo", conference: "AFC", division: "East" },
    { abbr: "SF", name: "49ers", city: "San Francisco", conference: "NFC", division: "West" },
    { abbr: "PHI", name: "Eagles", city: "Philadelphia", conference: "NFC", division: "East" },
  ];

  const teamIds: Record<string, string> = {};
  for (const team of teams) {
    const row = await prisma.team.upsert({
      where: { leagueId_abbr: { leagueId: league.id, abbr: team.abbr } },
      create: { leagueId: league.id, ...team },
      update: team,
    });
    teamIds[team.abbr] = row.id;
  }

  const players = [
    { teamAbbr: "KC", firstName: "Patrick", lastName: "Mahomes", position: "QB", jerseyNumber: 15, overall: 98 },
    { teamAbbr: "BUF", firstName: "Josh", lastName: "Allen", position: "QB", jerseyNumber: 17, overall: 97 },
    { teamAbbr: "SF", firstName: "Christian", lastName: "McCaffrey", position: "HB", jerseyNumber: 23, overall: 97 },
    { teamAbbr: "PHI", firstName: "Jalen", lastName: "Hurts", position: "QB", jerseyNumber: 1, overall: 94 },
  ];

  for (const player of players) {
    const existing = await prisma.player.findFirst({
      where: {
        leagueId: league.id,
        firstName: player.firstName,
        lastName: player.lastName,
        position: player.position,
      },
    });
    if (existing) {
      await prisma.player.update({
        where: { id: existing.id },
        data: {
          teamId: teamIds[player.teamAbbr],
          overall: player.overall,
          jerseyNumber: player.jerseyNumber,
        },
      });
    } else {
      await prisma.player.create({
        data: {
          leagueId: league.id,
          teamId: teamIds[player.teamAbbr],
          firstName: player.firstName,
          lastName: player.lastName,
          position: player.position,
          jerseyNumber: player.jerseyNumber,
          overall: player.overall,
        },
      });
    }
  }

  const existingGame = await prisma.game.findFirst({
    where: {
      weekId: week.id,
      homeTeamId: teamIds.KC,
      awayTeamId: teamIds.BUF,
    },
  });

  if (!existingGame) {
    await prisma.game.create({
      data: {
        seasonId: season.id,
        weekId: week.id,
        homeTeamId: teamIds.KC,
        awayTeamId: teamIds.BUF,
        homeScore: 31,
        awayScore: 27,
        status: "final",
      },
    });
  }

  console.log("Seeded demo user, league, teams, players, and Week 1 game.");
  console.log(`Dev login: ${process.env.DEV_LOGIN_EMAIL ?? "dev@maddenhq.local"}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
