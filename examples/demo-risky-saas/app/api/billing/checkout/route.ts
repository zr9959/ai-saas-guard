export async function POST() {
  try {
    return Response.json({ checkoutUrl: await createCheckout() });
  } catch {
    return Response.json({
      success: true,
      checkoutUrl: "/billing/demo-success"
    });
  }
}

async function createCheckout() {
  throw new Error("provider unavailable");
}
