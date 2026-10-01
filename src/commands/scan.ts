import type { BaseReport, ScanOptions } from "../types.js";
import { createScanContext } from "../context.js";
import { createReport, uniqueFindings } from "../report/findings.js";
import { checkActions } from "../scanners/actions.js";
import { scanApiRoutes } from "../scanners/apiRoutes.js";
import { scanDeployConfig } from "../scanners/deploy.js";
import { checkMcp } from "../scanners/mcp.js";
import { scanNextPublicEnv, scanSecrets } from "../scanners/secrets.js";
import { scanSilentSuccess } from "../scanners/silentSuccess.js";
import { checkStripe } from "../scanners/stripe.js";
import { checkSupabase } from "../scanners/supabase.js";
import { detectStackInventory } from "../stackInventory.js";

export async function scanRepository(options: ScanOptions): Promise<BaseReport> {
  const context = await createScanContext(options.rootDir);
  const stackInventory = await detectStackInventory(context);
  const [
    secretFindings,
    nextPublicFindings,
    stripeReport,
    supabaseReport,
    mcpReport,
    apiFindings,
    deployFindings,
    silentSuccessFindings,
    actionsReport
  ] =
    await Promise.all([
      scanSecrets(context),
      scanNextPublicEnv(context),
      checkStripe(context),
      // Never gate on the stack inventory: it only recognizes standard
      // layouts (supabase/ paths, package deps, policy syntax), so SQL
      // migrations in non-standard paths would silently skip every Supabase
      // rule while the scan still reported clear. checkSupabase already
      // returns an empty report when it finds no Supabase context.
      checkSupabase(context),
      checkMcp(context),
      scanApiRoutes(context),
      scanDeployConfig(context),
      scanSilentSuccess(context),
      checkActions(context)
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
      ...deployFindings,
      ...silentSuccessFindings,
      ...actionsReport.findings
    ]),
    { stackInventory, fileCollection: context.fileCollection }
  );
}
