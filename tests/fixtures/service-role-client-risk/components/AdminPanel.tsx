"use client";

import { createClient } from "@supabase/supabase-js";

// NEXT_PUBLIC_ variables are inlined into the browser bundle at build time:
// this ships the service role key to every visitor.
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY!
);

export default function AdminPanel() {
  return <button onClick={() => supabase.from("accounts").select("*")}>Load all accounts</button>;
}
