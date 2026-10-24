import assert from "node:assert/strict";
import { test } from "node:test";
import { slugify } from "./slug";

test("slugify lowercases and hyphenates", () => {
  assert.equal(slugify("Sunday Night CFM"), "sunday-night-cfm");
});

test("slugify strips junk characters", () => {
  assert.equal(slugify("  MaddenHQ!!! League #1 "), "maddenhq-league-1");
});
