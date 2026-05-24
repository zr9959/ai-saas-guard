import { prisma } from "@/lib/prisma";

export async function GET() {
  await prisma.subscription.updateMany({
    where: { status: "trialing" },
    data: { status: "active" }
  });

  return Response.json({ ok: true });
}
