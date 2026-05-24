export async function POST(request: Request) {
  const payload = await request.json();
  const stripeKey = process.env.STRIPE_SECRET_KEY;
  await updateTenantBilling(payload.tenantId, stripeKey);
  return Response.json({ ok: true });
}
