import type { SupabaseOptions, SupabaseReport } from "../types.js";
import { checkSupabase as runSupabaseScanner } from "../scanners/supabase.js";

export function checkSupabase(options: SupabaseOptions): Promise<SupabaseReport> {
  return runSupabaseScanner(options.rootDir, { doctor: options.doctor });
}
