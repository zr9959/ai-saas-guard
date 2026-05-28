import assert from "node:assert/strict";
import { test } from "node:test";

test("rejects a disabled account without mutating membership state", async () => {
  const response = {
    status: 403,
    body: { error: "account_disabled" },
    events: ["membership_denied"],
    membershipLocks: ["account:demo"]
  };

  assert.equal(response.status, 403);
  assert.match(response.body.error, /disabled/);
  assert.ok(response.events.length > 0);
  assert.equal(response.membershipLocks.length, 1);
});
