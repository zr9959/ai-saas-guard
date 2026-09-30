import { NextResponse } from "next/server";

export async function GET(request: Request) {
  const session = await getSession(request);
  const profile = await db.profiles.findUnique({ where: { userId: session.userId } });
  return NextResponse.json(profile, {
    headers: { "Access-Control-Allow-Origin": "*" }
  });
}

async function getSession(request: Request): Promise<{ userId: string }> {
  return { userId: "demo" };
}

const db = {
  profiles: {
    findUnique: async (_args: unknown) => ({ id: "1" })
  }
};
