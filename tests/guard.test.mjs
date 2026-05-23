import assert from "node:assert/strict";
import { mkdir, mkdtemp, readFile, writeFile } from "node:fs/promises";
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
