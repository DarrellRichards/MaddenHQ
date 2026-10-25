import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  fantasyPoints,
  isDefensePosition,
  isOffensePosition,
  summarizeStats,
} from "./fantasy";
import { computeStandings, winPct } from "./standings";

describe("fantasyPoints", () => {
  it("scores a mixed QB line", () => {
    const points = fantasyPoints({
      passYds: 250,
      passTd: 2,
      int: 1,
      rushYds: 20,
      rushTd: 1,
    });
    // 250/25 + 2*4 - 2 + 20/10 + 6 = 10 + 8 - 2 + 2 + 6 = 24
    assert.equal(points, 24);
  });

  it("summarizes counting stats", () => {
    const text = summarizeStats({ passYds: 300, passTd: 3, passAtt: 30, passComp: 22, int: 0 });
    assert.match(text, /300 pass yds/);
    assert.match(text, /3 TD/);
  });
});

describe("position helpers", () => {
  it("classifies offense and defense", () => {
    assert.equal(isOffensePosition("QB"), true);
    assert.equal(isDefensePosition("MLB"), true);
    assert.equal(isOffensePosition("CB"), false);
  });
});

describe("computeStandings", () => {
  it("tallies wins losses and ties from final games", () => {
    const standings = computeStandings([
      {
        homeTeamId: "a",
        awayTeamId: "b",
        homeScore: 21,
        awayScore: 14,
        status: "final",
      },
      {
        homeTeamId: "a",
        awayTeamId: "c",
        homeScore: 17,
        awayScore: 17,
        status: "final",
      },
      {
        homeTeamId: "b",
        awayTeamId: "c",
        homeScore: null,
        awayScore: null,
        status: "scheduled",
      },
    ]);

    assert.equal(standings.get("a")?.wins, 1);
    assert.equal(standings.get("a")?.ties, 1);
    assert.equal(standings.get("b")?.losses, 1);
    assert.equal(standings.get("c")?.ties, 1);
    assert.ok(winPct(standings.get("a")!) > winPct(standings.get("b")!));
  });
});
