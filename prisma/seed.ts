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
    { teamAbbr: "BUF", firstName: "Von", lastName: "Miller", position: "LOLB", jerseyNumber: 40, overall: 88 },
    { teamAbbr: "SF", firstName: "Christian", lastName: "McCaffrey", position: "HB", jerseyNumber: 23, overall: 97 },
    { teamAbbr: "PHI", firstName: "Jalen", lastName: "Hurts", position: "QB", jerseyNumber: 1, overall: 94 },
    { teamAbbr: "PHI", firstName: "Darius", lastName: "Slay", position: "CB", jerseyNumber: 2, overall: 89 },
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

  const game =
    (await prisma.game.findFirst({
      where: {
        weekId: week.id,
        homeTeamId: teamIds.KC,
        awayTeamId: teamIds.BUF,
      },
    })) ??
    (await prisma.game.create({
      data: {
        seasonId: season.id,
        weekId: week.id,
        homeTeamId: teamIds.KC,
        awayTeamId: teamIds.BUF,
        homeScore: 31,
        awayScore: 27,
        status: "final",
      },
    }));

  await prisma.game.update({
    where: { id: game.id },
    data: { homeScore: 31, awayScore: 27, status: "final" },
  });

  // Second NFC matchup so conference POTW and standings have more signal.
  const nfcGame =
    (await prisma.game.findFirst({
      where: {
        weekId: week.id,
        homeTeamId: teamIds.PHI,
        awayTeamId: teamIds.SF,
      },
    })) ??
    (await prisma.game.create({
      data: {
        seasonId: season.id,
        weekId: week.id,
        homeTeamId: teamIds.PHI,
        awayTeamId: teamIds.SF,
        homeScore: 24,
        awayScore: 20,
        status: "final",
      },
    }));

  const mahomes = await prisma.player.findFirstOrThrow({
    where: { leagueId: league.id, lastName: "Mahomes" },
  });
  const allen = await prisma.player.findFirstOrThrow({
    where: { leagueId: league.id, lastName: "Allen" },
  });
  const mccaffrey = await prisma.player.findFirstOrThrow({
    where: { leagueId: league.id, lastName: "McCaffrey" },
  });
  const hurts = await prisma.player.findFirstOrThrow({
    where: { leagueId: league.id, lastName: "Hurts" },
  });
  const miller = await prisma.player.findFirstOrThrow({
    where: { leagueId: league.id, lastName: "Miller" },
  });
  const slay = await prisma.player.findFirstOrThrow({
    where: { leagueId: league.id, lastName: "Slay" },
  });

  await prisma.player.update({
    where: { id: mahomes.id },
    data: { yearsPro: 9 },
  });
  await prisma.player.update({
    where: { id: allen.id },
    data: { yearsPro: 8 },
  });
  await prisma.player.update({
    where: { id: mccaffrey.id },
    data: { yearsPro: 9 },
  });
  await prisma.player.update({
    where: { id: hurts.id },
    data: { yearsPro: 6 },
  });
  await prisma.player.update({
    where: { id: miller.id },
    data: { yearsPro: 14 },
  });
  await prisma.player.update({
    where: { id: slay.id },
    data: { yearsPro: 12 },
  });

  await prisma.playerGameStat.upsert({
    where: { gameId_playerId: { gameId: game.id, playerId: mahomes.id } },
    create: {
      gameId: game.id,
      playerId: mahomes.id,
      teamId: teamIds.KC,
      stats: { passYds: 312, passTd: 3, int: 0, passAtt: 35, passComp: 26, rushYds: 18, rushTd: 0 },
    },
    update: {
      stats: { passYds: 312, passTd: 3, int: 0, passAtt: 35, passComp: 26, rushYds: 18, rushTd: 0 },
    },
  });
  await prisma.playerGameStat.upsert({
    where: { gameId_playerId: { gameId: game.id, playerId: allen.id } },
    create: {
      gameId: game.id,
      playerId: allen.id,
      teamId: teamIds.BUF,
      stats: { passYds: 278, passTd: 2, int: 1, passAtt: 33, passComp: 22, rushYds: 44, rushTd: 1 },
    },
    update: {
      stats: { passYds: 278, passTd: 2, int: 1, passAtt: 33, passComp: 22, rushYds: 44, rushTd: 1 },
    },
  });
  await prisma.playerGameStat.upsert({
    where: { gameId_playerId: { gameId: nfcGame.id, playerId: mccaffrey.id } },
    create: {
      gameId: nfcGame.id,
      playerId: mccaffrey.id,
      teamId: teamIds.SF,
      stats: { rushYds: 122, rushTd: 1, rushAtt: 22, rec: 5, recYds: 48, recTd: 1 },
    },
    update: {
      stats: { rushYds: 122, rushTd: 1, rushAtt: 22, rec: 5, recYds: 48, recTd: 1 },
    },
  });
  await prisma.playerGameStat.upsert({
    where: { gameId_playerId: { gameId: nfcGame.id, playerId: hurts.id } },
    create: {
      gameId: nfcGame.id,
      playerId: hurts.id,
      teamId: teamIds.PHI,
      stats: { passYds: 241, passTd: 2, int: 0, passAtt: 28, passComp: 19, rushYds: 55, rushTd: 1 },
    },
    update: {
      stats: { passYds: 241, passTd: 2, int: 0, passAtt: 28, passComp: 19, rushYds: 55, rushTd: 1 },
    },
  });
  await prisma.playerGameStat.upsert({
    where: { gameId_playerId: { gameId: game.id, playerId: miller.id } },
    create: {
      gameId: game.id,
      playerId: miller.id,
      teamId: teamIds.BUF,
      stats: { tackles: 7, sacks: 2, defInt: 0, ff: 1 },
    },
    update: {
      stats: { tackles: 7, sacks: 2, defInt: 0, ff: 1 },
    },
  });
  await prisma.playerGameStat.upsert({
    where: { gameId_playerId: { gameId: nfcGame.id, playerId: slay.id } },
    create: {
      gameId: nfcGame.id,
      playerId: slay.id,
      teamId: teamIds.PHI,
      stats: { tackles: 5, sacks: 0, defInt: 2, ff: 0 },
    },
    update: {
      stats: { tackles: 5, sacks: 0, defInt: 2, ff: 0 },
    },
  });

  console.log("Seeded demo user, league, teams, players, Week 1 games, and player stats.");
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
