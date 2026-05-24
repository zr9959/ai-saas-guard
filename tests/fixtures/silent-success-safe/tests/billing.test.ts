import { test, expect } from "vitest";

test("returns a checkout session id", async () => {
  const response = await createCheckout({ customerId: "cus_test" });

  expect(response.checkout.id).toMatch(/^cs_/);
  expect(response.checkout.mode).toBe("subscription");
});
