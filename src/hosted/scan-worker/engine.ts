/**
 * The real scanner engine, running inside the staging source-checkout worker.
 *
 * This is the same rule engine as the CLI: `classifyPrRisk` (the pr-risk
 * review-queue engine) plus the full `scan` suite (secrets, Stripe, Supabase,
 * MCP, API routes, deploy config, silent-success, Actions) executed over an
 * in-memory ScanContext built from SHA-pinned file contents. No filesystem,
 * no child processes, no network: pure deterministic rules over text.
 *
 * Outputs are compacted before leaving the worker: rule ID, severity, file,
 * and line only. Raw source, raw diffs, PR text, matches, and snippets never
 * leave the worker boundary.
 */

import { checkActions } from "../../scanners/actions.js";
import { scanApiRoutes } from "../../scanners/apiRoutes.js";
import { scanDeployConfig } from "../../scanners/deploy.js";
import { classifyPrRisk } from "../../scanners/gitDiff.js";
import { checkMcp } from "../../scanners/mcp.js";
import { scanNextPublicEnv, scanSecrets } from "../../scanners/secrets.js";
import { scanSilentSuccess } from "../../scanners/silentSuccess.js";
import { checkStripe } from "../../scanners/stripe.js";
import { checkSupabase } from "../../scanners/supabase.js";
import { detectStackInventory } from "../../stackInventory.js";
import { summarizeFindings, uniqueFindings } from "../../report/findings.js";
import type { ScanContext } from "../../context.js";
import type { FileCollectionDiagnostics, TextFile } from "../../utils/files.js";
import type { Finding, Severity } from "../../types.js";
import { STAGING_PRIVACY_FLAGS, type SourceFileInput, type ValidatedScanJob } from "./job.js";

export interface CompactFinding {
  ruleId: string;
  severity: Severity;
  file: string;
  line?: number;
}

export interface PrRiskSummary {
  categories: string[];
  topRiskyFiles: Array<{ path: string; score: number; categories: string[] }>;
  reviewChecklist: string[];
}

export interface SourceScanResult {
  jobKey: string;
  status: "completed";
  scannerEngine: "cli-identical";
  scannerVersion: string;
  repositoryFullName: string;
  pullRequestNumber: number;
  baseSha: string;
  headSha: string;
  filesScanned: number;
  startedAt: string;
  completedAt: string;
  durationMs: number;
  stages: Array<{ id: string; ok: boolean }>;
  prRisk: PrRiskSummary;
  summaryCounts: { critical: number; high: number; medium: number; low: number; info: number; total: number };
  compactFindingCount: number;
  compactFindings: CompactFinding[];
  scannerErrors: string[];
  privacy: typeof STAGING_PRIVACY_FLAGS;
}

export const MAX_COMPACT_FINDINGS = 200;

const SCAN_STAGES = ["validate", "pr_risk", "full_scan", "compact"] as const;

function buildScanContext(files: SourceFileInput[]): ScanContext {
  const textFiles: TextFile[] = files.map((file) => ({
    path: file.path,
    absolutePath: file.path,
    content: file.content
  }));
  const diagnostics: FileCollectionDiagnostics = {
    filesScanned: textFiles.length,
    bytesScanned: textFiles.reduce((total, file) => total + file.content.length, 0),
    unreadableFiles: [],
    unreadableDirectories: [],
    skippedLargeFiles: [],
    skippedBudgetFiles: [],
    maxFilesReached: false,
    maxTotalBytesReached: false
  };
  return {
    rootDir: ".",
    files: textFiles,
    filesByPath: new Map(textFiles.map((file) => [file.path, file])),
    fileCollection: diagnostics,
    getFiles: (predicate?: (file: TextFile) => boolean) => (predicate ? textFiles.filter(predicate) : [...textFiles])
  };
}

function compactFinding(finding: Finding): CompactFinding | undefined {
  const evidence = finding.evidence?.[0];
  const file = typeof evidence?.file === "string" && evidence.file.length > 0 ? evidence.file : undefined;
  if (!file) return undefined;
  const compact: CompactFinding = {
    ruleId: finding.ruleId,
    severity: finding.severity,
    file
  };
  if (typeof evidence?.line === "number" && Number.isFinite(evidence.line)) {
    compact.line = evidence.line;
  }
  return compact;
}

export async function runSourceScan(
  job: ValidatedScanJob,
  options: { scannerVersion: string }
): Promise<SourceScanResult> {
  const startedAt = new Date().toISOString();
  const startedMs = Date.now();
  const stages: Array<{ id: string; ok: boolean }> = [{ id: "validate", ok: true }];
  const scannerErrors: string[] = [];

  const context = buildScanContext(job.files);

  // Stage 1: the real pr-risk review-queue engine over the unified diff.
  const prRiskReport = await classifyPrRisk({ rootDir: ".", diffText: job.diffText });
  stages.push({ id: "pr_risk", ok: true });

  // Stage 2: the full CLI `scan` suite over the in-memory file contents.
  const scannerRuns: Array<{ name: string; run: () => Promise<Finding[]> }> = [
    { name: "scanSecrets", run: () => scanSecrets(context) },
    { name: "scanNextPublicEnv", run: () => scanNextPublicEnv(context) },
    { name: "checkStripe", run: async () => (await checkStripe(context)).findings },
    { name: "checkMcp", run: async () => (await checkMcp(context)).findings },
    { name: "scanApiRoutes", run: () => scanApiRoutes(context) },
    { name: "scanDeployConfig", run: () => scanDeployConfig(context) },
    { name: "scanSilentSuccess", run: () => scanSilentSuccess(context) },
    { name: "checkActions", run: async () => (await checkActions(context)).findings }
  ];

  // checkSupabase mirrors the CLI: it only runs when the stack inventory
  // detects Supabase usage in the scanned files.
  const stackInventory = await detectStackInventory(context);
  if (stackInventory.databases.includes("supabase")) {
    scannerRuns.push({ name: "checkSupabase", run: async () => (await checkSupabase(context)).findings });
  }

  const collected: Finding[] = [...prRiskReport.findings];
  for (const scanner of scannerRuns) {
    try {
      const findings = await scanner.run();
      collected.push(...findings);
    } catch (error) {
      scannerErrors.push(`${scanner.name}: ${error instanceof Error ? error.message : "unknown error"}`);
    }
  }
  stages.push({ id: "full_scan", ok: true });

  const merged = uniqueFindings(collected);
  const summary = summarizeFindings(merged);
  const compactFindings: CompactFinding[] = [];
  for (const finding of merged) {
    const compact = compactFinding(finding);
    if (compact) compactFindings.push(compact);
    if (compactFindings.length >= MAX_COMPACT_FINDINGS) break;
  }
  stages.push({ id: "compact", ok: true });

  const completedAt = new Date().toISOString();
  return {
    jobKey: job.jobKey,
    status: "completed",
    scannerEngine: "cli-identical",
    scannerVersion: options.scannerVersion,
    repositoryFullName: job.repositoryFullName,
    pullRequestNumber: job.pullRequestNumber,
    baseSha: job.baseSha,
    headSha: job.headSha,
    filesScanned: job.files.length,
    startedAt,
    completedAt,
    durationMs: Date.now() - startedMs,
    stages,
    prRisk: {
      categories: [...prRiskReport.categories],
      topRiskyFiles: prRiskReport.topRiskyFiles.map((file) => ({
        path: file.path,
        score: file.score,
        categories: [...file.categories]
      })),
      reviewChecklist: [...prRiskReport.reviewChecklist]
    },
    summaryCounts: {
      critical: summary.critical,
      high: summary.high,
      medium: summary.medium,
      low: summary.low,
      info: summary.info,
      total: summary.total
    },
    compactFindingCount: compactFindings.length,
    compactFindings,
    scannerErrors,
    privacy: STAGING_PRIVACY_FLAGS
  };
}

export { SCAN_STAGES };
