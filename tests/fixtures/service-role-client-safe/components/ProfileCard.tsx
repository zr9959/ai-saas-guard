"use client";

import { createClient } from "@supabase/supabase-js";

// Client component, but only the anon key is used: RLS still applies.
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);

export default function ProfileCard() {
  return <button onClick={() => supabase.from("profiles").select("*")}>Load profile</button>;
}
