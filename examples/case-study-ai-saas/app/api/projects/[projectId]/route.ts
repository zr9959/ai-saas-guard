export async function GET(_request: Request, context: { params: { projectId: string } }) {
  return Response.json({
    project: {
      id: context.params.projectId,
      tenantId: "demo-tenant"
    }
  });
}
