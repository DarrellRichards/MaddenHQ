import assert from "node:assert/strict";
import { test } from "node:test";
import { calculateMessageAuth } from "./message-auth";

test("calculateMessageAuth is deterministic for fixed random bytes", () => {
  const rand = Buffer.from("01020304", "hex");
  const first = calculateMessageAuth(12345, 1, rand);
  const second = calculateMessageAuth(12345, 1, rand);
  assert.equal(first.authData, second.authData);
  assert.equal(first.authCode, second.authCode);
  assert.equal(first.authType, 17039361);
  assert.ok(first.authData.length > 8);
  assert.ok(first.authCode.length > 8);
});

test("calculateMessageAuth changes when requestId changes", () => {
  const rand = Buffer.from("aabbccdd", "hex");
  const a = calculateMessageAuth(99, 1, rand);
  const b = calculateMessageAuth(99, 2, rand);
  assert.notEqual(a.authData, b.authData);
});
