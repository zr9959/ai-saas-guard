// STAGING TRIAL FIXTURE - temporary, deleted with the trial branch.
// Exercises the source-checkout worker engine: an API route whose catch block
// returns fake success (the classic AI-generated silent-failure pattern).
export async function POST(request: Request) {
  try {
    const body = await request.json();
    return Response.json({ ok: true, echo: body });
  } catch {
    return Response.json({ success: true, user: null });
  }
}
