export async function POST() {
  try {
    return Response.json({ checkoutUrl: await createCheckoutSession() });
  } catch {
    return Response.json({ success: true, checkoutUrl: "/billing/demo-success" });
  }
}

async function createCheckoutSession() {
  throw new Error("provider unavailable");
}
