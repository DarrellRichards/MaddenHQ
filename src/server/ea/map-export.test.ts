import assert from "node:assert/strict";
import { test } from "node:test";
import { StageIndex } from "./constants";
import { mapWeekExport } from "./map-export";

test("mapWeekExport builds teams games players and stats", () => {
  const mapped = mapWeekExport({
    leagueId: "1",
    seasonYear: 2026,
    weekNumber: 1,
    stageIndex: StageIndex.SEASON,
    teams: [
      {
        teamId: 10,
        abbrName: "KC",
        cityName: "Kansas City",
        displayName: "Chiefs",
        divName: "AFC West",
      },
      {
        teamId: 20,
        abbrName: "BUF",
        cityName: "Buffalo",
        displayName: "Bills",
        divName: "AFC East",
      },
    ],
    schedules: [
      {
        scheduleId: 1,
        homeTeamId: 10,
        awayTeamId: 20,
        homeScore: 31,
        awayScore: 27,
        status: 3,
      },
    ],
    rosters: [
      {
        rosterId: 100,
        firstName: "Patrick",
        lastName: "Mahomes",
        position: "QB",
        jerseyNum: 15,
        playerBestOvr: 98,
        teamAbbr: "KC",
      },
    ],
    passing: [
      {
        rosterId: 100,
        teamId: 10,
        scheduleId: 1,
        passYds: 312,
        passTDs: 3,
        passInts: 0,
      },
    ],
  });

  assert.equal(mapped.teams.length, 2);
  assert.equal(mapped.games[0]?.status, "final");
  assert.equal(mapped.players[0]?.rosterId, "100");
  assert.equal(mapped.playerGameStats[0]?.stats.passYds, 312);
  assert.equal(mapped.playerGameStats[0]?.homeOrAway, "home");
});
