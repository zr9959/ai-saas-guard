"use client";

import { createClient } from "@supabase/supabase-js";
import { useEffect, useState } from "react";

// AI-generated shortcut: the service role key "works" from the browser, but
// it bypasses every RLS policy for anyone who opens devtools.
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export default function DashboardPage() {
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => {
    supabase.from("accounts").select("*").then(({ data }) => setRows(data ?? []));
  }, []);
  return (
    <ul>
      {rows.map((row) => (
        <li key={row.id}>{row.id}</li>
      ))}
    </ul>
  );
}
