import { createClient } from "@supabase/supabase-js";

// Server component: the service role key never leaves the server.
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default async function DashboardPage() {
  const { data } = await supabase.from("accounts").select("id").limit(10);
  return <pre>{JSON.stringify(data ?? [])}</pre>;
}
