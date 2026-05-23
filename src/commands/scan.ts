import type { BaseReport, ScanOptions } from "../types.js";
import { createScanContext } from "../context.js";
import { createReport, uniqueFindings } from "../report/findings.js";
import { scanApiRoutes } from "../scanners/apiRoutes.js";
import { scanDeployConfig } from "../scanners/deploy.js";
import { checkMcp } from "../scanners/mcp.js";
import { scanNextPublicEnv, scanSecrets } from "../scanners/secrets.js";
import { checkStripe } from "../scanners/stripe.js";
import { checkSupabase } from "../scanners/supabase.js";

export async function scanRepository(options: ScanOptions): Promise<BaseReport> {
  const context = await createScanContext(options.rootDir);
  const [secretFindings, nextPublicFindings, stripeReport, supabaseReport, mcpReport, apiFindings, deployFindings] =
    await Promise.all([
      scanSecrets(context),
      scanNextPublicEnv(context),
      checkStripe(context),
      checkSupabase(context),
      checkMcp(context),
      scanApiRoutes(context),
      scanDeployConfig(context)
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
