export async function POST(request: Request) {
  const requestId = request.headers.get("x-request-id") ?? crypto.randomUUID();
  console.info("checkout", { requestId });
  return Response.json({ ok: true });
}
