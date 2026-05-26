export async function GET(request: Request, { params }) {
  const authorization = request.headers.get("authorization");
  if (authorization !== `Bearer ${process.env.INTERNAL_PROXY_TOKEN}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const upstream = await fetch(`${process.env.INTERNAL_API_BASE}/jobs/${params.jobId}`);
  return Response.json(await upstream.json());
}
