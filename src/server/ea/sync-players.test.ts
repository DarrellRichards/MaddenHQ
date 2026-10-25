import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { dedupeExportPlayers } from "./player-dedupe";

describe("dedupeExportPlayers", () => {
  it("keeps one row per rosterId", () => {
    const rows = dedupeExportPlayers([
      {
        rosterId: "10",
        firstName: "Pat",
        lastName: "Mahomes",
        position: "QB",
        teamAbbr: "KC",
        overall: 97,
      },
      {
        rosterId: "10",
        firstName: "Patrick",
        lastName: "Mahomes",
        position: "QB",
        teamAbbr: "KC",
        overall: 98,
      },
    ]);
    assert.equal(rows.length, 1);
    assert.equal(rows[0].firstName, "Patrick");
    assert.equal(rows[0].overall, 98);
  });

  it("dedupes nameless-roster rows by name key", () => {
    const rows = dedupeExportPlayers([
      {
        firstName: "Josh",
        lastName: "Allen",
        position: "QB",
        teamAbbr: "BUF",
      },
      {
        firstName: "Josh",
        lastName: "Allen",
        position: "QB",
        teamAbbr: "BUF",
        overall: 97,
      },
      {
        firstName: "Josh",
        lastName: "Allen",
        position: "HB",
        teamAbbr: "BUF",
      },
    ]);
    assert.equal(rows.length, 2);
  });
});
