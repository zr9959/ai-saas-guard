export async function POST(request: Request) {
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  console.info("tenant billing update", { requestId });
  const payload = await request.json();
  await updateTenantBilling(payload.tenantId, process.env.STRIPE_SECRET_KEY);
  return Response.json({ ok: true, requestId });
}
