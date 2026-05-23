import type { BaseReport, ScanOptions } from "../types.js";
import { createReport, uniqueFindings } from "../report/findings.js";
import { scanApiRoutes } from "../scanners/apiRoutes.js";
import { scanDeployConfig } from "../scanners/deploy.js";
import { checkMcp } from "../scanners/mcp.js";
import { scanNextPublicEnv, scanSecrets } from "../scanners/secrets.js";
import { checkStripe } from "../scanners/stripe.js";
import { checkSupabase } from "../scanners/supabase.js";

export async function scanRepository(options: ScanOptions): Promise<BaseReport> {
  const [secretFindings, nextPublicFindings, stripeReport, supabaseReport, mcpReport, apiFindings, deployFindings] =
    await Promise.all([
      scanSecrets(options.rootDir),
      scanNextPublicEnv(options.rootDir),
      checkStripe(options.rootDir),
      checkSupabase(options.rootDir),
      checkMcp(options.rootDir),
      scanApiRoutes(options.rootDir),
      scanDeployConfig(options.rootDir)
    ]);

  return createReport<BaseReport>(
    "scan",
    options.rootDir,
    uniqueFindings([
      ...secretFindings,
      ...nextPublicFindings,
      ...stripeReport.findings,
      ...supabaseReport.findings,
      ...mcpReport.findings,
      ...apiFindings,
      ...deployFindings
    ]),
    {}
  );
}
