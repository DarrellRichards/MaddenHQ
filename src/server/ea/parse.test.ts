import assert from "node:assert/strict";
import { test } from "node:test";
import { extractAuthCode } from "./parse";

test("extractAuthCode reads code from full callback URL", () => {
  assert.equal(
    extractAuthCode("http://127.0.0.1/success?code=abc123&foo=1"),
    "abc123",
  );
});

test("extractAuthCode accepts URLs without scheme", () => {
  assert.equal(extractAuthCode("127.0.0.1/success?code=xyz"), "xyz");
});

test("extractAuthCode accepts bare codes", () => {
  assert.equal(extractAuthCode("bare-code"), "bare-code");
});

test("extractAuthCode rejects missing code", () => {
  assert.throws(() => extractAuthCode("http://127.0.0.1/success"), /missing code/);
});
