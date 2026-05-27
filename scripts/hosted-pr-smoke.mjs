#!/usr/bin/env node
import { execFile } from "node:child_process";
import { mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const DEFAULTS = {
  repo: "zr9959/ai-saas-guard",
  base: "main",
  branchPrefix: "codex/hosted-smoke",
  checkName: "ai-saas-guard PR risk",
  workerUrl: "https://ai-saas-guard-hosted.zr9959.workers.dev",
  kvNamespaceId: "fa5344fbd7944de6a776bf8731d58460",
  waitSeconds: 180
};

const args = parseArgs(process.argv.slice(2));
const options = {
  ...DEFAULTS,
  ...args
};

if (options.help) {
  printHelp();
  process.exit(0);
}

const plan = createPlan(options);

if (options.plan) {
  console.log(JSON.stringify(plan, null, 2));
  process.exit(0);
}

await runSmoke(plan);

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--plan") parsed.plan = true;
    else if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg.startsWith("--repo=")) parsed.repo = arg.slice("--repo=".length);
    else if (arg === "--repo") parsed.repo = argv[++index];
    else if (arg.startsWith("--base=")) parsed.base = arg.slice("--base=".length);
    else if (arg === "--base") parsed.base = argv[++index];
    else if (arg.startsWith("--worker-url=")) parsed.workerUrl = arg.slice("--worker-url=".length);
    else if (arg === "--worker-url") parsed.workerUrl = argv[++index];
    else if (arg.startsWith("--kv-namespace-id=")) parsed.kvNamespaceId = arg.slice("--kv-namespace-id=".length);
    else if (arg === "--kv-namespace-id") parsed.kvNamespaceId = argv[++index];
    else if (arg.startsWith("--wait-seconds=")) parsed.waitSeconds = Number(arg.slice("--wait-seconds=".length));
    else if (arg === "--wait-seconds") parsed.waitSeconds = Number(argv[++index]);
    else if (arg.startsWith("--evidence-file=")) parsed.evidenceFile = arg.slice("--evidence-file=".length);
    else if (arg === "--evidence-file") parsed.evidenceFile = argv[++index];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return parsed;
}

function createPlan(input) {
  validateSafeInput(input);
  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  const branch = `${input.branchPrefix}-${stamp}`;

  return {
    repo: input.repo,
    base: input.base,
    branch,
    checkName: input.checkName,
    workerUrl: input.workerUrl,
    installInfoUrl: `${input.workerUrl.replace(/\/+$/g, "")}/github/app/install-info`,
    healthUrl: `${input.workerUrl.replace(/\/+$/g, "")}/healthz`,
    kvNamespaceId: input.kvNamespaceId,
    evidenceFile: input.evidenceFile,
    waitSeconds: input.waitSeconds,
    privacy: {
      writesSourceToLogs: false,
      writesTokensToLogs: false,
      uploadsLocalSource: false,
      deletesTemporaryBranch: true,
      closesTemporaryPullRequest: true,
      clearsHostedKvSmokeRecords: true
    },
    steps: [
      "Verify hosted /healthz and /github/app/install-info.",
      "Create a temporary branch from the base branch.",
      "Commit one public smoke marker file with no secrets or source excerpts.",
      "Push the temporary branch and open a draft-free pull request.",
      "Wait for the hosted GitHub App Check Run on the trusted head SHA.",
      "Record only Check Run conclusion, URL, and safe summary fields.",
      "Close the temporary pull request, delete the remote branch, restore the local branch.",
      "Delete only smoke-scoped staging KV delivery and scan records."
    ]
  };
}

function validateSafeInput(input) {
  if (input.repo !== DEFAULTS.repo) {
    throw new Error(`Refusing hosted smoke outside ${DEFAULTS.repo}`);
  }
  if (!/^[a-z0-9._-]+\/[a-z0-9._-]+$/i.test(input.repo)) {
    throw new Error("Invalid GitHub repository name");
  }
  if (!/^[a-z0-9._/-]+$/i.test(input.base) || input.base.startsWith("-")) {
    throw new Error("Invalid base branch");
  }
  if (!String(input.workerUrl).startsWith("https://")) {
    throw new Error("Worker URL must be HTTPS");
  }
  if (!/^[a-f0-9]{32}$/i.test(input.kvNamespaceId)) {
    throw new Error("KV namespace id must be a 32-character hex id");
  }
  if (!Number.isSafeInteger(input.waitSeconds) || input.waitSeconds < 30 || input.waitSeconds > 600) {
    throw new Error("wait-seconds must be between 30 and 600");
  }
  if (input.evidenceFile !== undefined && (!input.evidenceFile || input.evidenceFile.startsWith("-") || input.evidenceFile.includes("\0"))) {
    throw new Error("Invalid evidence file path");
  }
}

async function runSmoke(plan) {
  let originalBranch;
  let prNumber;
  let result;
  let cleanup;

  try {
    await verifyHostedEndpoints(plan);
    const status = (await git(["status", "--porcelain"])).trim();
    if (status) {
      throw new Error("Refusing hosted smoke with dirty working tree");
    }
    originalBranch = (await git(["branch", "--show-current"])).trim();
    await git(["fetch", "origin", plan.base]);
    await git(["switch", "-c", plan.branch, `origin/${plan.base}`]);
    await writeFile(
      ".github/ai-saas-guard-hosted-smoke.md",
      `# ai-saas-guard hosted smoke\n\nTemporary hosted GitHub App smoke for ${new Date().toISOString()}.\n`
    );
    await git(["add", ".github/ai-saas-guard-hosted-smoke.md"]);
    await git(["commit", "-m", "Run hosted GitHub App smoke"]);
    await git(["push", "-u", "origin", plan.branch]);

    const prUrl = (
      await gh([
        "pr",
        "create",
        "--repo",
        plan.repo,
        "--base",
        plan.base,
        "--head",
        plan.branch,
        "--title",
        "Hosted GitHub App smoke",
        "--body",
        "Temporary hosted smoke PR. It should be closed and deleted by scripts/hosted-pr-smoke.mjs."
      ])
    ).trim();
    prNumber = Number(prUrl.split("/").pop());
    if (!Number.isSafeInteger(prNumber)) throw new Error(`Could not parse PR number from ${prUrl}`);

    const headSha = (await git(["rev-parse", "HEAD"])).trim();
    const checkRun = await waitForCheckRun({ ...plan, headSha });

    result = {
      ok: true,
      generatedAt: new Date().toISOString(),
      repo: plan.repo,
      base: plan.base,
      branch: plan.branch,
      pullRequest: prNumber,
      headSha,
      checkRun,
      privacy: plan.privacy
    };
  } finally {
    cleanup = await cleanupSmoke({ plan, prNumber, originalBranch });
  }

  if (result) {
    result.cleanup = cleanup;
    await writeEvidence(plan, result);
    console.log(JSON.stringify(result, null, 2));
  }
}

async function verifyHostedEndpoints(plan) {
  const health = JSON.parse(await curlJson(plan.healthUrl));
  if (health.ok !== true || health.checkRunPublisher !== "configured") {
    throw new Error("Hosted health is not ready for smoke");
  }
  const installInfo = JSON.parse(await curlJson(plan.installInfoUrl));
  if (installInfo.ok !== true || installInfo.installUrl !== "https://github.com/apps/ai-saas-guard-hosted/installations/new") {
    throw new Error("Hosted install-info is not ready for smoke");
  }
}

async function waitForCheckRun(plan) {
  const deadline = Date.now() + plan.waitSeconds * 1000;
  while (Date.now() < deadline) {
    const response = JSON.parse(
      await gh([
        "api",
        "--method",
        "GET",
        `repos/${plan.repo}/commits/${plan.headSha}/check-runs`,
        "-f",
        `check_name=${plan.checkName}`
      ])
    );
    const run = response.check_runs?.find((candidate) => candidate.name === plan.checkName);
    if (run?.status === "completed") {
      return {
        id: run.id,
        conclusion: run.conclusion,
        htmlUrl: run.html_url,
        title: run.output?.title
      };
    }
    await sleep(5000);
  }
  throw new Error(`Timed out waiting for Check Run: ${plan.checkName}`);
}

async function cleanupSmoke({ plan, prNumber, originalBranch }) {
  const cleanup = {
    closedPullRequest: false,
    deletedRemoteBranch: false,
    restoredBranch: false,
    deletedLocalBranch: false,
    kv: { deletedKeys: 0, remainingSmokeKeys: 0 }
  };
  if (prNumber) {
    cleanup.closedPullRequest = await ignoreFailure(gh(["pr", "close", String(prNumber), "--repo", plan.repo, "--delete-branch"]));
  }
  cleanup.deletedRemoteBranch = await ignoreFailure(git(["push", "origin", "--delete", plan.branch]));
  if (originalBranch) {
    cleanup.restoredBranch = await ignoreFailure(git(["switch", originalBranch]));
  }
  cleanup.deletedLocalBranch = await ignoreFailure(git(["branch", "-D", plan.branch]));
  cleanup.kv = await clearHostedKv(plan, prNumber);
  return cleanup;
}

async function clearHostedKv(plan, prNumber) {
  if (!prNumber) return { deletedKeys: 0, remainingSmokeKeys: 0 };
  const keys = await listHostedKvKeys(plan);
  const scanKeys = await scanKeysForPullRequest(plan, keys, prNumber);
  const deliveryKeys = await deliveryKeysForPullRequest(plan, keys, prNumber, new Set(scanKeys));
  const keysToDelete = [...new Set([...scanKeys, ...deliveryKeys])];
  if (keysToDelete.length === 0) return { deletedKeys: 0, remainingSmokeKeys: 0 };

  await bulkDeleteHostedKvKeys(plan, keysToDelete);
  const remainingKeys = await listHostedKvKeys(plan);
  const remainingScanKeys = await scanKeysForPullRequest(plan, remainingKeys, prNumber);
  const remainingDeliveryKeys = await deliveryKeysForPullRequest(plan, remainingKeys, prNumber, new Set(remainingScanKeys));
  return {
    deletedKeys: keysToDelete.length,
    remainingSmokeKeys: new Set([...remainingScanKeys, ...remainingDeliveryKeys]).size
  };
}

async function listHostedKvKeys(plan) {
  const listJson = await wrangler(["kv", "key", "list", "--namespace-id", plan.kvNamespaceId, "--remote"]);
  return JSON.parse(listJson).map((item) => item.name).filter((name) => typeof name === "string");
}

async function scanKeysForPullRequest(plan, keys, prNumber) {
  const result = [];
  for (const key of keys) {
    if (!key.startsWith("scan:") || key.split(":")[3] !== String(prNumber)) continue;
    const record = await readHostedKvRecord(plan, key);
    if (isSmokeKvRecord(record, plan, prNumber)) result.push(key);
  }
  return result;
}

async function deliveryKeysForPullRequest(plan, keys, prNumber, scanKeys) {
  const result = [];
  for (const key of keys) {
    if (!key.startsWith("delivery:")) continue;
    const record = await readHostedKvRecord(plan, key);
    if (isSmokeKvRecord(record, plan, prNumber) || scanKeys.has(record?.scanKey)) result.push(key);
  }
  return result;
}

async function readHostedKvRecord(plan, key) {
  try {
    const value = await wrangler(["kv", "key", "get", key, "--namespace-id", plan.kvNamespaceId, "--remote"]);
    return JSON.parse(value);
  } catch {
    return undefined;
  }
}

function isSmokeKvRecord(record, plan, prNumber) {
  const identity = record?.identity;
  return (
    identity?.repositoryFullName === plan.repo &&
    Number(identity?.pullRequestNumber) === Number(prNumber)
  );
}

async function bulkDeleteHostedKvKeys(plan, keys) {
  const file = join(tmpdir(), `ai-saas-guard-hosted-kv-delete-${Date.now()}.json`);
  await writeFile(file, JSON.stringify(keys, null, 2));
  try {
    await wrangler(["kv", "bulk", "delete", file, "--namespace-id", plan.kvNamespaceId, "--remote", "--force"]);
  } finally {
    await rm(file, { force: true });
  }
}

async function writeEvidence(plan, result) {
  if (!plan.evidenceFile) return;
  await mkdir(dirname(plan.evidenceFile), { recursive: true });
  await writeFile(plan.evidenceFile, `${JSON.stringify(result, null, 2)}\n`, { mode: 0o600 });
}

async function git(args) {
  return run("git", args);
}

async function gh(args) {
  return run("gh", args);
}

async function wrangler(args) {
  return run("npx", ["wrangler", ...args], { cwd: "hosted/cloudflare-worker" });
}

async function curlJson(url) {
  return run("curl", ["-fsSL", url]);
}

async function run(command, args, options = {}) {
  const { stdout } = await execFileAsync(command, args, {
    cwd: options.cwd ?? process.cwd(),
    maxBuffer: 1024 * 1024
  });
  return stdout;
}

async function ignoreFailure(promise) {
  try {
    await promise;
    return true;
  } catch {
    // Cleanup should continue through already-removed branches, PRs, or KV records.
    return false;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function printHelp() {
  console.log(`Usage: node scripts/hosted-pr-smoke.mjs [--plan] [--evidence-file <path>]\n\nRuns a real hosted GitHub App staging smoke against ${DEFAULTS.repo}.\nThe real run creates a temporary PR, waits for the hosted Check Run, closes the PR, deletes the branch, and clears matching staging KV smoke records.`);
}
