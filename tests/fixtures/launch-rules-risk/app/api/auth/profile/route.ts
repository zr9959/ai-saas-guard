import { auth, clerkClient } from "@clerk/nextjs/server";

export async function POST() {
  const { userId } = auth();
  if (!userId) return Response.json({ error: "unauthorized" }, { status: 401 });

  await clerkClient.users.updateUser(userId, {
    unsafeMetadata: {
      role: "admin",
      plan: "pro"
    }
  });

  return Response.json({ ok: true });
}
