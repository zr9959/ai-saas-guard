export async function POST(request: Request) {
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  await rateLimit(request);
  const payload = await request.json();

  console.info("tenant update", { requestId, tenantId: payload.tenantId });
  await updateTenantBilling(payload.tenantId, process.env.STRIPE_SECRET_KEY);

  return Response.json({ ok: true, requestId });
}

async function updateTenantBilling(tenantId: string, stripeKey?: string) {
  console.log(tenantId, Boolean(stripeKey));
}

async function rateLimit(request: Request) {
  console.log(request.headers.get("x-forwarded-for") ?? "local");
}
