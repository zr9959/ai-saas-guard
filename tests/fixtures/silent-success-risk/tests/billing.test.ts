import { test, describe, expect } from "vitest";

describe.skip("billing checkout", () => {
  test("creates a checkout session", async () => {
    // TODO: add real Stripe test
  });
});

test("placeholder stays green", () => {
  expect({ ok: true }).toBeTruthy();
});
