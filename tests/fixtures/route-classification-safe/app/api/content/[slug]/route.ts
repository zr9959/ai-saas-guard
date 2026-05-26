import { getServerSession } from "next-auth";
import { db } from "@/db";

export async function GET(_request: Request, { params }) {
  const session = await getServerSession();
  const article = await db.content.findFirst({
    where: {
      slug: params.slug,
      published: true
    }
  });

  return Response.json({ article, viewer: session?.user?.id ?? null });
}
