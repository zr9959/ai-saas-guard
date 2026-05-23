import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { execFile } from "node:child_process";
import { dirname, resolve } from "node:path";
import { tmpdir } from "node:os";
import { test } from "node:test";
import { promisify } from "node:util";
import { fileURLToPath } from "node:url";

import {
  checkMcp,
  checkStripe,
  checkSupabase,
  classifyPrRisk,
  createScanContext,
  getRuleMetadata,
  RULE_CATALOG,
  scanRepository
} from "../dist/index.js";

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
  "api.route.auth-without-ownership",
  "api.route.missing-rate-limit",
  "deploy.edge-runtime-node-api",
  "deploy.env.example-missing",
  "deploy.next.static-export-api-risk",
  "mcp.config.broad-filesystem",
  "mcp.config.insecure-http",
  "mcp.config.invalid-json",
  "mcp.config.loose-permissions",
  "mcp.config.non-local-bind",
  "mcp.config.plaintext-secret",
  "mcp.tool.raw-sql",
  "mcp.tool.shell",
  "next.env.public-secret",
  "pr-risk.diff-unavailable",
  "pr-risk.no-diff",
  "pr-risk.sensitive-surface",
  "secrets.detected",
  "stripe.webhook.missing-critical-event",
  "stripe.webhook.missing-idempotency",
  "stripe.webhook.missing-route",
  "stripe.webhook.missing-signature",
  "stripe.webhook.no-entitlement-path",
  "stripe.webhook.public-secret",
  "stripe.webhook.raw-body-risk",
  "supabase.rls.broad-policy",
  "supabase.rls.missing-ownership-filter",
  "supabase.rls.not-enabled",
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

test("rule catalog contains metadata for every published rule", () => {
  assert.deepEqual(Object.keys(RULE_CATALOG).sort(), expectedRuleIds);

  for (const ruleId of expectedRuleIds) {
    const metadata = getRuleMetadata(ruleId);
    assert.equal(metadata?.ruleId, ruleId);
    assert.ok(metadata?.title);
    assert.ok(metadata?.why);
    assert.match(metadata?.stability ?? "", /^(default|experimental|strict)$/);
  }
});

test("vulnerable Stripe webhook reports missing signature, idempotency, and critical events", async () => {
  const report = await checkStripe({
    rootDir: resolve(fixtureRoot, "vulnerable-stripe")
  });

  assert.equal(report.command, "check-stripe");
  assert.ok(findingRuleIds(report).includes("stripe.webhook.missing-signature"));
  assert.ok(findingRuleIds(report).includes("stripe.webhook.missing-idempotency"));
  assert.ok(report.missingCriticalEvents.includes("invoice.payment_failed"));
  assert.ok(report.missingCriticalEvents.includes("customer.subscription.deleted"));
  assert.ok(report.handledEvents.includes("checkout.session.completed"));
  assert.ok(report.testCommands.some((command) => command.includes("stripe trigger invoice.payment_failed")));
});

test("safe Stripe webhook recognizes signature verification and billing failure handlers", async () => {
  const report = await checkStripe({
    rootDir: resolve(fixtureRoot, "safe-stripe")
  });

  assert.equal(report.missingCriticalEvents.length, 0);
  assert.ok(report.handledEvents.includes("invoice.payment_failed"));
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
    assert.ok(!packedPaths.some((filePath) => filePath.startsWith("._") || filePath.includes("/._")));
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
  assert.match(action, /run:\s+npm ci/);
});

test("GitHub Action validates enumerated inputs before invoking the CLI", async () => {
  const action = await readFile(resolve(packageRoot, "action.yml"), "utf8");
  const runStep = action.match(/- name: Run ai-saas-guard[\s\S]*?run:\s*\|([\s\S]*)/);

  assert.ok(runStep, "expected action.yml to contain the Run ai-saas-guard step");
  assert.match(runStep[1], /case "\$\{INPUT_COMMAND\}" in[\s\S]*scan\|check-supabase\|check-stripe\|check-mcp\|pr-risk/);
  assert.match(runStep[1], /case "\$\{INPUT_FORMAT\}" in[\s\S]*terminal\|json\|sarif\|markdown/);
  assert.match(runStep[1], /case "\$\{INPUT_FAIL_ON\}" in[\s\S]*none\|critical\|high\|medium\|low\|info/);
  assert.match(runStep[1], /--markdown/);
  assert.match(runStep[1], /exit 2/);
});

test("public docs explain PR summary, SARIF, and the v0 Action tag", async () => {
  const readme = await readFile(resolve(packageRoot, "README.md"), "utf8");
  const actionDocs = await readFile(resolve(packageRoot, "docs", "github-action.md"), "utf8");

  assert.match(readme, /zr9959\/ai-saas-guard@v0/);
  assert.match(readme, /format:\s*markdown/);
  assert.match(readme, /GITHUB_STEP_SUMMARY/);
  assert.match(actionDocs, /PR summary/i);
  assert.match(actionDocs, /SARIF/i);
  assert.match(actionDocs, /Use SARIF/i);
  assert.match(actionDocs, /Use markdown/i);
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
