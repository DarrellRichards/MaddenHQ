import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isTransientBlazeCode } from "./blaze";

describe("isTransientBlazeCode", () => {
  it("treats ERR_SYSTEM / high-load codes as retryable", () => {
    assert.equal(isTransientBlazeCode(1073807360), true);
    assert.equal(isTransientBlazeCode(67606), true);
  });

  it("rejects unknown and missing codes", () => {
    assert.equal(isTransientBlazeCode(undefined), false);
    assert.equal(isTransientBlazeCode(0), false);
    assert.equal(isTransientBlazeCode(12345), false);
  });
});
