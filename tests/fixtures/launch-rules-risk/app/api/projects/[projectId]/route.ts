import { auth } from "@clerk/nextjs/server";
import { prisma } from "@/lib/prisma";

export async function PATCH(request: Request, { params }) {
  const session = auth();
  if (!session.userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  const body = await request.json();
  const project = await prisma.project.update({
    where: { id: params.projectId },
    data: { name: body.name }
  });

  return Response.json({ project });
}
