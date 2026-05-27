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
  "silent-success/fake-green": 30,
  "large AI-generated/refactor-like diff": 18
};

interface GitDiffReadResult {
  diffText: string;
  diagnostics: Finding[];
}

export async function classifyPrRisk(options: PrRiskOptions): Promise<PrRiskReport> {
  const diffResult =
    options.diffText === undefined
      ? await readGitDiff(options.rootDir, options.base)
      : { diffText: options.diffText, diagnostics: [] };
  const { diffText } = diffResult;
  const files = parseDiffFiles(diffText);
  const categories = new Set<PrRiskCategory>();
  const findings: Finding[] = [...diffResult.diagnostics];

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

  const hasSpecContextUpdate = files.some((file) => isSpecContextFile(file.path));
  if (!hasSpecContextUpdate) {
    for (const file of topRiskyFiles.filter((candidate) => candidate.categories.some(isTrustBoundaryCategory)).slice(0, 5)) {
      findings.push(
        finding({
          ruleId: "pr-risk.trust-boundary-missing-spec",
          title: `Trust-boundary change lacks nearby spec context: ${file.path}`,
          severity: file.score >= 70 ? "medium" : "low",
          evidence: [{ file: file.path, match: file.categories.join(", ") }],
          why: "AI-generated code can change auth, session, payment, data access, deploy, or tool boundaries without explaining the product decision reviewers need to validate.",
          suggestedVerification:
            "Ask the reviewer checklist questions: what changed at the trust boundary, why this decision, and what manual test proves it?",
          suggestedFix:
            "Add or update a nearby docs/spec/context note before merge, or split the trust-boundary change into a smaller PR with explicit rationale."
        })
      );
    }
  }

  if (diffText.trim().length === 0 && diffResult.diagnostics.length === 0) {
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

async function readGitDiff(rootDir: string, base?: string): Promise<GitDiffReadResult> {
  if (base) {
    const tripleDotArgs = ["diff", `${base}...HEAD`];
    try {
      const { stdout } = await execFileAsync("git", tripleDotArgs, { cwd: rootDir, maxBuffer: 20 * 1024 * 1024 });
      return { diffText: stdout, diagnostics: [] };
    } catch (error) {
      if (isMergeBaseUnavailableError(error)) {
        const directDiffArgs = ["diff", `${base}..HEAD`];
        try {
          const { stdout } = await execFileAsync("git", directDiffArgs, { cwd: rootDir, maxBuffer: 20 * 1024 * 1024 });
          return { diffText: stdout, diagnostics: [] };
        } catch (fallbackError) {
          return {
            diffText: "",
            diagnostics: [buildGitDiffFailureFinding(rootDir, ["git", ...directDiffArgs], fallbackError, base)]
          };
        }
      }
      return {
        diffText: "",
        diagnostics: [buildGitDiffFailureFinding(rootDir, ["git", ...tripleDotArgs], error, base)]
      };
    }
  }

  const parts: string[] = [];
  const failures: Array<{ args: string[]; error: unknown }> = [];
  for (const args of [
    ["diff", "--cached"],
    ["diff"]
  ]) {
    try {
      const { stdout } = await execFileAsync("git", args, { cwd: rootDir, maxBuffer: 20 * 1024 * 1024 });
      parts.push(stdout);
    } catch (error) {
      failures.push({ args: ["git", ...args], error });
    }
  }

  if (parts.length === 0 && failures.length > 0) {
    return {
      diffText: "",
      diagnostics: [buildGitDiffFailureFinding(rootDir, failures[0].args, failures[0].error)]
    };
  }

  return { diffText: parts.join("\n"), diagnostics: [] };
}

function buildGitDiffFailureFinding(rootDir: string, command: string[], error: unknown, base?: string): Finding {
  const errorText = redactRootPath(getGitErrorText(error), rootDir);
  const lowerError = errorText.toLowerCase();
  let suggestedVerification = "Run `git status` and confirm the target path is inside a Git repository.";
  let suggestedFix = "Run `pr-risk` from a Git checkout, or pass explicit diff text through the API.";

  if (base) {
    suggestedVerification = `Run \`${buildFetchCommand(base)}\`, then \`git rev-parse --verify ${base}\` to confirm the base ref exists locally.`;
    suggestedFix = "Fetch the branch or pass an existing local base ref, for example `--base origin/main`.";
  }

  if (base && (lowerError.includes("no merge base") || lowerError.includes("shallow"))) {
    suggestedVerification = "Run `git rev-parse --is-shallow-repository` and confirm CI checks out full history before `pr-risk`.";
    suggestedFix = "Use `fetch-depth: 0` in `actions/checkout`, or run `git fetch --unshallow` before invoking `pr-risk`.";
  }

  return finding({
    ruleId: "pr-risk.diff-unavailable",
    title: base ? `Could not read git diff for base ${base}` : "Could not read git diff",
    severity: "info",
    evidence: [
      {
        file: ".",
        match: command.join(" "),
        snippet: errorText.slice(0, 500)
      }
    ],
    why: "PR risk classification needs a readable git diff, but the git command failed for the target repository.",
    suggestedVerification,
    suggestedFix
  });
}

function isMergeBaseUnavailableError(error: unknown): boolean {
  const lowerError = getGitErrorText(error).toLowerCase();
  return lowerError.includes("no merge base") || lowerError.includes("shallow");
}

function buildFetchCommand(base: string): string {
  const remoteRef = /^([^/\s]+)\/(.+)$/.exec(base);
  if (remoteRef) return `git fetch ${remoteRef[1]} ${remoteRef[2]}`;
  return `git fetch origin ${base}`;
}

function redactRootPath(text: string, rootDir: string): string {
  return rootDir ? text.replaceAll(rootDir, ".") : text;
}

function getGitErrorText(error: unknown): string {
  const candidate = error as { stderr?: string; stdout?: string; message?: string };
  return [candidate.stderr, candidate.stdout, candidate.message]
    .filter((value): value is string => Boolean(value?.trim()))
    .join("\n")
    .trim() || "git diff exited with a non-zero status.";
}

function parseDiffFiles(diffText: string): PrRiskFile[] {
  const files: PrRiskFile[] = [];
  let current: (PrRiskFile & { lines: string[] }) | undefined;

  for (const line of diffText.split(/\r?\n/)) {
    const filePath = parseDiffHeaderPath(line);
    if (filePath) {
      if (current) files.push(finalizeDiffFile(current));
      current = {
        path: filePath,
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

function parseDiffHeaderPath(line: string): string | undefined {
  const prefix = "diff --git a/";
  if (!line.startsWith(prefix)) return undefined;

  const separator = " b/";
  const separatorIndex = line.lastIndexOf(separator);
  if (separatorIndex === -1) return undefined;

  const path = line.slice(separatorIndex + separator.length);
  return path || undefined;
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
  if (hasSilentSuccessChange(file.path, changedText)) {
    categories.add("silent-success/fake-green");
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

function isSpecContextFile(filePath: string): boolean {
  return /^(docs|specs)\//i.test(filePath) || /^(\.claude|\.cursor)\//i.test(filePath) || /(^|\/)(AGENTS|CLAUDE)\.md$/i.test(filePath);
}

function isTrustBoundaryCategory(category: PrRiskCategory): boolean {
  return [
    "auth/session",
    "billing/subscription",
    "database schema/migration",
    "RLS/policy",
    "API contract",
    "env/secrets/deploy",
    "permissions/storage",
    "silent-success/fake-green"
  ].includes(category);
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

function hasSilentSuccessChange(filePath: string, changedText: string): boolean {
  const searchableText = `${filePath}\n${changedText}`;
  const sensitive =
    isTestFile(filePath) ||
    isApiSurface(filePath) ||
    isAuthSurface(filePath) ||
    isBillingSurface(filePath) ||
    isRlsSurface(filePath) ||
    includesAnyWord(searchableText, ["stripe", "supabase", "openai", "payment", "billing", "auth", "session", "webhook", "entitlement"]);
  if (!sensitive) return false;
  return hasCatchFakeSuccess(changedText) || hasWeakTestOrBypassMarker(changedText) || hasMockFallbackSuccess(changedText);
}

function hasCatchFakeSuccess(text: string): boolean {
  const lower = text.toLowerCase();
  return hasKeywordWindowMatch(lower, "catch", 360, (window) => {
    if (!window.includes("{") && !window.includes("=>")) return false;
    return hasFakeSuccessToken(window);
  });
}

function hasWeakTestOrBypassMarker(text: string): boolean {
  const compact = compactAscii(text.toLowerCase());
  if (compact.includes("test.skip(") || compact.includes("describe.skip(") || compact.includes("it.skip(")) return true;
  if (compact.includes("tobetruthy(")) return true;

  const words = normalizeWords(text);
  if (hasWindowMatch(words, "todo", 40, (window) => includesAnyWord(window, ["test", "auth", "verify"]))) return true;
  return (
    words.includes("temporary bypass") ||
    words.includes("skip auth") ||
    words.includes("skip verification") ||
    words.includes("skip validation") ||
    words.includes("skip ownership") ||
    words.includes("skip webhook") ||
    words.includes("disable auth") ||
    words.includes("disable verification") ||
    words.includes("disable validation")
  );
}

function hasMockFallbackSuccess(text: string): boolean {
  const lower = text.toLowerCase();
  for (const marker of ["mock", "fixture", "fixtures", "demo", "sample", "fallback"]) {
    if (
      hasKeywordWindowMatch(lower, marker, 220, (window) => {
        return hasFakeSuccessToken(window) || includesAnyWord(window, ["subscription", "entitlement", "auth"]);
      })
    ) {
      return true;
    }
  }
  return false;
}

function hasFakeSuccessToken(text: string): boolean {
  const compact = compactAscii(text.toLowerCase());
  return (
    compact.includes("success:true") ||
    compact.includes("ok:true") ||
    compact.includes("return{}") ||
    compact.includes("return[]") ||
    compact.includes("returnnull") ||
    compact.includes("returntrue") ||
    compact.includes("user:null")
  );
}

function hasKeywordWindowMatch(text: string, keyword: string, windowSize: number, predicate: (window: string) => boolean): boolean {
  let index = text.indexOf(keyword);
  while (index !== -1) {
    const before = index === 0 ? "" : text[index - 1] ?? "";
    const after = text[index + keyword.length] ?? "";
    if (!isAsciiWordChar(before) && !isAsciiWordChar(after)) {
      const window = text.slice(index, index + windowSize);
      if (predicate(window)) return true;
    }
    index = text.indexOf(keyword, index + keyword.length);
  }
  return false;
}

function hasWindowMatch(text: string, needle: string, windowSize: number, predicate: (window: string) => boolean): boolean {
  let index = text.indexOf(needle);
  while (index !== -1) {
    const window = text.slice(index, index + windowSize);
    if (predicate(window)) return true;
    index = text.indexOf(needle, index + needle.length);
  }
  return false;
}

function isAsciiWordChar(char: string): boolean {
  if (!char) return false;
  const code = char.charCodeAt(0);
  return (code >= 48 && code <= 57) || (code >= 65 && code <= 90) || (code >= 97 && code <= 122) || char === "_";
}

function includesAnyWord(text: string, words: string[]): boolean {
  const normalized = normalizeWords(text);
  return words.some((word) => normalized.includes(` ${word.toLowerCase()} `));
}

function normalizeWords(text: string): string {
  let normalized = " ";
  let lastWasSpace = true;
  for (const char of text.toLowerCase()) {
    const code = char.charCodeAt(0);
    const isWord = (code >= 48 && code <= 57) || (code >= 97 && code <= 122) || char === "_";
    if (isWord) {
      normalized += char;
      lastWasSpace = false;
    } else if (!lastWasSpace) {
      normalized += " ";
      lastWasSpace = true;
    }
  }
  return lastWasSpace ? normalized : `${normalized} `;
}

function compactAscii(text: string): string {
  let compact = "";
  for (const char of text) {
    if (char > " ") compact += char;
  }
  return compact;
}

function buildReviewChecklist(categories: PrRiskCategory[]): string[] {
  const checklist = [
    "Review the top risky files before cosmetic or refactor files.",
    "What changed at the trust boundary?",
    "Why this auth/session/payment/data access decision?",
    "What manual test proves it?"
  ];
  if (categories.includes("auth/session")) checklist.push("Confirm every changed resource query is scoped by current user, owner, tenant, or membership.");
  if (categories.includes("billing/subscription")) checklist.push("Confirm Stripe webhooks verify signatures, handle failure/cancel/update paths, and are idempotent.");
  if (categories.includes("RLS/policy")) checklist.push("Inspect every changed policy for `USING (true)` and missing `auth.uid()` ownership checks.");
  if (categories.includes("env/secrets/deploy")) checklist.push("Check env/deploy changes for public secrets, missing production vars, and runtime mismatches.");
  if (categories.includes("tests removed or weakened")) checklist.push("Require reviewer explanation for removed or weakened tests before merge.");
  if (categories.includes("silent-success/fake-green")) checklist.push("Force upstream failure and confirm the PR does not return fake success, sample data, or placeholder green tests.");
  return checklist;
}

function buildSplitPlan(categories: PrRiskCategory[]): string[] {
  const splitPlan = [];
  if (categories.includes("auth/session") || categories.includes("RLS/policy")) splitPlan.push("Split auth/RLS policy changes into a dedicated PR with two-account authorization evidence.");
  if (categories.includes("billing/subscription")) splitPlan.push("Split Stripe/billing changes into a dedicated PR with webhook replay evidence.");
  if (categories.includes("database schema/migration") || categories.includes("API contract") || categories.includes("permissions/storage")) splitPlan.push("Split data access and API contract changes into a dedicated PR with ownership and tenant evidence.");
  if (categories.includes("env/secrets/deploy")) splitPlan.push("Split deploy/env changes into a small PR reviewed with production configuration owners.");
  if (categories.includes("large AI-generated/refactor-like diff")) splitPlan.push("Split UI-only refactors away from auth, billing, data access, and deploy changes.");
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
  if (categories.includes("silent-success/fake-green")) tests.push("Force the upstream provider or database to fail and confirm the changed path fails visibly without granting access or returning sample data.");
  return tests;
}
