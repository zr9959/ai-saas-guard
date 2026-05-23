import { execFile } from "node:child_process";
import { promisify } from "node:util";
import type { Finding, PrRiskCategory, PrRiskFile, PrRiskOptions, PrRiskReport } from "../types.js";
import { createReport, finding } from "../report/findings.js";

const execFileAsync = promisify(execFile);

const categoryWeights: Record<PrRiskCategory, number> = {
  "auth/session": 30,
  "billing/subscription": 30,
  "database schema/migration": 24,
  "RLS/policy": 35,
  "API contract": 16,
  "env/secrets/deploy": 24,
  "permissions/storage": 20,
  "tests removed or weakened": 28,
  "large AI-generated/refactor-like diff": 18
};

export async function classifyPrRisk(options: PrRiskOptions): Promise<PrRiskReport> {
  const diffText = options.diffText ?? (await readGitDiff(options.rootDir, options.base));
  const files = parseDiffFiles(diffText);
  const categories = new Set<PrRiskCategory>();
  const findings: Finding[] = [];

  for (const file of files) {
    for (const category of file.categories) {
      categories.add(category);
    }
  }

  const topRiskyFiles = files
    .map((file) => ({
      ...file,
      score:
        file.categories.reduce((total, category) => total + categoryWeights[category], 0) +
        Math.min(30, Math.ceil((file.added + file.removed) / 20)) +
        (/^(app\/api|pages\/api)\//.test(file.path) ? 24 : 0)
    }))
    .filter((file) => file.categories.length > 0 && file.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  for (const file of topRiskyFiles.slice(0, 5)) {
    findings.push(
      finding({
        ruleId: "pr-risk.sensitive-surface",
        title: `Review first: ${file.path}`,
        severity: file.score >= 70 ? "high" : "medium",
        evidence: [{ file: file.path, match: file.categories.join(", ") }],
        why: "AI-generated PRs often bury trust-boundary changes inside larger diffs; this file touches sensitive surfaces.",
        suggestedVerification: `Review this file for ${file.categories.join(", ")} and confirm tests cover the changed behavior.`,
        suggestedFix: "Split unrelated UI/refactor work away from trust-boundary changes and add focused tests before merge."
      })
    );
  }

  if (diffText.trim().length === 0) {
    findings.push(
      finding({
        ruleId: "pr-risk.no-diff",
        title: "No git diff found",
        severity: "info",
        evidence: [{ file: "." }],
        why: "PR risk classification needs a diff to identify changed trust boundaries.",
        suggestedVerification: "Run with unstaged/staged changes, or pass `--base <branch>` against a branch with changes.",
        suggestedFix: "No code fix required."
      })
    );
  }

  const categoryList = [...categories].sort((a, b) => categoryWeights[b] - categoryWeights[a]);

  return createReport<PrRiskReport>("pr-risk", options.rootDir, findings, {
    categories: categoryList,
    topRiskyFiles,
    reviewChecklist: buildReviewChecklist(categoryList),
    suggestedSplit: buildSplitPlan(categoryList),
    requiredTests: buildRequiredTests(categoryList)
  });
}

async function readGitDiff(rootDir: string, base?: string): Promise<string> {
  if (base) {
    try {
      const { stdout } = await execFileAsync("git", ["diff", `${base}...HEAD`], { cwd: rootDir, maxBuffer: 20 * 1024 * 1024 });
      return stdout;
    } catch {
      return "";
    }
  }

  const parts: string[] = [];
  for (const args of [
    ["diff", "--cached"],
    ["diff"]
  ]) {
    try {
      const { stdout } = await execFileAsync("git", args, { cwd: rootDir, maxBuffer: 20 * 1024 * 1024 });
      parts.push(stdout);
    } catch {
      continue;
    }
  }
  return parts.join("\n");
}

function parseDiffFiles(diffText: string): PrRiskFile[] {
  const files: PrRiskFile[] = [];
  let current: (PrRiskFile & { lines: string[] }) | undefined;

  for (const line of diffText.split(/\r?\n/)) {
    const fileMatch = /^diff --git a\/(.+?) b\/(.+)$/.exec(line);
    if (fileMatch) {
      if (current) files.push(finalizeDiffFile(current));
      current = {
        path: fileMatch[2],
        score: 0,
        categories: [],
        added: 0,
        removed: 0,
        lines: []
      };
      continue;
    }

    if (!current) continue;
    current.lines.push(line);
    if (line.startsWith("+") && !line.startsWith("+++")) current.added += 1;
    if (line.startsWith("-") && !line.startsWith("---")) current.removed += 1;
  }

  if (current) files.push(finalizeDiffFile(current));
  return files;
}

function finalizeDiffFile(file: PrRiskFile & { lines: string[] }): PrRiskFile {
  const changedLines = file.lines
    .filter((line) => (line.startsWith("+") && !line.startsWith("+++")) || (line.startsWith("-") && !line.startsWith("---")))
    .map((line) => line.slice(1));
  const changedText = changedLines.join("\n");
  const searchableText = `${file.path}\n${changedText}`;
  const categories = new Set<PrRiskCategory>();

  if (isGitHubAutomationFile(file.path)) {
    categories.add("env/secrets/deploy");
    if (/\b(permissions?|storage|contents|actions|security-events|id-token)\b/i.test(searchableText)) {
      categories.add("permissions/storage");
    }
  } else if (!isTestFile(file.path)) {
    if (isAuthSurface(file.path) || (isAppSurface(file.path) && /\b(auth|session|jwt|cookie|middleware|login|user_id|owner_id|tenant_id)\b/i.test(changedText))) {
      categories.add("auth/session");
    }
    if (
      isBillingSurface(file.path) ||
      (isAppSurface(file.path) && /\b(stripe|billing|subscription|invoice|payment|webhook|entitlement)\b|checkout\.session/i.test(changedText))
    ) {
      categories.add("billing/subscription");
    }
    if (isDatabaseSurface(file.path) || /^\s*(create|alter)\s+table\b/im.test(changedText)) categories.add("database schema/migration");
    if (isRlsSurface(file.path) && /(row level security|create policy|using\s*\(\s*true\s*\)|\brls\b|policy)/i.test(changedText)) {
      categories.add("RLS/policy");
    }
    if (isApiSurface(file.path) || (isAppSurface(file.path) && /\b(Request|Response|Response\.json|NextRequest|NextResponse)\b/.test(changedText))) categories.add("API contract");
    if (isEnvDeploySurface(file.path) || /\b(process\.env|import\.meta\.env)\b/.test(changedText)) categories.add("env/secrets/deploy");
    if (isPermissionSurface(file.path) || /^\s*(grant|revoke)\b/im.test(changedText)) categories.add("permissions/storage");
  }

  if (isRemovedOrWeakenedTest(file.path, file.lines)) {
    categories.add("tests removed or weakened");
  }
  if (file.added + file.removed > 400 || /(^|\/)(__generated__|generated)(\/|\.|-|$)/i.test(file.path)) {
    categories.add("large AI-generated/refactor-like diff");
  }

  return {
    path: file.path,
    score: 0,
    categories: [...categories],
    added: file.added,
    removed: file.removed
  };
}

function isGitHubAutomationFile(filePath: string): boolean {
  return filePath === "action.yml" || filePath === "action.yaml" || filePath.startsWith(".github/workflows/") || filePath.startsWith(".github/actions/");
}

function isTestFile(filePath: string): boolean {
  return /(^|\/)(__tests__|tests?|specs?)\//i.test(filePath) || /\.(test|spec)\.[cm]?[jt]sx?$/i.test(filePath);
}

function isAppSurface(filePath: string): boolean {
  return /^(app|pages|src\/app|src\/pages)\//.test(filePath) || /(^|\/)(api|server|routes?)\//i.test(filePath) || /(^|\/)(route|middleware)\.[cm]?[jt]sx?$/i.test(filePath);
}

function isApiSurface(filePath: string): boolean {
  return /^(app|pages|src\/app|src\/pages)\/api\//.test(filePath) || /(^|\/)(api|routes?)\//i.test(filePath) || /(^|\/)route\.[cm]?[jt]sx?$/i.test(filePath);
}

function isAuthSurface(filePath: string): boolean {
  return /(^|\/)(auth|session|middleware)(\/|\.|-|$)/i.test(filePath);
}

function isBillingSurface(filePath: string): boolean {
  return /(^|\/)(stripe|billing|subscription|invoice|payment|webhook|entitlement)(\/|\.|-|$)/i.test(filePath);
}

function isDatabaseSurface(filePath: string): boolean {
  return /(^|\/)(migrations?|schema\.prisma|db\/schema)|\.sql$/i.test(filePath);
}

function isRlsSurface(filePath: string): boolean {
  return /(^|\/)(supabase|migrations?|policies?)\//i.test(filePath) || /\.sql$/i.test(filePath);
}

function isEnvDeploySurface(filePath: string): boolean {
  return /(^|\/)(\.env|\.env\.[^/]+|vercel\.json|netlify\.toml|Dockerfile|docker-compose|wrangler\.(toml|jsonc?)|next\.config\.[cm]?[jt]s)$/i.test(filePath);
}

function isPermissionSurface(filePath: string): boolean {
  return /(^|\/)(storage|roles?|permissions?)\//i.test(filePath);
}

function isRemovedOrWeakenedTest(filePath: string, lines: string[]): boolean {
  const hasRemovedLine = lines.some((line) => line.startsWith("-") && !line.startsWith("---"));
  if (!hasRemovedLine) return false;
  return (
    lines.some((line) => /^deleted file mode\b/.test(line)) ||
    isTestFile(filePath) ||
    lines.some((line) => /^-\s*(test|describe)\s*\(/i.test(line) || /^-\s*(expect|assert)\b/i.test(line))
  );
}

function buildReviewChecklist(categories: PrRiskCategory[]): string[] {
  const checklist = ["Review the top risky files before cosmetic or refactor files."];
  if (categories.includes("auth/session")) checklist.push("Confirm every changed resource query is scoped by current user, owner, tenant, or membership.");
  if (categories.includes("billing/subscription")) checklist.push("Confirm Stripe webhooks verify signatures, handle failure/cancel/update paths, and are idempotent.");
  if (categories.includes("RLS/policy")) checklist.push("Inspect every changed policy for `USING (true)` and missing `auth.uid()` ownership checks.");
  if (categories.includes("env/secrets/deploy")) checklist.push("Check env/deploy changes for public secrets, missing production vars, and runtime mismatches.");
  if (categories.includes("tests removed or weakened")) checklist.push("Require reviewer explanation for removed or weakened tests before merge.");
  return checklist;
}

function buildSplitPlan(categories: PrRiskCategory[]): string[] {
  const splitPlan = [];
  if (categories.includes("auth/session") || categories.includes("RLS/policy")) splitPlan.push("Split auth/RLS policy changes into a dedicated PR with two-account authorization evidence.");
  if (categories.includes("billing/subscription")) splitPlan.push("Split Stripe/billing changes into a dedicated PR with webhook replay evidence.");
  if (categories.includes("env/secrets/deploy")) splitPlan.push("Split deploy/env changes into a small PR reviewed with production configuration owners.");
  if (splitPlan.length === 0) splitPlan.push("No split required by current heuristic; keep review focused on listed risky files.");
  return splitPlan;
}

function buildRequiredTests(categories: PrRiskCategory[]): string[] {
  const tests = [];
  if (categories.includes("auth/session") || categories.includes("RLS/policy")) tests.push("Run a two-account IDOR test for read, update, and delete on changed resources.");
  if (categories.includes("billing/subscription")) tests.push("Replay Stripe checkout success, invoice.payment_failed, subscription.updated, subscription.deleted, and refund events.");
  if (categories.includes("API contract")) tests.push("Add or update API tests for changed status codes, request shape, and response shape.");
  if (categories.includes("env/secrets/deploy")) tests.push("Run production build and verify required env vars exist in CI/Vercel.");
  if (categories.includes("tests removed or weakened")) tests.push("Replace removed coverage with an equivalent regression test or document why it is obsolete.");
  return tests;
}
