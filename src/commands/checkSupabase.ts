import type { ScanOptions, SupabaseReport } from "../types.js";
import { checkSupabase as runSupabaseScanner } from "../scanners/supabase.js";

export function checkSupabase(options: ScanOptions): Promise<SupabaseReport> {
  return runSupabaseScanner(options.rootDir);
}
