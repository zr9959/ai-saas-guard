import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { dirname, resolve } from "node:path";
import { tmpdir } from "node:os";
import { test } from "node:test";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

import {
  checkActions,
  checkMcp,
  checkStripe,
  checkSupabase,
  classifyPrRisk,
  createScanContext,
  getRuleMetadata,
  RULE_CATALOG,
  scanRepository
} from "../dist/index.js";
import { collectTextFiles } from "../dist/utils/files.js";
import { formatMarkdownReport } from "../dist/report/markdown.js";

const testDir = dirname(fileURLToPath(import.meta.url));
const fixtureRoot = resolve(testDir, "fixtures");
const packageRoot = resolve(testDir, "..");
const execFileAsync = promisify(execFile);

function findingTitles(report) {
  return report.findings.map((finding) => finding.title);
}

function findingRuleIds(report) {
  return report.findings.map((finding) => finding.ruleId);
}

const expectedRuleIds = [
  "actions.checkout.fetch-depth",
  "actions.docs-only-full-ci",
  "actions.permissions.too-broad",
  "actions.pr-missing-concurrency",
  "actions.secrets-missing-failfast",
  "actions.unpinned-action",
  "api.route.auth-without-ownership",
  "api.route.missing-rate-limit",
  "deploy.edge-runtime-node-api",
  "deploy.env.example-missing",
  "deploy.env.public-inventory",
  "deploy.env.server-undocumented",
  "deploy.next.image-cost-risk",
  "deploy.next.missing-security-headers",
  "deploy.next.request-amplification",
  "deploy.next.static-export-api-risk",
  "deploy.observability.missing-request-id",
  "mcp.config.broad-filesystem",
  "mcp.config.insecure-http",
  "mcp.config.invalid-json",
  "mcp.config.loose-permissions",
  "mcp.config.non-local-bind",
  "mcp.config.plaintext-secret",
  "mcp.tool.missing-policy-boundary",
  "mcp.tool.missing-scope",
  "mcp.tool.missing-side-effect-classification",
  "mcp.tool.raw-sql",
  "mcp.tool.shell",
  "next.env.public-secret",
  "pr-risk.diff-unavailable",
  "pr-risk.no-diff",
  "pr-risk.sensitive-surface",
  "pr-risk.trust-boundary-missing-spec",
  "secrets.detected",
  "silent-success.hardcoded-fallback",
  "silent-success.production-mock-data",
  "silent-success.swallowed-error",
  "silent-success.temporary-bypass",
  "silent-success.weakened-test",
  "stripe.webhook.missing-critical-event",
  "stripe.webhook.missing-idempotency",
  "stripe.webhook.missing-route",
  "stripe.webhook.missing-signature",
  "stripe.webhook.no-entitlement-path",
  "stripe.webhook.public-secret",
  "stripe.webhook.raw-body-risk",
  "supabase.rls.broad-policy",
  "supabase.rls.enabled-no-policy",
  "supabase.rls.missing-ownership-filter",
  "supabase.rls.not-enabled",
  "supabase.rls.public-write-policy",
  "supabase.rls.tenant-predicate-missing",
  "supabase.rls.uid-column-mismatch",
  "supabase.rls.weak-with-check",
  "supabase.rls.write-policy-missing",
  "supabase.storage.public-bucket",
  "supabase.table.missing-owner-column"
];

test("scan context exposes one shared text file inventory", async () => {
  const rootDir = resolve(fixtureRoot, "leaked-env");
  const context = await createScanContext(rootDir);

  assert.equal(context.rootDir, rootDir);
  assert.equal(context.filesByPath.get(".env.example")?.path, ".env.example");
  assert.deepEqual(
    context.getFiles((file) => file.path.endsWith(".ts")).map((file) => file.path),
    ["src/client.ts"]
  );
});

test("text file collection can cap file count and total bytes", async () => {
  const rootDir = await mkdtemp(resolve(tmpdir(), "ai-saas-guard-resource-cap-"));
  await writeFile(resolve(rootDir, "a.txt"), "abcd\n");
  await writeFile(resolve(rootDir, "b.txt"), "efgh\n");
  await writeFile(resolve(rootDir, "c.txt"), "ijkl\n");

  const oneFile = await collectTextFiles(rootDir, {
    maxFiles: 1,
    maxTotalBytes: 1024
  });
  const byteCapped = await collectTextFiles(rootDir, {
    maxFiles: 10,
    maxTotalBytes: 6
  });

  assert.equal(oneFile.length, 1);
  assert.ok(byteCapped.reduce((total, file) => total + Buffer.byteLength(file.content), 0) <= 6);
  assert.ok(byteCapped.length < 3);
});

test("generic markdown report keeps attacker-controlled evidence on one escaped line", () => {
  const markdown = formatMarkdownReport({
    command: "scan",
    rootDir: ".",
    generatedAt: "2026-05-24T00:00:00.000Z",
    findings: [
      {
        ruleId: "secrets.detected",
        title: "Injected evidence",
        severity: "high",
        evidence: [
          {
            file: "src/example.ts",
            line: 12,
            snippet: "safe text\n### injected heading | table"
          }
        ],
        why: "why line\nwith break",
        suggestedVerification: "verify line\nwith break",
        suggestedFix: "fix line\nwith break"
      }
    ],
    summary: {
      critical: 0,
      high: 1,
      medium: 0,
      low: 0,
      info: 0,
      total: 1
    }
  });

  assert.doesNotMatch(markdown, /^### injected heading/m);
  assert.match(markdown, /safe text ### injected heading \\| table/);
  assert.match(markdown, /Why: why line with break/);
  assert.match(markdown, /Verify: verify line with break/);
  assert.match(markdown, /Fix direction: fix line with break/);
});

test("rule catalog contains metadata for every published rule", () => {
  assert.deepEqual(Object.keys(RULE_CATALOG).sort(), expectedRuleIds);

  for (const ruleId of expectedRuleIds) {
    const metadata = getRuleMetadata(ruleId);
    assert.equal(metadata?.ruleId, ruleId);
    assert.ok(metadata?.title);
    assert.ok(metadata?.why);
    assert.match(metadata?.stability ?? "", /^(default|experimental|strict)$/);
  }

  const stabilityLevels = new Set(Object.values(RULE_CATALOG).map((metadata) => metadata.stability));
  assert.ok(stabilityLevels.has("strict"));
  assert.ok(stabilityLevels.has("default"));
  assert.ok(stabilityLevels.has("experimental"));
});

test("vulnerable Stripe webhook reports missing signature, idempotency, and critical events", async () => {
  const report = await checkStripe({
    rootDir: resolve(fixtureRoot, "vulnerable-stripe")
  });

  assert.equal(report.command, "check-stripe");
  assert.ok(findingRuleIds(report).includes("stripe.webhook.missing-signature"));
  assert.ok(findingRuleIds(report).includes("stripe.webhook.missing-idempotency"));
  assert.ok(report.missingCriticalEvents.includes("invoice.payment_failed"));
  assert.ok(report.missingCriticalEvents.includes("invoice.payment_action_required"));
  assert.ok(report.missingCriticalEvents.includes("customer.subscription.deleted"));
  assert.ok(report.handledEvents.includes("checkout.session.completed"));
  assert.ok(report.testCommands.some((command) => command.includes("stripe trigger invoice.payment_failed")));
  assert.ok(report.testCommands.some((command) => command.includes("stripe trigger invoice.payment_action_required")));
});

test("safe Stripe webhook recognizes signature verification and billing failure handlers", async () => {
  const report = await checkStripe({
    rootDir: resolve(fixtureRoot, "safe-stripe")
  });

  assert.equal(report.missingCriticalEvents.length, 0);
  assert.ok(report.handledEvents.includes("invoice.payment_failed"));
  assert.ok(report.handledEvents.includes("invoice.payment_action_required"));
  assert.ok(report.handledEvents.includes("customer.subscription.deleted"));
  assert.ok(!findingRuleIds(report).includes("stripe.webhook.missing-signature"));
  assert.ok(!findingRuleIds(report).includes("stripe.webhook.missing-idempotency"));
});

test("Stripe scanner ignores documentation-only mentions", async () => {
  const rootDir = await mkdtemp(resolve(tmpdir(), "ai-saas-guard-docs-only-"));
  await writeFile(resolve(rootDir, "README.md"), "This project might integrate stripe webhooks later.\n");

  const report = await checkStripe({ rootDir });

  assert.equal(report.findings.length, 0);
  assert.equal(report.missingCriticalEvents.length, 0);
});

test("Stripe scanner ignores webhook replay documentation files", async () => {
  const rootDir = await mkdtemp(resolve(tmpdir(), "ai-saas-guard-stripe-docs-"));
  await mkdir(resolve(rootDir, "docs"), { recursive: true });
  await writeFile(
    resolve(rootDir, "docs", "stripe-webhook-replay.md"),
    `# Stripe Webhook Replay Cookbook

stripe listen --forward-to localhost:3000/api/stripe/webhook
stripe trigger checkout.session.completed
stripe trigger invoice.payment_failed
stripe trigger invoice.payment_action_required
stripe trigger customer.subscription.updated
stripe trigger customer.subscription.deleted
stripe trigger charge.refunded
`
  );

  const report = await checkStripe({ rootDir });

  assert.equal(report.findings.length, 0);
  assert.equal(report.missingCriticalEvents.length, 0);
});

test("broad Supabase policy is reported with concrete RLS evidence", async () => {
  const report = await checkSupabase({
    rootDir: resolve(fixtureRoot, "broad-supabase-policy")
  });

  assert.equal(report.command, "check-supabase");
  assert.ok(findingRuleIds(report).includes("supabase.rls.broad-policy"));
  assert.ok(report.riskyPolicies.some((policy) => policy.policyName.includes("public projects")));
  assert.ok(report.manualAuthorizationTest.some((step) => step.includes("User B")));
});

test("safe Supabase policy avoids broad policy and missing ownership findings", async () => {
  const report = await checkSupabase({
    rootDir: resolve(fixtureRoot, "safe-supabase-policy")
  });

  assert.equal(report.riskyPolicies.length, 0);
  assert.ok(!findingRuleIds(report).includes("supabase.rls.broad-policy"));
  assert.ok(!findingRuleIds(report).includes("supabase.rls.missing-ownership-filter"));
});

test("Supabase tenant membership policies are treated as ownership filters", async () => {
  const report = await checkSupabase({
    rootDir: resolve(fixtureRoot, "tenant-membership-supabase")
  });

  assert.deepEqual(report.findings, []);
  assert.deepEqual(report.riskyPolicies, []);
});

test("Supabase scanner flags weak WITH CHECK ownership mistakes", async () => {
  const report = await checkSupabase({
    rootDir: resolve(fixtureRoot, "weak-with-check-supabase")
  });
  const weakWithCheckFindings = report.findings.filter(
    (finding) => finding.ruleId === "supabase.rls.weak-with-check"
  );

  assert.ok(weakWithCheckFindings.length >= 2);
  assert.ok(weakWithCheckFindings.some((finding) => finding.title.includes("members update projects")));
  assert.ok(weakWithCheckFindings.some((finding) => finding.title.includes("members insert documents")));
  assert.ok(weakWithCheckFindings.every((finding) => finding.evidence[0]?.file.endsWith("001_policies.sql")));
  assert.ok(report.riskyPolicies.some((policy) => policy.reason.includes("WITH CHECK")));
});

test("Supabase scanner flags public storage object write policies", async () => {
  const report = await checkSupabase({
    rootDir: resolve(fixtureRoot, "public-storage-supabase")
  });
  const storageFindings = report.findings.filter(
    (finding) => finding.ruleId === "supabase.storage.public-bucket"
  );

  assert.ok(storageFindings.length >= 2);
  assert.ok(storageFindings.some((finding) => finding.title.includes("storage.objects")));
  assert.ok(storageFindings.some((finding) => finding.why.includes("Storage object policies")));
  assert.ok(!findingRuleIds(report).includes("supabase.rls.broad-policy"));
});

test("Supabase scanner accepts scoped storage object policies", async () => {
  const report = await checkSupabase({
    rootDir: resolve(fixtureRoot, "safe-storage-supabase")
  });

  assert.deepEqual(report.findings, []);
});

test("silent-success guard flags fake success, mock data, bypasses, and weakened tests", async () => {
  const report = await scanRepository({
    rootDir: resolve(fixtureRoot, "silent-success-risk")
  });
  const ruleIds = findingRuleIds(report);

  assert.ok(ruleIds.includes("silent-success.swallowed-error"));
  assert.ok(ruleIds.includes("silent-success.production-mock-data"));
  assert.ok(ruleIds.includes("silent-success.hardcoded-fallback"));
  assert.ok(ruleIds.includes("silent-success.weakened-test"));
  assert.ok(ruleIds.includes("silent-success.temporary-bypass"));
  assert.ok(
    report.findings
      .filter((finding) => finding.ruleId.startsWith("silent-success."))
      .every((finding) => finding.why && finding.suggestedVerification && finding.suggestedFix && finding.evidence[0]?.file)
  );
});

test("silent-success guard accepts explicit error handling and real assertions", async () => {
  const report = await scanRepository({
    rootDir: resolve(fixtureRoot, "silent-success-safe")
  });

  assert.deepEqual(
    findingRuleIds(report).filter((ruleId) => ruleId.startsWith("silent-success.")),
    []
  );
});

test("Supabase RLS doctor reports static debugging gaps and SQL cookbook steps", async () => {
  const report = await checkSupabase({
    rootDir: resolve(fixtureRoot, "supabase-doctor-risk"),
    doctor: true
  });
  const ruleIds = findingRuleIds(report);

  assert.ok(ruleIds.includes("supabase.rls.enabled-no-policy"));
  assert.ok(ruleIds.includes("supabase.rls.write-policy-missing"));
  assert.ok(ruleIds.includes("supabase.rls.public-write-policy"));
  assert.ok(ruleIds.includes("supabase.rls.uid-column-mismatch"));
  assert.ok(ruleIds.includes("supabase.rls.tenant-predicate-missing"));
  assert.ok(report.doctor.sqlCookbook.some((line) => /set local role authenticated/i.test(line)));
  assert.ok(report.doctor.twoAccountVerificationSteps.some((step) => /User A/i.test(step) && /User B/i.test(step)));
});

test("Supabase RLS doctor accepts complete scoped policies", async () => {
  const report = await checkSupabase({
    rootDir: resolve(fixtureRoot, "supabase-doctor-safe"),
    doctor: true
  });

  assert.deepEqual(
    findingRuleIds(report).filter((ruleId) => ruleId.startsWith("supabase.rls.") && ruleId.includes("policy")),
    []
  );
  assert.ok(report.doctor.twoAccountVerificationSteps.length > 0);
});

test("Next and Vercel launch preflight reports headers, env, image, request, and logging risks", async () => {
  const report = await scanRepository({
    rootDir: resolve(fixtureRoot, "next-vercel-risk")
  });
  const ruleIds = findingRuleIds(report);

  assert.ok(ruleIds.includes("deploy.next.missing-security-headers"));
  assert.ok(ruleIds.includes("deploy.env.server-undocumented"));
  assert.ok(ruleIds.includes("deploy.env.public-inventory"));
  assert.ok(ruleIds.includes("deploy.next.image-cost-risk"));
  assert.ok(ruleIds.includes("deploy.next.request-amplification"));
  assert.ok(ruleIds.includes("deploy.observability.missing-request-id"));
});

test("Next and Vercel launch preflight accepts documented env, scoped images, headers, and request IDs", async () => {
  const report = await scanRepository({
    rootDir: resolve(fixtureRoot, "next-vercel-safe")
  });

  assert.deepEqual(
    findingRuleIds(report).filter((ruleId) =>
      [
        "deploy.next.missing-security-headers",
        "deploy.env.server-undocumented",
        "deploy.next.image-cost-risk",
        "deploy.next.request-amplification",
        "deploy.observability.missing-request-id"
      ].includes(ruleId)
    ),
    []
  );
});

test("repo scan reports leaked env secrets and risky NEXT_PUBLIC secret exposure", async () => {
  const report = await scanRepository({
    rootDir: resolve(fixtureRoot, "leaked-env")
  });

  assert.equal(report.command, "scan");
  assert.ok(findingRuleIds(report).includes("secrets.detected"));
  assert.ok(findingRuleIds(report).includes("next.env.public-secret"));
  assert.ok(findingTitles(report).some((title) => title.includes("NEXT_PUBLIC")));
});

test("unsafe MCP config reports secret-bearing, shell, database, and non-localhost risks", async () => {
  const report = await checkMcp({
    rootDir: resolve(fixtureRoot, "unsafe-mcp")
  });

  assert.equal(report.command, "check-mcp");
  assert.ok(report.servers.some((server) => server.sideEffects.includes("shell")));
  assert.ok(report.servers.some((server) => server.sideEffects.includes("database")));
  assert.ok(report.servers.some((server) => server.sideEffects.includes("secret-bearing")));
  assert.ok(findingRuleIds(report).includes("mcp.config.non-local-bind"));
  assert.ok(findingRuleIds(report).includes("mcp.config.plaintext-secret"));
});

test("MCP policy template classifies tool side effects and flags missing boundaries", async () => {
  const report = await checkMcp({
    rootDir: resolve(fixtureRoot, "mcp-policy-risk"),
    policyTemplate: true
  });
  const ruleIds = findingRuleIds(report);

  assert.ok(ruleIds.includes("mcp.tool.missing-side-effect-classification"));
  assert.ok(ruleIds.includes("mcp.tool.missing-policy-boundary"));
  assert.ok(ruleIds.includes("mcp.tool.missing-scope"));
  assert.ok(report.policyTemplate.servers.some((server) => server.sideEffects.includes("filesystem-write")));
  assert.ok(report.policyTemplate.receiptFormat.includes("normalizedArgumentDigest"));
  assert.ok(report.policyTemplate.localPolicyTemplate.includes("decision: deny"));
});

test("MCP policy template accepts tools with explicit side effects and local scopes", async () => {
  const report = await checkMcp({
    rootDir: resolve(fixtureRoot, "mcp-policy-safe"),
    policyTemplate: true
  });

  assert.deepEqual(
    findingRuleIds(report).filter((ruleId) => ruleId.startsWith("mcp.tool.missing-")),
    []
  );
  assert.ok(report.policyTemplate.servers.some((server) => server.sideEffects.includes("filesystem-read")));
});

test("GitHub Actions hygiene check reports launch-relevant workflow risks", async () => {
  const report = await checkActions({
    rootDir: resolve(fixtureRoot, "actions-hygiene-risk")
  });
  const ruleIds = findingRuleIds(report);

  assert.equal(report.command, "check-actions");
  assert.ok(ruleIds.includes("actions.permissions.too-broad"));
  assert.ok(ruleIds.includes("actions.pr-missing-concurrency"));
  assert.ok(ruleIds.includes("actions.docs-only-full-ci"));
  assert.ok(ruleIds.includes("actions.secrets-missing-failfast"));
  assert.ok(ruleIds.includes("actions.checkout.fetch-depth"));
  assert.ok(ruleIds.includes("actions.unpinned-action"));
});

test("GitHub Actions hygiene check accepts bounded PR workflows", async () => {
  const report = await checkActions({
    rootDir: resolve(fixtureRoot, "actions-hygiene-safe")
  });

  assert.deepEqual(report.findings, []);
});

test("risky PR diff prioritizes auth, billing, RLS, env, and weakened tests", async () => {
  const diffText = await readFile(resolve(fixtureRoot, "risky-pr.diff"), "utf8");
  const report = await classifyPrRisk({ diffText, rootDir: fixtureRoot });

  assert.equal(report.command, "pr-risk");
  assert.ok(report.categories.includes("auth/session"));
  assert.ok(report.categories.includes("billing/subscription"));
  assert.ok(report.categories.includes("RLS/policy"));
  assert.ok(report.categories.includes("env/secrets/deploy"));
  assert.ok(report.categories.includes("tests removed or weakened"));
  assert.ok(report.topRiskyFiles[0].path.includes("app/api"));
  assert.ok(report.requiredTests.some((item) => item.includes("two-account")));
});

test("pr-risk flags trust-boundary diffs without nearby spec updates and raises silent-success review", async () => {
  const diffText = await readFile(resolve(fixtureRoot, "pr-risk-trust-risk.diff"), "utf8");
  const report = await classifyPrRisk({ diffText, rootDir: fixtureRoot });
  const ruleIds = findingRuleIds(report);

  assert.ok(ruleIds.includes("pr-risk.trust-boundary-missing-spec"));
  assert.ok(report.categories.includes("silent-success/fake-green"));
  assert.ok(report.reviewChecklist.some((item) => /What changed at the trust boundary/i.test(item)));
  assert.ok(report.reviewChecklist.some((item) => /Why this auth\/session\/payment\/data access decision/i.test(item)));
  assert.ok(report.reviewChecklist.some((item) => /What manual test proves it/i.test(item)));
  assert.ok(report.suggestedSplit.some((item) => /auth/i.test(item)));
  assert.ok(report.suggestedSplit.some((item) => /billing/i.test(item)));
  assert.ok(report.suggestedSplit.some((item) => /data access/i.test(item)));
});

test("pr-risk accepts trust-boundary diffs with corresponding spec context", async () => {
  const diffText = await readFile(resolve(fixtureRoot, "pr-risk-trust-safe.diff"), "utf8");
  const report = await classifyPrRisk({ diffText, rootDir: fixtureRoot });

  assert.ok(report.categories.includes("auth/session"));
  assert.ok(!findingRuleIds(report).includes("pr-risk.trust-boundary-missing-spec"));
});

test("pr-risk avoids auth and billing false positives in workflow hardening diffs", async () => {
  const diffText = `diff --git a/action.yml b/action.yml
index 1111111..2222222 100644
--- a/action.yml
+++ b/action.yml
@@ -1,8 +1,13 @@
 name: AI SaaS Guard
 author: ai-saas-guard
 inputs:
   command:
-    description: Command to run: scan.
+    description: "Command to run: scan, check-stripe, check-mcp, or pr-risk."
+      run: |
+        case "\${INPUT_COMMAND}" in
+          scan|check-stripe|check-mcp|pr-risk) ;;
+        esac
diff --git a/.github/workflows/ci.yml b/.github/workflows/ci.yml
index 3333333..4444444 100644
--- a/.github/workflows/ci.yml
+++ b/.github/workflows/ci.yml
@@ -1,6 +1,12 @@
 jobs:
   test:
     steps:
+      - uses: actions/checkout@de0fac2e4500dabe0009e67214ff5f5447ce83dd
+      - run: actionlint
+    permissions:
+      contents: read
diff --git a/tests/guard.test.mjs b/tests/guard.test.mjs
index 5555555..6666666 100644
--- a/tests/guard.test.mjs
+++ b/tests/guard.test.mjs
@@ -1,3 +1,7 @@
+test("documents billing/subscription wording", () => {
+  assert.equal("billing/subscription", "billing/subscription");
+});
`;

  const report = await classifyPrRisk({ diffText, rootDir: fixtureRoot });

  assert.ok(report.categories.includes("env/secrets/deploy"));
  assert.ok(report.categories.includes("permissions/storage"));
  assert.ok(!report.categories.includes("auth/session"));
  assert.ok(!report.categories.includes("billing/subscription"));
  assert.ok(!report.topRiskyFiles.some((file) => file.path === "tests/guard.test.mjs"));
});

test("pr-risk ignores domain vocabulary in ordinary tooling strings", async () => {
  const diffText = `diff --git a/src/lib/messages.ts b/src/lib/messages.ts
index 1111111..2222222 100644
--- a/src/lib/messages.ts
+++ b/src/lib/messages.ts
@@ -1,3 +1,8 @@
-const oldLabel = "deleted file mode test(";
+export const labels = [
+  "auth/session",
+  "billing/subscription",
+  "row level security",
+  "large AI-generated/refactor-like diff",
+  "NEXT_PUBLIC_STRIPE_SECRET_KEY"
+];
`;

  const report = await classifyPrRisk({ diffText, rootDir: fixtureRoot });

  assert.deepEqual(report.categories, []);
  assert.deepEqual(report.topRiskyFiles, []);
});

test("pr-risk explains missing base refs instead of silently reporting no diff", async () => {
  const report = await classifyPrRisk({
    rootDir: packageRoot,
    base: "origin/definitely-missing-base-for-ai-saas-guard"
  });

  const finding = report.findings.find((candidate) => candidate.ruleId === "pr-risk.diff-unavailable");

  assert.ok(finding, "expected a git diff diagnostic finding");
  assert.match(finding.title, /definitely-missing-base-for-ai-saas-guard/);
  assert.match(finding.suggestedVerification, /git fetch origin definitely-missing-base-for-ai-saas-guard/);
  assert.match(finding.suggestedFix, /existing local base ref/);
  assert.doesNotMatch(finding.why, new RegExp(packageRoot.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  assert.ok(!findingRuleIds(report).includes("pr-risk.no-diff"));
});

test("npm package excludes macOS AppleDouble metadata files", async () => {
  const appleDoubleFile = resolve(packageRoot, "dist", "._ai-saas-guard-packaging-test");
  await writeFile(appleDoubleFile, "macOS metadata should never ship\n");

  try {
    const { stdout } = await execFileAsync("npm", ["pack", "--dry-run", "--json"], { cwd: packageRoot });
    const [pack] = JSON.parse(stdout);
    const packedPaths = pack.files.map((file) => file.path);
    const npmIgnore = await readFile(resolve(packageRoot, ".npmignore"), "utf8");

    assert.match(npmIgnore, /\*\*\/\._\*/);
    assert.match(npmIgnore, /\*\*\/\.wrangler/);
    assert.ok(packedPaths.includes("README.zh-CN.md"));
    assert.ok(packedPaths.includes("hosted/cloudflare-worker/README.md"));
    assert.ok(!packedPaths.some((filePath) => filePath.startsWith("._") || filePath.includes("/._")));
    assert.ok(!packedPaths.some((filePath) => filePath.startsWith(".wrangler") || filePath.includes("/.wrangler/")));
  } finally {
    await rm(appleDoubleFile, { force: true });
  }
});

test(".ai-saas-guardignore excludes matching files from scans", async () => {
  const rootDir = await mkdtemp(resolve(tmpdir(), "ai-saas-guard-ignore-"));
  await mkdir(resolve(rootDir, "ignored"));
  await writeFile(resolve(rootDir, ".ai-saas-guardignore"), "ignored/**\n");
  await writeFile(resolve(rootDir, "ignored/.env.example"), "STRIPE_SECRET_KEY=example_ignored_secret_value_1234567890\n");
  await writeFile(resolve(rootDir, ".env.example"), "STRIPE_SECRET_KEY=example_visible_secret_value_1234567890\n");

  const report = await scanRepository({ rootDir });
  const files = report.findings.flatMap((finding) => finding.evidence.map((evidence) => evidence.file));

  assert.ok(files.includes(".env.example"));
  assert.ok(!files.includes("ignored/.env.example"));
});

test("CLI can emit SARIF for GitHub code scanning", async () => {
  const { stdout } = await execFileAsync("node", [
    resolve(packageRoot, "dist/cli.js"),
    "scan",
    "--root",
    resolve(fixtureRoot, "vulnerable-stripe"),
    "--sarif"
  ]);
  const sarif = JSON.parse(stdout);

  assert.equal(sarif.version, "2.1.0");
  assert.equal(sarif.runs[0].tool.driver.name, "ai-saas-guard");
  assert.ok(sarif.runs[0].results.some((result) => result.ruleId === "stripe.webhook.missing-signature"));
  const missingSignatureRule = sarif.runs[0].tool.driver.rules.find(
    (rule) => rule.id === "stripe.webhook.missing-signature"
  );
  assert.equal(missingSignatureRule.properties["ai-saas-guard/stability"], "strict");
  assert.ok(missingSignatureRule.properties.tags.includes("stability:strict"));
});

test("CLI can emit a PR-focused markdown summary for pr-risk", async () => {
  const rootDir = await mkdtemp(resolve(tmpdir(), "ai-saas-guard-pr-markdown-"));
  const apiDir = resolve(rootDir, "app", "api", "stripe", "webhook");
  await mkdir(apiDir, { recursive: true });
  await writeFile(resolve(apiDir, "route.ts"), "export async function POST() { return Response.json({ ok: true }); }\n");
  await execFileAsync("git", ["init"], { cwd: rootDir });
  await execFileAsync("git", ["config", "user.email", "test@example.com"], { cwd: rootDir });
  await execFileAsync("git", ["config", "user.name", "Test User"], { cwd: rootDir });
  await execFileAsync("git", ["add", "."], { cwd: rootDir });
  await execFileAsync("git", ["commit", "-m", "base"], { cwd: rootDir });
  await writeFile(
    resolve(apiDir, "route.ts"),
    `export async function POST(request: Request) {
  const event = await request.json();
  if (event.type === "checkout.session.completed") {
    await grantSubscription(event.data.object.customer);
  }
  return Response.json({ ok: true });
}
`
  );

  const { stdout } = await execFileAsync("node", [
    resolve(packageRoot, "dist/cli.js"),
    "pr-risk",
    "--root",
    rootDir,
    "--markdown"
  ]);

  assert.match(stdout, /^## ai-saas-guard PR risk summary/m);
  assert.match(stdout, /### Review first/m);
  assert.match(stdout, /app\/api\/stripe\/webhook\/route\.ts/);
  assert.match(stdout, /billing\/subscription/);
  assert.match(stdout, /### Required verification/m);
  assert.match(stdout, /### Suggested PR split/m);
  assert.doesNotMatch(stdout, /LGTM|ship it|looks good/i);
});

test("CLI supports Supabase doctor, MCP policy template, and Actions hygiene commands", async () => {
  const supabase = await runCli([
    "check-supabase",
    "--root",
    resolve(fixtureRoot, "supabase-doctor-risk"),
    "--doctor",
    "--json"
  ]);
  assert.equal(supabase.code, 0);
  assert.ok(JSON.parse(supabase.stdout).doctor.sqlCookbook.length > 0);

  const mcp = await runCli([
    "check-mcp",
    "--root",
    resolve(fixtureRoot, "mcp-policy-risk"),
    "--policy-template",
    "--json"
  ]);
  assert.equal(mcp.code, 0);
  assert.ok(JSON.parse(mcp.stdout).policyTemplate.receiptFormat.includes("normalizedArgumentDigest"));

  const actions = await runCli([
    "check-actions",
    "--root",
    resolve(fixtureRoot, "actions-hygiene-risk"),
    "--json"
  ]);
  assert.equal(actions.code, 0);
  assert.equal(JSON.parse(actions.stdout).command, "check-actions");
});

test("CLI --fail-on exits non-zero only because findings meet the threshold", async () => {
  const result = await runCli([
    "scan",
    "--root",
    resolve(fixtureRoot, "vulnerable-stripe"),
    "--fail-on",
    "high"
  ]);

  assert.equal(result.code, 1);
  assert.match(result.stdout, /ai-saas-guard scan/);
  assert.match(result.stderr, /Failing because findings met --fail-on high/);
  assert.doesNotMatch(result.stderr, /Unknown argument/);
});

test("CLI applies checked-in rule config to JSON, SARIF, and terminal output", async () => {
  const rootDir = await mkdtemp(resolve(tmpdir(), "ai-saas-guard-config-"));

  try {
    await writeMinimalStripeWebhook(rootDir);
    await writeFile(
      resolve(rootDir, ".ai-saas-guard.json"),
      `${JSON.stringify(
        {
          rules: {
            "stripe.webhook.missing-signature": "off",
            "stripe.webhook.missing-critical-event": "off",
            "stripe.webhook.missing-idempotency": "low"
          }
        },
        null,
        2
      )}\n`
    );

    const jsonResult = await runCli(["check-stripe", "--root", rootDir, "--json"]);
    assert.equal(jsonResult.code, 0);
    const report = JSON.parse(jsonResult.stdout);
    const ruleIds = findingRuleIds(report);

    assert.deepEqual(ruleIds, ["stripe.webhook.missing-idempotency"]);
    assert.equal(report.findings[0].severity, "low");
    assert.deepEqual(report.summary, {
      critical: 0,
      high: 0,
      medium: 0,
      low: 1,
      info: 0,
      total: 1
    });

    const sarifResult = await runCli(["check-stripe", "--root", rootDir, "--sarif"]);
    assert.equal(sarifResult.code, 0);
    const sarif = JSON.parse(sarifResult.stdout);
    assert.deepEqual(
      sarif.runs[0].results.map((result) => result.ruleId),
      ["stripe.webhook.missing-idempotency"]
    );
    assert.equal(sarif.runs[0].results[0].level, "warning");

    const terminalResult = await runCli(["check-stripe", "--root", rootDir]);
    assert.equal(terminalResult.code, 0);
    assert.match(terminalResult.stdout, /\[LOW\] Stripe webhook lacks obvious duplicate event idempotency/);
    assert.doesNotMatch(terminalResult.stdout, /missing-signature|missing-critical-event/);
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

test("CLI applies path-specific suppressions without disabling a rule globally", async () => {
  const rootDir = await mkdtemp(resolve(tmpdir(), "ai-saas-guard-suppressions-"));

  try {
    await writeMinimalStripeWebhook(rootDir);
    await writeFile(
      resolve(rootDir, ".ai-saas-guard.json"),
      `${JSON.stringify(
        {
          suppressions: [
            {
              ruleId: "stripe.webhook.missing-idempotency",
              paths: ["app/api/stripe/webhook/route.ts"],
              reason: "Known generated test harness; tracked in the launch checklist."
            }
          ]
        },
        null,
        2
      )}\n`
    );

    const result = await runCli(["check-stripe", "--root", rootDir, "--json"]);
    assert.equal(result.code, 0);
    const report = JSON.parse(result.stdout);
    const ruleIds = findingRuleIds(report);

    assert.ok(ruleIds.includes("stripe.webhook.missing-signature"));
    assert.ok(ruleIds.includes("stripe.webhook.missing-critical-event"));
    assert.ok(!ruleIds.includes("stripe.webhook.missing-idempotency"));
    assert.equal(report.summary.total, report.findings.length);
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

test("CLI uses config failOn unless --fail-on overrides it", async () => {
  const rootDir = await mkdtemp(resolve(tmpdir(), "ai-saas-guard-config-fail-on-"));
  const configPath = resolve(rootDir, "guard.config.json");

  try {
    await writeMinimalStripeWebhook(rootDir);
    await writeFile(
      configPath,
      `${JSON.stringify(
        {
          failOn: "low",
          rules: {
            "stripe.webhook.missing-signature": "off",
            "stripe.webhook.missing-critical-event": "off",
            "stripe.webhook.missing-idempotency": "low"
          }
        },
        null,
        2
      )}\n`
    );

    const configThresholdResult = await runCli(["check-stripe", "--root", rootDir, "--config", configPath]);
    assert.equal(configThresholdResult.code, 1);
    assert.match(configThresholdResult.stderr, /Failing because findings met --fail-on low/);

    const cliOverrideResult = await runCli([
      "check-stripe",
      "--root",
      rootDir,
      "--config",
      configPath,
      "--fail-on",
      "none"
    ]);
    assert.equal(cliOverrideResult.code, 0);
    assert.doesNotMatch(cliOverrideResult.stderr, /Failing because/);
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

test("CLI rejects unknown rule IDs in project config", async () => {
  const rootDir = await mkdtemp(resolve(tmpdir(), "ai-saas-guard-config-invalid-"));

  try {
    await writeFile(
      resolve(rootDir, ".ai-saas-guard.json"),
      `${JSON.stringify({
        rules: {
          "not.a.real-rule": "off"
        }
      })}\n`
    );

    const result = await runCli(["scan", "--root", rootDir, "--json"]);

    assert.equal(result.code, 1);
    assert.match(result.stderr, /Unknown rule ID in config: not\.a\.real-rule/);
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

test("CLI rejects unknown rule IDs in suppressions", async () => {
  const rootDir = await mkdtemp(resolve(tmpdir(), "ai-saas-guard-suppression-invalid-"));

  try {
    await writeFile(
      resolve(rootDir, ".ai-saas-guard.json"),
      `${JSON.stringify({
        suppressions: [
          {
            ruleId: "not.a.real-rule",
            paths: ["app/**"],
            reason: "Invalid test suppression."
          }
        ]
      })}\n`
    );

    const result = await runCli(["scan", "--root", rootDir, "--json"]);

    assert.equal(result.code, 1);
    assert.match(result.stderr, /Unknown rule ID in suppression: not\.a\.real-rule/);
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

test("repository exposes a GitHub Action wrapper", async () => {
  const action = await readFile(resolve(packageRoot, "action.yml"), "utf8");

  assert.match(action, /name: AI SaaS Guard/);
  assert.match(action, /fail-on/);
  assert.match(action, /src\/cli.ts|dist\/cli\.js/);
});

test("GitHub Action does not interpolate action inputs directly inside bash", async () => {
  const action = await readFile(resolve(packageRoot, "action.yml"), "utf8");
  const runStep = action.match(/- name: Run ai-saas-guard[\s\S]*?run:\s*\|([\s\S]*)/);

  assert.ok(runStep, "expected action.yml to contain the Run ai-saas-guard step");
  assert.doesNotMatch(runStep[1], /\$\{\{\s*inputs\./);
  assert.match(action, /INPUT_COMMAND:\s*\$\{\{\s*inputs\.command\s*\}\}/);
  assert.match(action, /INPUT_OUTPUT:\s*\$\{\{\s*inputs\.output\s*\}\}/);
  assert.match(action, /INPUT_CONFIG:\s*\$\{\{\s*inputs\.config\s*\}\}/);
  assert.match(action, /run:\s+npm ci/);
});

test("GitHub Action validates enumerated inputs before invoking the CLI", async () => {
  const action = await readFile(resolve(packageRoot, "action.yml"), "utf8");
  const runStep = action.match(/- name: Run ai-saas-guard[\s\S]*?run:\s*\|([\s\S]*)/);

  assert.ok(runStep, "expected action.yml to contain the Run ai-saas-guard step");
  assert.match(runStep[1], /case "\$\{INPUT_COMMAND\}" in[\s\S]*scan\|check-supabase\|check-stripe\|check-mcp\|check-actions\|pr-risk/);
  assert.match(runStep[1], /case "\$\{INPUT_FORMAT\}" in[\s\S]*terminal\|json\|sarif\|markdown/);
  assert.match(runStep[1], /case "\$\{INPUT_FAIL_ON\}" in[\s\S]*none\|critical\|high\|medium\|low\|info/);
  assert.match(runStep[1], /--markdown/);
  assert.match(runStep[1], /--config/);
  assert.match(runStep[1], /exit 2/);
});

test("public docs explain PR summary, SARIF, and the v0 Action tag", async () => {
  const readme = await readFile(resolve(packageRoot, "README.md"), "utf8");
  const actionDocs = await readFile(resolve(packageRoot, "docs", "github-action.md"), "utf8");
  const rulesDocs = await readFile(resolve(packageRoot, "docs", "rules.md"), "utf8");

  assert.match(readme, /zr9959\/ai-saas-guard@v0/);
  assert.match(readme, /format:\s*markdown/);
  assert.match(readme, /GITHUB_STEP_SUMMARY/);
  assert.match(readme, /\.ai-saas-guard\.json/);
  assert.match(readme, /--config <file>/);
  assert.match(readme, /"stripe\.webhook\.missing-signature": "off"/);
  assert.match(readme, /suppressions/);
  assert.match(readme, /paths/);
  assert.match(actionDocs, /PR summary/i);
  assert.match(actionDocs, /SARIF/i);
  assert.match(actionDocs, /config:\s*\.ai-saas-guard\.json/);
  assert.match(actionDocs, /Use SARIF/i);
  assert.match(actionDocs, /Use markdown/i);
  assert.match(rulesDocs, /Stability/i);
  assert.match(rulesDocs, /Strict/i);
  assert.match(rulesDocs, /Experimental/i);
});

test("public README keeps an updated Chinese translation entry point", async () => {
  const readme = await readFile(resolve(packageRoot, "README.md"), "utf8");
  const zhReadme = await readFile(resolve(packageRoot, "README.zh-CN.md"), "utf8");
  const releaseGate = await readFile(
    resolve(packageRoot, "docs", "release-quality-knowledge-base.md"),
    "utf8"
  );

  assert.match(readme.slice(0, 900), /README\.zh-CN\.md/);
  assert.match(zhReadme.slice(0, 900), /README\.md/);
  assert.match(readme.slice(0, 1600), /You used AI to build your SaaS/i);
  assert.match(readme.slice(0, 1600), /before launch/i);
  assert.match(readme.slice(0, 1600), /auth, billing, data access, secrets, MCP, and deploy/i);
  assert.match(readme.slice(0, 1600), /not a pentest/i);
  assert.match(readme.slice(0, 1600), /runs locally/i);
  assert.match(readme.slice(0, 1600), /does not upload code/i);
  assert.match(zhReadme.slice(0, 1600), /你用 AI 把 SaaS 做出来了/);
  assert.match(zhReadme.slice(0, 1600), /上线前/);
  assert.match(zhReadme.slice(0, 1600), /最容易出事/);
  assert.match(zhReadme.slice(0, 1600), /不是渗透测试/);
  assert.match(zhReadme.slice(0, 1600), /本地运行/);
  assert.match(zhReadme.slice(0, 1600), /不上传代码/);
  assert.match(zhReadme, /本地优先/);
  assert.match(zhReadme, /AI 构建的 SaaS/);
  assert.match(zhReadme, /目标用户/);
  assert.match(zhReadme, /scan/);
  assert.match(zhReadme, /pr-risk/);
  assert.match(zhReadme, /check-supabase/);
  assert.match(zhReadme, /check-stripe/);
  assert.match(zhReadme, /check-mcp/);
  assert.match(zhReadme, /GitHub Action/);
  assert.match(zhReadme, /Hosted GitHub App/);
  assert.match(zhReadme, /docs\/hosted-staging-harness\.md/);
  assert.match(zhReadme, /不是渗透测试/);
  assert.match(zhReadme, /不上传代码/);
  assert.match(releaseGate, /README\.zh-CN\.md/);
  assert.doesNotMatch(zhReadme, /client_secret|private key|webhook secret|sk_(?:live|test)_|whsec_/i);
});

test("public docs include a Stripe webhook replay cookbook", async () => {
  const readme = await readFile(resolve(packageRoot, "README.md"), "utf8");
  const cookbook = await readFile(resolve(packageRoot, "docs", "stripe-webhook-replay.md"), "utf8");

  assert.match(readme, /docs\/stripe-webhook-replay\.md/);
  assert.match(cookbook, /checkout\.session\.completed/);
  assert.match(cookbook, /invoice\.payment_failed/);
  assert.match(cookbook, /invoice\.payment_action_required/);
  assert.match(cookbook, /customer\.subscription\.updated/);
  assert.match(cookbook, /customer\.subscription\.deleted/);
  assert.match(cookbook, /charge\.refunded/);
  assert.match(cookbook, /Duplicate event replay/i);
  assert.match(cookbook, /Out-of-order/i);
  assert.match(cookbook, /entitlement reconciliation/i);
  assert.match(cookbook, /stripe trigger invoice\.payment_failed/);
  assert.match(cookbook, /stripe trigger invoice\.payment_action_required/);
  assert.match(cookbook, /stripe listen --forward-to/);
  assert.doesNotMatch(cookbook, /whsec_[A-Za-z0-9]+/);
  assert.doesNotMatch(cookbook, /sk_(?:live|test)_[A-Za-z0-9]+/);
});

test("public docs include a founder launch-readiness checklist", async () => {
  const readme = await readFile(resolve(packageRoot, "README.md"), "utf8");
  const checklist = await readFile(resolve(packageRoot, "docs", "launch-readiness-checklist.md"), "utf8");

  assert.match(readme, /docs\/launch-readiness-checklist\.md/);
  assert.match(checklist, /two-account authorization testing/i);
  assert.match(checklist, /Stripe webhook verification/i);
  assert.match(checklist, /MCP config review/i);
  assert.match(checklist, /not a full security audit/i);
  assert.match(checklist, /launch blocker/i);
  assert.match(checklist, /supabase/i);
  assert.match(checklist, /rollback/i);
  assert.match(checklist, /npx ai-saas-guard@latest scan --root \./);
  assert.doesNotMatch(checklist, /sk_(?:live|test)_[A-Za-z0-9]+/);
  assert.doesNotMatch(checklist, /whsec_[A-Za-z0-9]+/);
});

test("public docs include a GitHub App hosted-layer design note", async () => {
  const readme = await readFile(resolve(packageRoot, "README.md"), "utf8");
  const design = await readFile(resolve(packageRoot, "docs", "github-app-design.md"), "utf8");

  assert.match(readme, /docs\/github-app-design\.md/);
  assert.match(design, /hosted GitHub App/i);
  assert.match(design, /least-privilege permissions/i);
  assert.match(design, /repository contents: read/i);
  assert.match(design, /pull requests: read/i);
  assert.match(design, /checks: write/i);
  assert.match(design, /webhook signature verification/i);
  assert.match(design, /PR comments/i);
  assert.match(design, /data retention/i);
  assert.match(design, /privacy/i);
  assert.match(design, /prompt injection/i);
  assert.match(design, /human approval/i);
  assert.match(design, /does not replace the local CLI/i);
  assert.doesNotMatch(design, /client_secret|private key|webhook secret/i);
});

test("public docs define the first hosted service slice", async () => {
  const readme = await readFile(resolve(packageRoot, "README.md"), "utf8");
  const design = await readFile(resolve(packageRoot, "docs", "github-app-design.md"), "utf8");
  const slice = await readFile(resolve(packageRoot, "docs", "hosted-first-service-slice.md"), "utf8");

  assert.match(readme, /docs\/hosted-first-service-slice\.md/);
  assert.match(design, /docs\/hosted-first-service-slice\.md/);
  assert.match(slice, /First Hosted Service Slice/i);
  assert.match(slice, /signed GitHub App webhook/i);
  assert.match(slice, /verify the webhook signature before/i);
  assert.match(slice, /trusted GitHub event fields/i);
  assert.match(slice, /idempotent scan request/i);
  assert.match(slice, /check run summary only/i);
  assert.match(slice, /No PR comments/i);
  assert.match(slice, /No saved report dashboard/i);
  assert.match(slice, /No billing/i);
  assert.match(slice, /No AI summaries/i);
  assert.match(slice, /no raw source/i);
  assert.match(slice, /no raw diffs/i);
  assert.match(slice, /no secrets/i);
  assert.match(slice, /does not replace the local CLI/i);
  assert.doesNotMatch(slice, /client_secret|private key|webhook secret|sk_(?:live|test)_|whsec_/i);
});

test("public docs choose the hosted deployment model", async () => {
  const readme = await readFile(resolve(packageRoot, "README.md"), "utf8");
  const design = await readFile(resolve(packageRoot, "docs", "github-app-design.md"), "utf8");
  const model = await readFile(resolve(packageRoot, "docs", "hosted-deployment-model.md"), "utf8");

  assert.match(readme, /docs\/hosted-deployment-model\.md/);
  assert.match(design, /docs\/hosted-deployment-model\.md/);
  assert.match(model, /Hosted Deployment Model/i);
  assert.match(model, /containerized Node\.js runtime/i);
  assert.match(model, /webhook ingress/i);
  assert.match(model, /managed durable queue/i);
  assert.match(model, /short-lived worker/i);
  assert.match(model, /platform secret manager/i);
  assert.match(model, /structured logs/i);
  assert.match(model, /redaction/i);
  assert.match(model, /installation and repository/i);
  assert.match(model, /rate limits/i);
  assert.match(model, /rollback/i);
  assert.match(model, /incident response/i);
  assert.match(model, /verify the webhook signature before any queue write/i);
  assert.match(model, /delete checkout directories/i);
  assert.match(model, /no raw source/i);
  assert.match(model, /no raw diffs/i);
  assert.match(model, /no secrets/i);
  assert.match(model, /customer payloads/i);
  assert.match(model, /private URLs/i);
  assert.match(model, /does not replace the local CLI/i);
  assert.doesNotMatch(model, /client_secret|private key|webhook secret|sk_(?:live|test)_|whsec_/i);
});

test("public docs define the hosted service runtime", async () => {
  const readme = await readFile(resolve(packageRoot, "README.md"), "utf8");
  const runtime = await readFile(resolve(packageRoot, "docs", "hosted-service-runtime.md"), "utf8");

  assert.match(readme, /docs\/hosted-service-runtime\.md/);
  assert.match(runtime, /Hosted Service Runtime/i);
  assert.match(runtime, /createHostedServiceRuntime/);
  assert.match(runtime, /ai-saas-guard\/hosted\/service/);
  assert.match(runtime, /signed GitHub App pull request webhook intake/i);
  assert.match(runtime, /idempotent durable queue upsert/i);
  assert.match(runtime, /read-only worker planning/i);
  assert.match(runtime, /compact report storage adapter/i);
  assert.match(runtime, /Check Run publication adapter/i);
  assert.match(runtime, /createInMemoryHostedServiceAdapters/);
  assert.match(runtime, /not a production queue or production data store/i);
  assert.match(runtime, /does not deploy a public hosted environment/i);
  assert.match(runtime, /real GitHub App credentials/i);
  assert.doesNotMatch(runtime, /client_secret|private key|webhook secret|sk_(?:live|test)_|whsec_/i);
});

test("public docs define the hosted Node container app skeleton", async () => {
  const readme = await readFile(resolve(packageRoot, "README.md"), "utf8");
  const app = await readFile(resolve(packageRoot, "docs", "hosted-node-container-app.md"), "utf8");

  assert.match(readme, /docs\/hosted-node-container-app\.md/);
  assert.match(app, /Hosted Node Container App Skeleton/i);
  assert.match(app, /ai-saas-guard\/hosted\/app/);
  assert.match(app, /createHostedHttpApp/);
  assert.match(app, /createInMemoryHostedAppPlatform/);
  assert.match(app, /planHostedNodeContainerDeployment/);
  assert.match(app, /node_container/);
  assert.match(app, /webhook-ingress/);
  assert.match(app, /scan-worker/);
  assert.match(app, /\/healthz/);
  assert.match(app, /\/github\/webhook/);
  assert.match(app, /provider adapter/i);
  assert.match(app, /durable queue/i);
  assert.match(app, /compact report store/i);
  assert.match(app, /read-only worker sandbox/i);
  assert.match(app, /GitHub Checks API publisher/i);
  assert.match(app, /public HTTPS base URL/i);
  assert.match(app, /sha256:<digest>/i);
  assert.match(app, /does not announce a public hosted service/i);
  assert.match(app, /does not return raw webhook payloads/i);
  assert.match(app, /does not return.*installation tokens/i);
  assert.doesNotMatch(app, /client_secret|private key|webhook secret|sk_(?:live|test)_|whsec_/i);
});

test("public docs define hosted staging deployment planning", async () => {
  const readme = await readFile(resolve(packageRoot, "README.md"), "utf8");
  const staging = await readFile(
    resolve(packageRoot, "docs", "hosted-staging-deployment.md"),
    "utf8"
  );

  assert.match(readme, /docs\/hosted-staging-deployment\.md/);
  assert.match(staging, /Hosted Staging Deployment/i);
  assert.match(staging, /ai-saas-guard\/hosted\/staging/);
  assert.match(staging, /planHostedProviderBinding/);
  assert.match(staging, /planHostedStagingDeployment/);
  assert.match(staging, /planHostedGitHubAppPromotion/);
  assert.match(staging, /secret-manager:/);
  assert.match(staging, /queue:/);
  assert.match(staging, /store:/);
  assert.match(staging, /sandbox:/);
  assert.match(staging, /github-checks:/);
  assert.match(staging, /logs:/);
  assert.match(staging, /metrics:/);
  assert.match(staging, /rollback:/);
  assert.match(staging, /runbook:/);
  assert.match(staging, /webhook replay/i);
  assert.match(staging, /Check Run publication/i);
  assert.match(staging, /staging deployment, Check Run publication, and rollback verification/i);
  assert.match(staging, /does not announce a public hosted service/i);
  assert.doesNotMatch(staging, /client_secret|-----BEGIN|sk_(?:live|test)_|whsec_/i);
});

test("public docs define the hosted staging harness", async () => {
  const readme = await readFile(resolve(packageRoot, "README.md"), "utf8");
  const contracts = await readFile(resolve(packageRoot, "docs", "hosted-preimplementation-contracts.md"), "utf8");
  const harness = await readFile(resolve(packageRoot, "docs", "hosted-staging-harness.md"), "utf8");

  assert.match(readme, /docs\/hosted-staging-harness\.md/);
  assert.match(contracts, /ai-saas-guard\/hosted\/staging-harness/);
  assert.match(harness, /Hosted Staging Harness/i);
  assert.match(harness, /ai-saas-guard\/hosted\/staging-harness/);
  assert.match(harness, /createFileBackedHostedStagingHarness/);
  assert.match(harness, /createHostedStagingHarnessEvidence/);
  assert.match(harness, /signed pull request webhook replay/i);
  assert.match(harness, /queue\/jobs\.json/);
  assert.match(harness, /reports\//);
  assert.match(harness, /check-runs\//);
  assert.match(harness, /worker-sandbox\//);
  assert.match(harness, /Invalid signatures stop at the signature stage/i);
  assert.match(harness, /worker sandbox is empty after cleanup/i);
  assert.match(harness, /release-gate evidence/i);
  assert.match(harness, /not hosted exposure/i);
  assert.match(harness, /not a live hosted service/i);
  assert.doesNotMatch(harness, /client_secret|private key|webhook secret|sk_(?:live|test)_|whsec_/i);
});

test("public docs define hosted GitHub App deployment planning", async () => {
  const readme = await readFile(resolve(packageRoot, "README.md"), "utf8");
  const design = await readFile(resolve(packageRoot, "docs", "github-app-design.md"), "utf8");
  const deployment = await readFile(resolve(packageRoot, "docs", "github-app-deployment.md"), "utf8");

  assert.match(readme, /docs\/github-app-deployment\.md/);
  assert.match(design, /docs\/github-app-deployment\.md/);
  assert.match(deployment, /Hosted GitHub App Deployment/i);
  assert.match(deployment, /planHostedGitHubAppDeployment/);
  assert.match(deployment, /ai-saas-guard\/hosted\/github-app/);
  assert.match(deployment, /contents: read/i);
  assert.match(deployment, /pull_requests: read/i);
  assert.match(deployment, /checks: write/i);
  assert.match(deployment, /metadata: read/i);
  assert.match(deployment, /pull_request/i);
  assert.match(deployment, /installation_repositories/i);
  assert.match(deployment, /secret reference/i);
  assert.match(deployment, /blocks GitHub App creation/i);
  assert.match(deployment, /does not create a GitHub App by itself/i);
  assert.doesNotMatch(deployment, /client_secret|sk_(?:live|test)_|whsec_[A-Za-z0-9_]+/i);
});

test("public docs describe repository trust hardening", async () => {
  const readme = await readFile(resolve(packageRoot, "README.md"), "utf8");
  const zhReadme = await readFile(resolve(packageRoot, "README.zh-CN.md"), "utf8");
  const governance = await readFile(resolve(packageRoot, "docs", "repository-trust-hardening.md"), "utf8");
  const security = await readFile(resolve(packageRoot, "SECURITY.md"), "utf8");

  assert.match(readme, /docs\/repository-trust-hardening\.md/);
  assert.match(readme, /Dependabot/);
  assert.match(readme, /CodeQL/);
  assert.match(zhReadme, /docs\/repository-trust-hardening\.md/);
  assert.match(zhReadme, /Dependabot/);
  assert.match(zhReadme, /CodeQL/);
  assert.match(governance, /Repository Trust Hardening/i);
  assert.match(governance, /branch protection/i);
  assert.match(governance, /required status checks/i);
  assert.match(governance, /test/);
  assert.match(governance, /actionlint/);
  assert.match(governance, /zizmor/);
  assert.match(governance, /Dependabot/i);
  assert.match(governance, /CodeQL/i);
  assert.match(governance, /private vulnerability reporting/i);
  assert.match(governance, /secret scanning/i);
  assert.doesNotMatch(governance, /client_secret|private key|webhook secret|sk_(?:live|test)_|whsec_/i);
  assert.match(security, /https:\/\/github\.com\/zr9959\/ai-saas-guard\/security\/advisories\/new/);
});

test("public docs define the hosted operational release gate", async () => {
  const readme = await readFile(resolve(packageRoot, "README.md"), "utf8");
  const design = await readFile(resolve(packageRoot, "docs", "github-app-design.md"), "utf8");
  const gate = await readFile(resolve(packageRoot, "docs", "hosted-operational-release-gate.md"), "utf8");

  assert.match(readme, /docs\/hosted-operational-release-gate\.md/);
  assert.match(design, /docs\/hosted-operational-release-gate\.md/);
  assert.match(gate, /Hosted Operational Release Gate/i);
  assert.match(gate, /blocks release/i);
  assert.match(gate, /CI checks/i);
  assert.match(gate, /signature verification/i);
  assert.match(gate, /installation token scoping/i);
  assert.match(gate, /idempotency/i);
  assert.match(gate, /retention/i);
  assert.match(gate, /webhook replay/i);
  assert.match(gate, /dependency and container scanning/i);
  assert.match(gate, /manual rollback/i);
  assert.match(gate, /monitoring and alerting/i);
  assert.match(gate, /Current Source Candidate Evidence Notes/i);
  assert.match(gate, /evaluateHostedOperationalReleaseGate/);
  assert.match(gate, /HOSTED_OPERATIONAL_RELEASE_GATE_REQUIREMENTS/);
  assert.match(gate, /positive pentest, certification, and full-audit claims/i);
  assert.match(gate, /No hosted production environment is exposed/i);
  assert.match(gate, /container_scan/i);
  assert.match(gate, /monitoring_alerting/i);
  assert.match(gate, /manual_rollback/i);
  assert.match(gate, /incident_response/i);
  assert.match(gate, /release_cleanup/i);
  assert.match(gate, /temporary files/i);
  assert.match(gate, /worker checkouts/i);
  assert.match(gate, /long-running processes/i);
  assert.match(gate, /no raw source/i);
  assert.match(gate, /no raw diffs/i);
  assert.match(gate, /no secrets/i);
  assert.match(gate, /does not replace the local CLI/i);
  assert.doesNotMatch(gate, /client_secret|private key|webhook secret|sk_(?:live|test)_|whsec_/i);
});

test("public docs define hosted uninstall and data deletion behavior", async () => {
  const readme = await readFile(resolve(packageRoot, "README.md"), "utf8");
  const design = await readFile(resolve(packageRoot, "docs", "github-app-design.md"), "utf8");
  const deletion = await readFile(resolve(packageRoot, "docs", "hosted-uninstall-data-deletion.md"), "utf8");

  assert.match(readme, /docs\/hosted-uninstall-data-deletion\.md/);
  assert.match(design, /docs\/hosted-uninstall-data-deletion\.md/);
  assert.match(deletion, /Hosted Uninstall And Data Deletion/i);
  assert.match(deletion, /repository removal from installation/i);
  assert.match(deletion, /full app uninstall/i);
  assert.match(deletion, /compact report deletion/i);
  assert.match(deletion, /queue cancellation/i);
  assert.match(deletion, /audit record retention/i);
  assert.match(deletion, /repeated cleanup/i);
  assert.match(deletion, /deleted immediately/i);
  assert.match(deletion, /may remain briefly/i);
  assert.match(deletion, /GitHub-owned check runs/i);
  assert.match(deletion, /no raw source/i);
  assert.match(deletion, /no raw diffs/i);
  assert.match(deletion, /no secrets/i);
  assert.match(deletion, /customer payloads/i);
  assert.match(deletion, /local CLI remains available/i);
  assert.match(deletion, /planHostedRetentionAndDeletionCleanup/);
  assert.match(deletion, /minimal audit records/i);
  assert.doesNotMatch(deletion, /client_secret|private key|webhook secret|sk_(?:live|test)_|whsec_/i);
});

test("public docs record hosted operations evidence without overclaiming delivery", async () => {
  const readme = await readFile(resolve(packageRoot, "README.md"), "utf8");
  const zhReadme = await readFile(resolve(packageRoot, "README.zh-CN.md"), "utf8");
  const evidence = await readFile(resolve(packageRoot, "docs", "hosted-operations-evidence.md"), "utf8");

  for (const document of [readme, zhReadme, evidence]) {
    assert.match(document, /hosted-operations-evidence\.md|Hosted Operations Evidence|Hosted operations evidence/i);
    assert.match(document, /ai-saas-guard-hosted\.zr9959\.workers\.dev/);
    assert.match(document, /webhook delivery|GitHub App webhook/i);
  }

  assert.match(evidence, /bc4b87d9-420a-48bb-a058-8066b08abe03/);
  assert.match(evidence, /Blocked/);
  assert.doesNotMatch(evidence, /guaranteed secure|fully secure/i);
});

test("public docs define hosted pricing and packaging boundaries", async () => {
  const readme = await readFile(resolve(packageRoot, "README.md"), "utf8");
  const design = await readFile(resolve(packageRoot, "docs", "github-app-design.md"), "utf8");
  const pricing = await readFile(resolve(packageRoot, "docs", "hosted-pricing-packaging.md"), "utf8");

  assert.match(readme, /docs\/hosted-pricing-packaging\.md/);
  assert.match(design, /docs\/hosted-pricing-packaging\.md/);
  assert.match(pricing, /Hosted Pricing And Packaging/i);
  assert.match(pricing, /core local scanning stays useful without an account/i);
  assert.match(pricing, /Hosted plans do not gate local CLI scanning/i);
  assert.match(pricing, /Free\/public repo/i);
  assert.match(pricing, /private repo hosted behavior/i);
  assert.match(pricing, /PR comments/i);
  assert.match(pricing, /saved reports/i);
  assert.match(pricing, /team policy/i);
  assert.match(pricing, /optional human review/i);
  assert.match(pricing, /Launch Review/i);
  assert.match(pricing, /not a pentest/i);
  assert.match(pricing, /not a certification/i);
  assert.match(pricing, /not a full security audit/i);
  assert.doesNotMatch(pricing, /client_secret|private key|webhook secret|sk_(?:live|test)_|whsec_/i);
});

test("public docs define hosted pre-implementation contracts", async () => {
  const readme = await readFile(resolve(packageRoot, "README.md"), "utf8");
  const contracts = await readFile(
    resolve(packageRoot, "docs", "hosted-preimplementation-contracts.md"),
    "utf8"
  );

  assert.match(readme, /docs\/hosted-preimplementation-contracts\.md/);
  assert.match(contracts, /Hosted Pre-Implementation Contracts/i);
  assert.match(contracts, /pull request webhook intake planner/i);
  assert.match(contracts, /planHostedPullRequestWebhookIntake/);
  assert.match(contracts, /verifies signatures before JSON parsing or queueing/i);
  assert.match(contracts, /check-run-only scan request/i);
  assert.match(contracts, /durable scan queue planner/i);
  assert.match(contracts, /planHostedScanQueueUpsert/);
  assert.match(contracts, /duplicate deliveries reuse queued, running, and completed jobs/i);
  assert.match(contracts, /manual reruns increment attempt/i);
  assert.match(contracts, /worker read-only scan planner/i);
  assert.match(contracts, /planHostedWorkerReadOnlyScan/);
  assert.match(contracts, /repository `contents: read`/i);
  assert.match(contracts, /fixed read-only CLI invocation/i);
  assert.match(contracts, /ignore PR-authored repository names, token scopes, and commands/i);
  assert.match(contracts, /webhook event parser/i);
  assert.match(contracts, /trusted GitHub event fields/i);
  assert.match(contracts, /opened, reopened, synchronize, and ready_for_review/i);
  assert.match(contracts, /draft pull requests/i);
  assert.match(contracts, /untrusted PR title, body, comments, branch names, README, and code/i);
  assert.match(contracts, /queue-safe scan request/i);
  assert.match(contracts, /check-run summary renderer/i);
  assert.match(contracts, /bounded Markdown/i);
  assert.match(contracts, /conservative check conclusions/i);
  assert.match(contracts, /review-first language/i);
  assert.match(contracts, /review categories, files to review first, and verification steps/i);
  assert.match(contracts, /local CLI link/i);
  assert.match(contracts, /check-run publication planner/i);
  assert.match(contracts, /planHostedCheckRunPublication/);
  assert.match(contracts, /repository `checks: write`/i);
  assert.match(contracts, /PR comments remain an explicit later workflow or paid hosted feature/i);
  assert.match(contracts, /queue cleanup planner/i);
  assert.match(contracts, /repository-scoped cleanup/i);
  assert.match(contracts, /installation-scoped cleanup/i);
  assert.match(contracts, /idempotent repeated cleanup/i);
  assert.match(contracts, /cancel queued jobs/i);
  assert.match(contracts, /request running cancellation/i);
  assert.match(contracts, /preserve terminal jobs/i);
  assert.match(contracts, /worker checkout cleanup planner/i);
  assert.match(contracts, /success, failure, timeout, cancellation, and cleanup_failure/i);
  assert.match(contracts, /safe metadata only/i);
  assert.match(contracts, /never returns checkout paths/i);
  assert.match(contracts, /manual cleanup review/i);
  assert.match(contracts, /retention and deletion cleanup planner/i);
  assert.match(contracts, /planHostedRetentionAndDeletionCleanup/);
  assert.match(contracts, /minimal audit records/i);
  assert.match(contracts, /retention cleanup expires only compact reports past their retention window/i);
  assert.match(contracts, /operational release gate evaluator/i);
  assert.match(contracts, /evaluateHostedOperationalReleaseGate/);
  assert.match(contracts, /HOSTED_OPERATIONAL_RELEASE_GATE_REQUIREMENTS/);
  assert.match(contracts, /missing, failed, stale, or exception-marked/i);
  assert.match(contracts, /no network calls/i);
  assert.doesNotMatch(contracts, /client_secret|private key|webhook secret|sk_(?:live|test)_|whsec_/i);
});

test("public examples include a hosted compact report fixture", async () => {
  const readme = await readFile(resolve(packageRoot, "README.md"), "utf8");
  const contracts = await readFile(
    resolve(packageRoot, "docs", "hosted-preimplementation-contracts.md"),
    "utf8"
  );
  const fixtureText = await readFile(
    resolve(packageRoot, "examples", "hosted-compact-report.json"),
    "utf8"
  );
  const fixture = JSON.parse(fixtureText);

  assert.match(readme, /examples\/hosted-compact-report\.json/);
  assert.match(contracts, /Hosted Compact Report Fixture/i);
  assert.deepEqual(Object.keys(fixture).sort(), [
    "baseSha",
    "evidence",
    "headSha",
    "installationId",
    "modelTraining",
    "pullRequestNumber",
    "repositoryFullName",
    "repositoryId",
    "retentionDays",
    "ruleIds",
    "scannerVersion",
    "summaryCounts",
    "workerCheckoutDeletion"
  ]);
  assert.equal(fixture.modelTraining, "disabled");
  assert.equal(fixture.workerCheckoutDeletion, "after_scan_completion");
  assert.deepEqual(Object.keys(fixture.evidence[0]).sort(), [
    "file",
    "line",
    "ruleId",
    "severity"
  ]);
  assert.doesNotMatch(
    fixtureText,
    /rawDiff|fullFileContents|secretValues|customerPayload|client_secret|private key|webhook secret|sk_(?:live|test)_|whsec_/i
  );
});

test("hosted GitHub App docs define an implementation-ready permission contract", async () => {
  const readme = await readFile(resolve(packageRoot, "README.md"), "utf8");
  const design = await readFile(resolve(packageRoot, "docs", "github-app-design.md"), "utf8");

  assert.match(design, /Implementation-ready permission contract/i);
  assert.match(design, /Required first-version permissions/i);
  assert.match(design, /Only these permissions are required/i);
  assert.match(design, /No required permission may be added without a new public issue/i);
  assert.match(design, /repository contents: read/i);
  assert.match(design, /pull requests: read/i);
  assert.match(design, /checks: write/i);
  assert.match(design, /metadata: read/i);
  assert.match(design, /Optional permissions are disabled by default/i);
  assert.match(design, /pull requests: write/i);
  assert.match(design, /repository policy opt-in/i);
  assert.match(design, /Pull request comments require repository policy/i);
  assert.match(design, /Selected repositories only/i);
  assert.match(design, /No organization-wide installation requirement/i);
  assert.match(design, /administration/i);
  assert.match(design, /deployments/i);
  assert.match(design, /actions: write/i);
  assert.match(design, /repository secrets/i);
  assert.match(readme, /selected repositories/i);
  assert.match(readme, /optional PR comments require repository policy opt-in/i);
});

test("hosted GitHub App docs define webhook verification test gates", async () => {
  const design = await readFile(resolve(packageRoot, "docs", "github-app-design.md"), "utf8");

  assert.match(design, /Webhook Verification Test Contract/i);
  assert.match(design, /valid signature/i);
  assert.match(design, /invalid signature/i);
  assert.match(design, /missing signature/i);
  assert.match(design, /malformed signature/i);
  assert.match(design, /replayed delivery ID/i);
  assert.match(design, /duplicate event/i);
  assert.match(design, /Failed verification produces no scan job/i);
  assert.match(design, /no repository fetch/i);
  assert.match(design, /no real credentials/i);
  assert.match(design, /no customer payloads/i);
  assert.match(design, /signed-webhook boundary/i);
});

test("hosted GitHub App docs define installation token scoping test gates", async () => {
  const design = await readFile(resolve(packageRoot, "docs", "github-app-design.md"), "utf8");

  assert.match(design, /Installation Token Scoping Test Contract/i);
  assert.match(design, /selected-repository installs/i);
  assert.match(design, /non-installed repositories/i);
  assert.match(design, /repository removal from an installation/i);
  assert.match(design, /mismatched installation IDs/i);
  assert.match(design, /installationId/i);
  assert.match(design, /repositoryId/i);
  assert.match(design, /pullRequestNumber/i);
  assert.match(design, /baseSha/i);
  assert.match(design, /headSha/i);
  assert.match(design, /scannerVersion/i);
  assert.match(design, /token lookup failure stops before source fetch/i);
  assert.match(design, /never accept repository identity from untrusted PR text/i);
  assert.match(design, /read-only worker behavior/i);
});

test("hosted GitHub App docs define scan queue idempotency test gates", async () => {
  const design = await readFile(resolve(packageRoot, "docs", "github-app-design.md"), "utf8");

  assert.match(design, /Hosted Scan Queue Idempotency Test Contract/i);
  assert.match(design, /idempotency key/i);
  assert.match(design, /installationId:repositoryId:pullRequestNumber:headSha:scannerVersion/i);
  assert.match(design, /duplicate webhook deliveries/i);
  assert.match(design, /rapid synchronize events/i);
  assert.match(design, /manual reruns/i);
  assert.match(design, /scanner version changes/i);
  assert.match(design, /reuse the existing report/i);
  assert.match(design, /no duplicate check runs/i);
  assert.match(design, /no duplicate PR comments/i);
  assert.match(design, /without logging raw source content/i);
});

test("hosted GitHub App docs define privacy and retention gates", async () => {
  const readme = await readFile(resolve(packageRoot, "README.md"), "utf8");
  const design = await readFile(resolve(packageRoot, "docs", "github-app-design.md"), "utf8");

  assert.match(design, /Privacy And Data Retention Contract/i);
  assert.match(design, /Default app-side retention is 30 days/i);
  assert.match(design, /Team admins can shorten retention/i);
  assert.match(design, /uninstall cleanup/i);
  assert.match(design, /Stored fields/i);
  assert.match(design, /Avoided fields/i);
  assert.match(design, /full file contents/i);
  assert.match(design, /raw diffs/i);
  assert.match(design, /Raw worker checkout directories are deleted after scan completion/i);
  assert.match(design, /Do not train models on customer code or findings/i);
  assert.match(design, /prefer the local CLI/i);
  assert.match(readme, /prefer the local CLI/i);
  assert.match(readme, /private repositories, offline review, or no-account workflows/i);
});

test("repository exposes security-safe GitHub issue templates", async () => {
  const templateDir = resolve(packageRoot, ".github", "ISSUE_TEMPLATE");
  const expectedTemplates = [
    {
      file: "bug_report.yml",
      name: "Bug report",
      label: "bug",
      phrases: ["Steps to reproduce", "Expected behavior", "Actual behavior", "No real API keys"]
    },
    {
      file: "false_positive.yml",
      name: "False positive",
      label: "bug",
      phrases: ["Rule ID", "Why this looks safe", "Scanner output", "No real API keys"]
    },
    {
      file: "false_negative.yml",
      name: "False negative",
      label: "bug",
      phrases: ["Rule ID or risk area", "Why this is risky", "Minimal public example", "No real API keys"]
    },
    {
      file: "rule_request.yml",
      name: "Rule request",
      label: "enhancement",
      phrases: ["Risk area", "Evidence pattern", "Manual verification", "not a full security audit"]
    },
    {
      file: "security_safe_report.yml",
      name: "Security-safe report",
      label: "bug",
      phrases: ["public-safe", "Do not post secrets", "Do not include exploit steps", "local-first"]
    }
  ];

  for (const template of expectedTemplates) {
    const body = await readFile(resolve(templateDir, template.file), "utf8");

    assert.match(body, new RegExp(`name:\\s*${template.name}`));
    assert.match(body, new RegExp(`labels:\\s*\\[.*${template.label}.*\\]`));
    assert.match(body, /body:\s*\n/);
    assert.match(body, /validations:\s*\n\s+required:\s+true/);

    for (const phrase of template.phrases) {
      assert.match(body, new RegExp(phrase.replaceAll(" ", "\\s+"), "i"), template.file);
    }

    assert.doesNotMatch(body, /sk_(?:live|test)_[A-Za-z0-9]+/);
    assert.doesNotMatch(body, /whsec_[A-Za-z0-9]+/);
  }

  const config = await readFile(resolve(templateDir, "config.yml"), "utf8");
  assert.match(config, /blank_issues_enabled:\s*false/);
  assert.match(config, /docs\/launch-readiness-checklist\.md/);
});

test("repository exposes CODEOWNERS for public maintenance boundaries", async () => {
  const codeowners = await readFile(resolve(packageRoot, ".github", "CODEOWNERS"), "utf8");

  assert.match(codeowners, /^\*\s+@zr9959/m);
  assert.match(codeowners, /^\/src\/\s+@zr9959/m);
  assert.match(codeowners, /^\/tests\/\s+@zr9959/m);
  assert.match(codeowners, /^\/docs\/\s+@zr9959/m);
  assert.match(codeowners, /^\/\.github\/workflows\/\s+@zr9959/m);
  assert.match(codeowners, /^\/action\.yml\s+@zr9959/m);
  assert.doesNotMatch(codeowners, /@[^z\s][^\s]*/);
});

test("GitHub Action keeps colon-bearing descriptions YAML-safe", async () => {
  const action = await readFile(resolve(packageRoot, "action.yml"), "utf8");

  assert.doesNotMatch(action, /^\s+description:\s+[^"'][^#\n]*:\s+/m);
});

test("CI runs GitHub Actions static analysis", async () => {
  const workflow = await readFile(resolve(packageRoot, ".github/workflows/ci.yml"), "utf8");

  assert.match(workflow, /actionlint:/);
  assert.match(workflow, /go install github\.com\/rhysd\/actionlint\/cmd\/actionlint@v\d+\.\d+\.\d+/);
  assert.match(workflow, /run: actionlint/);
  assert.match(workflow, /zizmor:/);
  assert.match(workflow, /uses: zizmorcore\/zizmor-action@[a-f0-9]{40}/);
  assert.match(workflow, /advanced-security: false/);
});

test("repository enables low-noise Dependabot updates", async () => {
  const dependabot = await readFile(resolve(packageRoot, ".github", "dependabot.yml"), "utf8");

  assert.match(dependabot, /version:\s*2/);
  assert.match(dependabot, /package-ecosystem:\s*"npm"/);
  assert.match(dependabot, /package-ecosystem:\s*"github-actions"/);
  assert.match(dependabot, /directory:\s*"\/"/);
  assert.match(dependabot, /interval:\s*"weekly"/);
  assert.equal(dependabot.match(/cooldown:\s*\n\s+default-days:\s*7/g)?.length, 2);
  assert.match(dependabot, /semver-major-days:\s*21/);
  assert.match(dependabot, /semver-minor-days:\s*7/);
  assert.match(dependabot, /semver-patch-days:\s*3/);
  assert.match(dependabot, /open-pull-requests-limit:\s*5/);
  assert.match(dependabot, /labels:\s*\n\s+-\s*"dependencies"/);
  assert.doesNotMatch(dependabot, /registries:|token:|password:|secrets\./i);
});

test("repository runs CodeQL SAST with least privilege", async () => {
  const workflow = await readFile(resolve(packageRoot, ".github/workflows/codeql.yml"), "utf8");

  assert.match(workflow, /name:\s*CodeQL/);
  assert.match(workflow, /pull_request:/);
  assert.match(workflow, /push:\s*\n\s+branches:\s*\n\s+-\s+main/);
  assert.match(workflow, /schedule:\s*\n\s+-\s+cron:/);
  assert.match(workflow, /contents:\s*read/);
  assert.match(workflow, /security-events:\s*write/);
  assert.doesNotMatch(workflow, /actions:\s*read/);
  assert.match(workflow, /languages:\s*javascript-typescript/);
  assert.match(workflow, /build-mode:\s*none/);
  assert.match(workflow, /github\/codeql-action\/init@[a-f0-9]{40}/);
  assert.match(workflow, /github\/codeql-action\/analyze@[a-f0-9]{40}/);
  assert.doesNotMatch(workflow, /github\/codeql-action\/(?:init|analyze)@v\d/i);
  assert.doesNotMatch(workflow, /secrets\.|id-token:\s*write|contents:\s*write/i);
});

test("repository exposes Scorecard-detectable fuzzing", async () => {
  const packageJson = JSON.parse(await readFile(resolve(packageRoot, "package.json"), "utf8"));
  const workflow = await readFile(resolve(packageRoot, ".github", "workflows", "ci.yml"), "utf8");
  const fuzzTest = await readFile(resolve(packageRoot, "tests", "fuzz.test.js"), "utf8");
  const governance = await readFile(resolve(packageRoot, "docs", "repository-trust-hardening.md"), "utf8");

  assert.equal(packageJson.devDependencies["fast-check"], "^4.8.0");
  assert.match(packageJson.scripts.test, /tests\/\*\.test\.js/);
  assert.equal(packageJson.scripts["test:fuzz"], "npm run build && node --test tests/fuzz.test.js");
  assert.match(workflow, /\n\s+fuzz:/);
  assert.match(workflow, /npm run test:fuzz/);
  assert.match(fuzzTest, /from "fast-check"/);
  assert.match(fuzzTest, /fc\.assert/);
  assert.match(fuzzTest, /fc\.(?:property|asyncProperty)/);
  assert.match(governance, /fast-check/i);
  assert.match(governance, /fuzz/i);
});

test("repository documents strict Scorecard branch protection controls", async () => {
  const governance = await readFile(resolve(packageRoot, "docs", "repository-trust-hardening.md"), "utf8");

  assert.match(governance, /administrator enforcement/i);
  assert.match(governance, /stale review dismissal/i);
  assert.match(governance, /CODEOWNERS review/i);
  assert.match(governance, /last-push approval/i);
  assert.match(governance, /two approving reviews/i);
  assert.match(governance, /fuzz/);
  assert.match(governance, /OpenSSF Best Practices Badge/i);
});

test("repository documents signed release provenance assets", async () => {
  const readme = await readFile(resolve(packageRoot, "README.md"), "utf8");
  const zhReadme = await readFile(resolve(packageRoot, "README.zh-CN.md"), "utf8");
  const governance = await readFile(resolve(packageRoot, "docs", "repository-trust-hardening.md"), "utf8");

  for (const document of [readme, zhReadme, governance]) {
    assert.match(document, /sigstore\.json/i);
    assert.match(document, /intoto\.jsonl/i);
    assert.match(document, /npm provenance|npm trusted publishing/i);
  }
});

test("repository exposes OpenSSF Best Practices passing badge evidence", async () => {
  const readme = await readFile(resolve(packageRoot, "README.md"), "utf8");
  const zhReadme = await readFile(resolve(packageRoot, "README.zh-CN.md"), "utf8");
  const governance = await readFile(resolve(packageRoot, "docs", "repository-trust-hardening.md"), "utf8");
  const contributing = await readFile(resolve(packageRoot, "CONTRIBUTING.md"), "utf8");
  const badge = JSON.parse(await readFile(resolve(packageRoot, ".bestpractices.json"), "utf8"));

  assert.equal(badge.name, "ai-saas-guard");
  assert.equal(badge.repo_url, "https://github.com/zr9959/ai-saas-guard");
  assert.equal(badge.license, "MIT");
  assert.match(badge.description, /local-first/i);
  assert.match(badge.implementation_languages, /TypeScript/);

  for (const criterion of [
    "description_good",
    "interact",
    "contribution",
    "floss_license",
    "license_location",
    "repo_public",
    "version_semver",
    "test",
    "test_policy",
    "static_analysis"
  ]) {
    assert.equal(badge[`${criterion}_status`], "Met", criterion);
    assert.match(badge[`${criterion}_justification`], /https:\/\/github\.com\/zr9959\/ai-saas-guard/);
  }

  assert.match(contributing, /Pull request process/i);
  assert.match(contributing, /npm test/);
  assert.match(contributing, /release-quality-knowledge-base\.md/);
  assert.match(contributing, /No real API keys/i);
  assert.match(readme, /https:\/\/www\.bestpractices\.dev\/projects\/12955/);
  assert.match(readme, /OpenSSF Best Practices/);
  assert.match(readme, /CONTRIBUTING\.md/);
  assert.match(readme, /\.bestpractices\.json/);
  assert.match(zhReadme, /https:\/\/www\.bestpractices\.dev\/projects\/12955/);
  assert.match(zhReadme, /OpenSSF Best Practices/);
  assert.match(zhReadme, /CONTRIBUTING\.md/);
  assert.match(zhReadme, /\.bestpractices\.json/);
  assert.match(governance, /https:\/\/www\.bestpractices\.dev\/projects\/12955/);
  assert.match(governance, /Passing achieved on 2026-05-24/);
  assert.match(governance, /\.bestpractices\.json/);
  assert.doesNotMatch(contributing, /sk_(?:live|test)_[A-Za-z0-9]+|whsec_[A-Za-z0-9]+/);
});

test("public docs describe the live Cloudflare hosted ingress without overclaiming scans", async () => {
  const readme = await readFile(resolve(packageRoot, "README.md"), "utf8");
  const zhReadme = await readFile(resolve(packageRoot, "README.zh-CN.md"), "utf8");
  const handoff = await readFile(resolve(packageRoot, "docs", "project-handoff.md"), "utf8");
  const deployment = await readFile(resolve(packageRoot, "docs", "github-app-deployment.md"), "utf8");
  const cloudflareReadme = await readFile(
    resolve(packageRoot, "hosted", "cloudflare-worker", "README.md"),
    "utf8"
  );

  for (const document of [readme, zhReadme, handoff, deployment, cloudflareReadme]) {
    assert.match(document, /https:\/\/ai-saas-guard-hosted\.zr9959\.workers\.dev/);
    assert.match(document, /ai-saas-guard-hosted/);
    assert.match(document, /3834787/);
    assert.match(document, /sign|签名/i);
    assert.match(document, /Check Run|check run/i);
  }

  assert.match(cloudflareReadme, /\/github\/app\/manifest-callback/);
  assert.match(cloudflareReadme, /1 MiB/);
  assert.match(cloudflareReadme, /shouldCreateCheckRun/);
  assert.match(cloudflareReadme, /not yet the complete scan worker/i);
  assert.doesNotMatch(
    `${readme}\n${zhReadme}\n${handoff}\n${cloudflareReadme}`,
    /full hosted product|complete hosted scanner/i
  );
});

test("npm publish workflow uses token-free trusted publishing", async () => {
  const workflow = await readFile(resolve(packageRoot, ".github/workflows/npm-publish.yml"), "utf8");
  const packageJson = JSON.parse(await readFile(resolve(packageRoot, "package.json"), "utf8"));
  const expectedRefPattern = `v${packageJson.version}`.replaceAll(".", "\\.");

  assert.match(workflow, /release:\s*\n\s+types:\s*\[published\]/);
  assert.match(workflow, /workflow_dispatch:/);
  assert.match(workflow, new RegExp(`default:\\s*${expectedRefPattern}`));
  assert.match(workflow, /id-token:\s*write/);
  assert.match(workflow, /node-version:\s*24/);
  assert.match(workflow, /registry-url:\s*https:\/\/registry\.npmjs\.org/);
  assert.match(workflow, /package-manager-cache:\s*false/);
  assert.match(workflow, /npm publish --access public/);
  assert.doesNotMatch(workflow, /NODE_AUTH_TOKEN/);
  assert.doesNotMatch(workflow, /secrets\.NPM_TOKEN/);
  assert.doesNotMatch(workflow, /_authToken/i);
});

test("package bin entries are publish-safe npm paths", async () => {
  const packageJson = JSON.parse(await readFile(resolve(packageRoot, "package.json"), "utf8"));

  assert.deepEqual(packageJson.bin, {
    "ai-saas-guard": "dist/cli.js",
    "launch-guard": "dist/cli.js"
  });
});

test("hosted contract helpers have an explicit npm subpath export", async () => {
  const packageJson = JSON.parse(await readFile(resolve(packageRoot, "package.json"), "utf8"));

  assert.deepEqual(packageJson.exports["./hosted/contracts"], {
    types: "./dist/hosted/contracts.d.ts",
    default: "./dist/hosted/contracts.js"
  });
  assert.deepEqual(packageJson.exports["./hosted/service"], {
    types: "./dist/hosted/service.d.ts",
    default: "./dist/hosted/service.js"
  });
  assert.deepEqual(packageJson.exports["./hosted/github-app"], {
    types: "./dist/hosted/github-app.d.ts",
    default: "./dist/hosted/github-app.js"
  });
  assert.deepEqual(packageJson.exports["./hosted/production-adapters"], {
    types: "./dist/hosted/production-adapters.d.ts",
    default: "./dist/hosted/production-adapters.js"
  });
  assert.deepEqual(packageJson.exports["./hosted/app"], {
    types: "./dist/hosted/app.d.ts",
    default: "./dist/hosted/app.js"
  });
  assert.deepEqual(packageJson.exports["./hosted/staging"], {
    types: "./dist/hosted/staging.d.ts",
    default: "./dist/hosted/staging.js"
  });
  assert.deepEqual(packageJson.exports["./hosted/staging-harness"], {
    types: "./dist/hosted/staging-harness.d.ts",
    default: "./dist/hosted/staging-harness.js"
  });
});

async function runCli(args) {
  try {
    const result = await execFileAsync("node", [resolve(packageRoot, "dist/cli.js"), ...args]);
    return {
      code: 0,
      stdout: result.stdout,
      stderr: result.stderr
    };
  } catch (error) {
    return {
      code: error.code,
      stdout: error.stdout ?? "",
      stderr: error.stderr ?? ""
    };
  }
}

async function writeMinimalStripeWebhook(rootDir) {
  const apiDir = resolve(rootDir, "app", "api", "stripe", "webhook");
  await mkdir(apiDir, { recursive: true });
  await writeFile(
    resolve(apiDir, "route.ts"),
    `export async function POST(req: Request) {
  const event = await req.json();
  if (event.type === "checkout.session.completed") {
    await grantAccess(event.data.object.customer);
  }
  return Response.json({ ok: true });
}
`
  );
}
