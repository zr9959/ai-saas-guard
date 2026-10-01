import { createClient } from "@supabase/supabase-js";
import { NextResponse } from "next/server";

// Route handler runs on the server: service role usage is legitimate here.
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET() {
  const { data } = await supabase.from("accounts").select("id").limit(5);
  return NextResponse.json({ ok: true, count: (data ?? []).length });
}
