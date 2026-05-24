import { prisma } from "@/lib/prisma";
import { logger } from "@/lib/logger";

export async function GET(request: Request) {
  const authorization = request.headers.get("authorization");
  if (authorization !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }

  const requestId = request.headers.get("x-vercel-id") ?? crypto.randomUUID();
  logger.info({ requestId }, "billing reconcile cron started");

  await prisma.cronRun.upsert({
    where: { idempotencyKey: requestId },
    create: { idempotencyKey: requestId, status: "started" },
    update: { status: "duplicate" }
  });

  return Response.json({ ok: true });
}
