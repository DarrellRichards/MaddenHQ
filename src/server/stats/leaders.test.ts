import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { computeLeaders, parseLeaderCategory } from "./leaders";

describe("computeLeaders", () => {
  const rows = [
    {
      playerId: "p1",
      firstName: "Patrick",
      lastName: "Mahomes",
      position: "QB",
      teamAbbr: "KC",
      stats: { passYds: 300, passTd: 3, int: 0 },
    },
    {
      playerId: "p1",
      firstName: "Patrick",
      lastName: "Mahomes",
      position: "QB",
      teamAbbr: "KC",
      stats: { passYds: 250, passTd: 2, int: 1 },
    },
    {
      playerId: "p2",
      firstName: "Josh",
      lastName: "Allen",
      position: "QB",
      teamAbbr: "BUF",
      stats: { passYds: 280, passTd: 2, int: 0, rushYds: 40, rushTd: 1 },
    },
    {
      playerId: "p3",
      firstName: "Christian",
      lastName: "McCaffrey",
      position: "HB",
      teamAbbr: "SF",
      stats: { rushYds: 120, rushTd: 1, rushAtt: 20, rec: 5, recYds: 40 },
    },
  ];

  it("ranks passing by yards across games", () => {
    const leaders = computeLeaders(rows, "passing");
    assert.equal(leaders[0].playerId, "p1");
    assert.equal(leaders[0].primary, 550);
    assert.equal(leaders[0].secondary, 5);
    assert.equal(leaders[0].tertiary, 1);
    assert.equal(leaders[0].games, 2);
  });

  it("ranks rushing leaders", () => {
    const leaders = computeLeaders(rows, "rushing");
    assert.equal(leaders[0].playerId, "p3");
    assert.equal(leaders[0].primary, 120);
  });

  it("computes fantasy points", () => {
    const leaders = computeLeaders(rows, "fantasy");
    assert.ok(leaders.length >= 2);
    assert.ok(leaders[0].primary >= leaders[1].primary);
  });
});

describe("parseLeaderCategory", () => {
  it("defaults to passing", () => {
    assert.equal(parseLeaderCategory(undefined), "passing");
    assert.equal(parseLeaderCategory("nope"), "passing");
    assert.equal(parseLeaderCategory("defense"), "defense");
  });
});
