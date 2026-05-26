import { verifyAgentScopeToken } from "@/lib/agent-scope-token";

export async function GET(request: Request, { params }) {
  const authorization = request.headers.get("authorization");
  const agent = await verifyAgentScopeToken(authorization, {
    runId: params.runId,
    scopes: ["content-agent:read"]
  });

  return Response.json({ runId: params.runId, agentId: agent.id });
}
