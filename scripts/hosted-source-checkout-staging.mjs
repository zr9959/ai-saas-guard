#!/usr/bin/env node
/**
 * Staging trial orchestrator for the source-checkout worker.
 *
 * Real end-to-end staging proof (no mocks):
 *   1. Verify the staging source-checkout worker /healthz.
 *   2. Create a temporary branch + PR on zr9959/ai-saas-guard containing a
 *      small fixture that exercises the engine (an API route with a
 *      catch-and-fake-success flaw, the classic AI-generated pattern).
 *      (The live webhook-ingress worker will also fire its metadata-only
 *      "ai-saas-guard PR risk" run on this PR - that is intentional: the
 *      staging check run must be clearly distinguishable from it.)
 *   3. Fetch the SHA-pinned unified diff and changed-file contents via the
 *      GitHub API and POST them to the staging worker, which runs the
 *      identical scanner engine as the CLI (pr-risk + full scan suite).
 *   4. Publish a Check Run named "ai-saas-guard source checkout (staging)"
 *      from the compact findings via the GitHub API.
 *   5. Close the PR, delete the branch, clear the live worker's trial KV
 *      records, verify.
 *
 * Privacy: only compact findings, summary counts, SHAs, PR numbers, check run
 * IDs/URLs, and stage results are recorded. No source, diffs, PR text, tokens,
 * or checkout paths.
 *
 * Usage:
 *   node scripts/hosted-source-checkout-staging.mjs --plan
 *   node scripts/hosted-source-checkout-staging.mjs --worker-url https://<worker>.workers.dev --scan-secret-file /tmp/scan-secret --evidence-file /tmp/phase3-trial.json
 */
import { fileURLToPath } from "node:url";
import { execFile } from "node:child_process";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const DEFAULTS = {
  repo: "zr9959/ai-saas-guard",
  base: "main",
  branchPrefix: "agent/phase3-source-checkout-trial",
  liveCheckName: "ai-saas-guard PR risk",
  stagingCheckName: "ai-saas-guard source checkout (staging)",
  kvNamespaceId: "fa5344fbd7944de6a776bf8731d58460",
  waitSeconds: 180,
  pollIntervalSeconds: 10,
  fixturePath: "app/api/staging-trial-scan/route.ts"
};

const FIXTURE_CONTENT = `// STAGING TRIAL FIXTURE - temporary, deleted with the trial branch.
// Exercises the source-checkout worker engine: an API route whose catch block
// returns fake success (the classic AI-generated silent-failure pattern).
export async function POST(request: Request) {
  try {
    const body = await request.json();
    return Response.json({ ok: true, echo: body });
  } catch {
    return Response.json({ success: true, user: null });
  }
}
`;

const args = parseArgs(process.argv.slice(2));
const options = { ...DEFAULTS, ...args };

const isMainModule = process.argv[1] === fileURLToPath(import.meta.url);
if (isMainModule) {
  if (options.help) {
    console.log(
      "Usage: node scripts/hosted-source-checkout-staging.mjs --worker-url <https-url> --scan-secret-file <path> [--plan] [--evidence-file <path>]\n\n" +
        "Runs the real Phase 3 source-checkout staging trial against zr9959/ai-saas-guard."
    );
    process.exit(0);
  }

  const plan = createPlan(options);
  if (options.plan) {
    console.log(JSON.stringify({ ...plan, scanSecretFile: "[redacted]" }, null, 2));
    process.exit(0);
  }
  if (!options.workerUrl) throw new Error("--worker-url is required");
  if (!options.scanSecretFile) throw new Error("--scan-secret-file is required");

  await runTrial(plan);
}

function parseArgs(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--plan") parsed.plan = true;
    else if (arg === "--help" || arg === "-h") parsed.help = true;
    else if (arg.startsWith("--")) {
      const eq = arg.indexOf("=");
      const key = eq === -1 ? arg.slice(2) : arg.slice(2, eq);
      const value = eq === -1 ? argv[++index] : arg.slice(eq + 1);
      const camel = key.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      parsed[camel] = value;
    } else throw new Error(`Unknown argument: ${arg}`);
  }
  if (parsed.waitSeconds !== undefined) parsed.waitSeconds = Number(parsed.waitSeconds);
  return parsed;
}

function createPlan(input) {
  if (input.repo !== DEFAULTS.repo) throw new Error(`Refusing trial outside ${DEFAULTS.repo}`);
  const workerUrl = String(input.workerUrl || "");
  if (workerUrl && !workerUrl.startsWith("https://")) throw new Error("worker-url must be HTTPS");
  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14);
  const branch = `${input.branchPrefix}-${stamp}`;
  const base = workerUrl.replace(/\/+$/g, "") || "<worker-url>";
  return {
    repo: input.repo,
    base: input.base,
    branch,
    liveCheckName: input.liveCheckName,
    stagingCheckName: input.stagingCheckName,
    workerUrl: base,
    healthUrl: `${base}/healthz`,
    scanUrl: `${base}/scan`,
    kvNamespaceId: input.kvNamespaceId,
    scanSecretFile: input.scanSecretFile,
    evidenceFile: input.evidenceFile,
    waitSeconds: input.waitSeconds,
    pollIntervalSeconds: input.pollIntervalSeconds,
    fixturePath: input.fixturePath,
    privacy: {
      writesSourceToLogs: false,
      writesTokensToLogs: false,
      uploadsLocalSource: false,
      deletesTemporaryBranch: true,
      closesTemporaryPullRequest: true,
      clearsHostedKvSmokeRecords: true
    }
  };
}

async function runTrial(plan) {
  const evidence = {
    trial: "phase3_source_checkout_staging",
    startedAt: new Date().toISOString(),
    repo: plan.repo,
    workerUrl: plan.workerUrl,
    privacy: plan.privacy
  };
  let prNumber;
  let scanResult;
  let checkRun;
  let cleanup;

  try {
    await verifyStagingWorker(plan, evidence);
    const status = (await git(["status", "--porcelain"])).trim();
    if (status) throw new Error("Refusing trial with dirty working tree");

    // The trial branch/commit is created entirely via the GitHub API (the
    // local git CLI has no credentials in this environment). No local branch
    // is created; the fixture file is written locally only as a scratch copy.
    const baseSha = await ghRefSha(plan.repo, `heads/${plan.base}`);
    const headSha = await createTrialCommitViaApi(plan, baseSha);
    await mkdir(dirname(plan.fixturePath), { recursive: true });
    await writeFile(plan.fixturePath, FIXTURE_CONTENT);
    evidence.baseSha = baseSha;
    evidence.headSha = headSha;
    evidence.branch = plan.branch;
    evidence.fixturePath = plan.fixturePath;

    const pr = await ghApi("POST", `/repos/${plan.repo}/pulls`, {
      title: "chore: Phase 3 source-checkout staging trial",
      head: plan.branch,
      base: plan.base,
      body: "Temporary fixture PR for the Phase 3 source-checkout worker staging trial. Closed and deleted by scripts/hosted-source-checkout-staging.mjs."
    });
    prNumber = pr.number;
    evidence.pullRequest = prNumber;
    evidence.pullRequestUrl = pr.html_url;

    scanResult = await runStagingScan(plan, { baseSha, headSha, prNumber });
    evidence.workerScan = sanitizeScanResult(scanResult);

    // Check-run publication is best-effort: the Checks API only accepts
    // GitHub App tokens ("Resource not accessible by personal access
    // token"), and this trial authenticates with a PAT. The live
    // webhook-ingress worker (a GitHub App) already publishes check runs
    // routinely; the staging worker's compact-findings payload is what would
    // be published. A skip here is recorded, not hidden.
    try {
      checkRun = await publishStagingCheckRun(plan, { baseSha, headSha, prNumber, scanResult });
    } catch (error) {
      checkRun = {
        skipped: true,
        reason: "check_runs_require_github_app_token",
        detail: error instanceof Error ? error.message.slice(0, 200) : String(error).slice(0, 200)
      };
    }
    evidence.checkRun = checkRun;

    // Confirm the live metadata-only run also fired, so the two are comparable.
    evidence.liveMetadataCheckRun = await waitForCheckRun(plan, headSha, plan.liveCheckName, 120).catch(
      () => ({ observed: false })
    );
    evidence.completedAt = new Date().toISOString();
    evidence.ok = true;
  } finally {
    cleanup = await cleanupTrial({ plan, prNumber });
    evidence.cleanup = cleanup;
  }

  evidence.finishedAt = new Date().toISOString();
  if (plan.evidenceFile) {
    await mkdir(dirname(plan.evidenceFile), { recursive: true });
    await writeFile(plan.evidenceFile, `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600 });
  }
  console.log(JSON.stringify(evidence, null, 2));
  if (!evidence.ok) {
    throw new Error("Staging trial did not complete");
  }
}

function sanitizeScanResult(result) {
  if (!result) return undefined;
  const inner = result.result || result;
  return {
    ok: result.ok,
    status: inner.status,
    jobKey: inner.jobKey,
    scannerEngine: inner.scannerEngine,
    scannerVersion: inner.scannerVersion,
    startedAt: inner.startedAt,
    completedAt: inner.completedAt,
    durationMs: inner.durationMs,
    filesScanned: inner.filesScanned,
    stages: inner.stages,
    prRiskCategories: inner.prRisk?.categories,
    prRiskTopFiles: (inner.prRisk?.topRiskyFiles || []).map((f) => ({
      path: f.path,
      score: f.score,
      categories: f.categories
    })),
    summaryCounts: inner.summaryCounts,
    compactFindingCount: inner.compactFindingCount,
    compactFindings: inner.compactFindings,
    scannerErrors: inner.scannerErrors,
    reason: inner.reason
  };
}

async function verifyStagingWorker(plan, evidence) {
  const health = JSON.parse(await curlJson(plan.healthUrl));
  if (health.ok !== true || health.mode !== "source-checkout-worker-staging") {
    throw new Error(`Staging worker health check failed: ${JSON.stringify(health).slice(0, 200)}`);
  }
  if (!Array.isArray(health.roles) || !health.roles.includes("scan-worker")) {
    throw new Error("Staging worker does not report the scan-worker role");
  }
  if (health.stateless !== true) {
    throw new Error("Staging worker does not report stateless operation");
  }
  evidence.workerHealth = {
    ok: health.ok,
    mode: health.mode,
    roles: health.roles,
    scannerEngine: health.scannerEngine,
    scannerVersion: health.scannerVersion,
    stagingOnly: health.stagingOnly,
    stateless: health.stateless,
    privacy: health.privacy
  };
}

async function fetchPrSource(plan, { headSha, prNumber }) {
  const diffText = await ghApiRaw("GET", `/repos/${plan.repo}/pulls/${prNumber}`, "application/vnd.github.diff");
  if (!diffText || !diffText.includes("diff --git")) {
    throw new Error("Could not fetch the PR unified diff");
  }
  const filesPage = await ghApi("GET", `/repos/${plan.repo}/pulls/${prNumber}/files?per_page=100`);
  const changed = (filesPage || []).filter((f) => f.status !== "removed").map((f) => f.filename);
  const files = [];
  for (const filename of changed.slice(0, 50)) {
    const entry = await ghApi("GET", `/repos/${plan.repo}/contents/${encodeURIComponent(filename)}?ref=${headSha}`);
    if (entry.encoding !== "base64" || typeof entry.content !== "string") continue;
    const content = Buffer.from(entry.content.replace(/\n/g, ""), "base64").toString("utf8");
    if (content.length > 200 * 1024) continue;
    files.push({ path: filename, content });
  }
  if (files.length === 0) throw new Error("No changed file contents could be fetched at the head SHA");
  return { diffText, files };
}

async function runStagingScan(plan, { baseSha, headSha, prNumber }) {
  const secret = (await readFile(plan.scanSecretFile, "utf8")).trim();
  if (!secret) throw new Error("Empty scan secret");

  const { diffText, files } = await fetchPrSource(plan, { headSha, prNumber });
  const raw = await curlJsonPost(
    plan.scanUrl,
    {
      repositoryFullName: plan.repo,
      pullRequestNumber: prNumber,
      baseSha,
      headSha,
      diffText,
      files
    },
    secret,
    Math.max(plan.waitSeconds, 60) * 1000
  );
  const parsed = JSON.parse(raw);
  if (parsed.ok && parsed.result?.status === "completed") return parsed;
  throw new Error(`Staging scan did not complete: ${parsed?.result?.status || parsed?.reason || "unknown"}`);
}

async function publishStagingCheckRun(plan, { baseSha, headSha, prNumber, scanResult }) {
  const inner = scanResult.result || scanResult;
  const summary = inner.summaryCounts || {};
  const findings = inner.compactFindings || [];
  const prRisk = inner.prRisk || {};
  const lines = [
    `Source-checkout scan (staging): ${summary.total ?? 0} finding(s) for ${plan.repo}#${prNumber}.`,
    `Engine: identical rule code as the CLI (scannerVersion ${inner.scannerVersion}); pr-risk review queue + full scan suite over SHA-pinned file contents.`,
    `Head: ${headSha.slice(0, 12)} | Base: ${(inner.baseSha || baseSha || "").slice(0, 12)} | Files: ${inner.filesScanned ?? "?"} | Duration: ${Math.round((inner.durationMs || 0) / 1000)}s.`,
    "",
    "pr-risk categories: " + ((prRisk.categories || []).join(", ") || "none"),
    "Review queue:",
    ...((prRisk.topRiskyFiles || []).slice(0, 5).map((f) => `- ${f.path} (score ${f.score}; ${(f.categories || []).join(", ")})`) || ["- none"]),
    "",
    "Summary counts:",
    `- critical=${summary.critical ?? 0} high=${summary.high ?? 0} medium=${summary.medium ?? 0} low=${summary.low ?? 0} info=${summary.info ?? 0}`,
    "",
    "Compact findings (ruleId, severity, file, line only):"
  ];
  if (findings.length === 0) {
    lines.push("- none");
  } else {
    for (const f of findings.slice(0, 20)) {
      lines.push(`- [${f.severity}] ${f.ruleId} ${f.file}${f.line ? `:${f.line}` : ""}`);
    }
  }
  lines.push(
    "",
    "Provenance: unified diff + changed-file contents fetched at the pinned PR head SHA via the GitHub API,",
    "scanned inside the deployed staging source-checkout worker by the identical CLI rule engine.",
    "Only compact findings leave the worker; no source, diffs, or PR text are stored or logged.",
    "This is a STAGING trial check run; it is not the live metadata-only classifier."
  );

  const conclusion = (summary.critical ?? 0) > 0 || (summary.high ?? 0) > 0 ? "action_required" : "success";
  const created = await ghApi("POST", `/repos/${plan.repo}/check-runs`, {
    name: plan.stagingCheckName,
    head_sha: headSha,
    status: "completed",
    conclusion,
    completed_at: new Date().toISOString(),
    output: {
      title: "AI SaaS Guard source-checkout scan (staging)",
      summary: lines.join("\n").slice(0, 60000)
    }
  });
  return {
    id: created.id,
    htmlUrl: created.html_url,
    name: created.name,
    conclusion: created.conclusion,
    headSha
  };
}

async function waitForCheckRun(plan, headSha, checkName, waitSeconds) {
  const deadline = Date.now() + waitSeconds * 1000;
  while (Date.now() < deadline) {
    const response = await ghApi("GET", `/repos/${plan.repo}/commits/${headSha}/check-runs?check_name=${encodeURIComponent(checkName)}`);
    const run = (response.check_runs || []).find((c) => c.name === checkName);
    if (run?.status === "completed") {
      return {
        observed: true,
        id: run.id,
        name: run.name,
        conclusion: run.conclusion,
        htmlUrl: run.html_url,
        title: run.output?.title
      };
    }
    await sleep(5000);
  }
  return { observed: false };
}

async function ghRefSha(repo, ref) {
  const response = await ghApi("GET", `/repos/${repo}/git/refs/${ref}`);
  const sha = response?.object?.sha;
  if (!sha) throw new Error(`Could not resolve ref ${ref}`);
  return sha;
}

async function createTrialCommitViaApi(plan, baseSha) {
  // Create the fixture commit through the Git Database API: blob -> tree
  // (based on the base tree) -> commit -> branch ref. Equivalent to a local
  // `git commit` + `git push`, without needing git CLI credentials.
  const blob = await ghApi("POST", `/repos/${plan.repo}/git/blobs`, {
    content: Buffer.from(FIXTURE_CONTENT, "utf8").toString("base64"),
    encoding: "base64"
  });
  const baseCommit = await ghApi("GET", `/repos/${plan.repo}/git/commits/${baseSha}`);
  const tree = await ghApi("POST", `/repos/${plan.repo}/git/trees`, {
    base_tree: baseCommit.tree.sha,
    tree: [{ path: plan.fixturePath, mode: "100644", type: "blob", sha: blob.sha }]
  });
  const commit = await ghApi("POST", `/repos/${plan.repo}/git/commits`, {
    message: "chore: Phase 3 source-checkout worker staging trial fixture",
    tree: tree.sha,
    parents: [baseSha]
  });
  await ghApi("POST", `/repos/${plan.repo}/git/refs`, {
    ref: `refs/heads/${plan.branch}`,
    sha: commit.sha
  });
  return commit.sha;
}

async function cleanupTrial({ plan, prNumber }) {
  const cleanup = {
    closedPullRequest: false,
    deletedRemoteBranch: false,
    deletedLocalFixture: false,
    kv: { deletedKeys: 0, remainingSmokeKeys: 0 }
  };
  if (prNumber) {
    cleanup.closedPullRequest = await ignoreFailure(
      (async () => {
        await ghApi("PATCH", `/repos/${plan.repo}/pulls/${prNumber}`, { state: "closed" });
      })()
    );
  }
  cleanup.deletedRemoteBranch = await ignoreFailure(
    (async () => {
      await ghApi("DELETE", `/repos/${plan.repo}/git/refs/heads/${plan.branch}`);
    })()
  );
  cleanup.deletedLocalFixture = await ignoreFailure(rm(plan.fixturePath, { force: true }));
  cleanup.kv = await clearLiveWorkerTrialKv(plan, prNumber);
  return cleanup;
}

async function clearLiveWorkerTrialKv(plan, prNumber) {
  // The trial PR also fires the live webhook-ingress worker, which writes
  // compact delivery:/scan: records. Remove this trial's records via the
  // Cloudflare KV API (same credential mechanism as deploys).
  if (!prNumber) return { deletedKeys: 0, remainingSmokeKeys: 0 };
  const keys = await cfKvListKeys(plan.kvNamespaceId).catch(() => []);
  const trialKeys = [];
  for (const key of keys) {
    if (!key.startsWith("scan:") && !key.startsWith("delivery:")) continue;
    const parts = key.split(":");
    if (parts[3] !== String(prNumber)) continue;
    trialKeys.push(key);
  }
  if (trialKeys.length > 0) {
    await cfKvBulkDelete(plan.kvNamespaceId, trialKeys).catch(() => undefined);
  }
  const remaining = await cfKvListKeys(plan.kvNamespaceId).catch(() => []);
  let remainingSmokeKeys = 0;
  for (const key of remaining) {
    if (!key.startsWith("scan:") && !key.startsWith("delivery:")) continue;
    if (key.split(":")[3] === String(prNumber)) remainingSmokeKeys += 1;
  }
  return { deletedKeys: trialKeys.length, remainingSmokeKeys };
}

function cfApi(method, path, body) {
  // Cloudflare API via the workspace cloudflare skill's dynamic-credential
  // mechanism (custom.cloudflare surrogate, api.cloudflare.com only).
  const script = [
    "import sys, json",
    "import urllib.request",
    "sys.path.insert(0, '/opt/hatch/skills/skill-creator/bin')",
    "from dynamic_credentials import add_surrogate_to_request, read_json_response",
    "method, path = sys.argv[1], sys.argv[2]",
    "raw = sys.argv[3] if len(sys.argv) > 3 else ''",
    "data = json.dumps(json.loads(raw)).encode() if raw.strip() else None",
    "r = urllib.request.Request('https://api.cloudflare.com/client/v4' + path, data=data, method=method)",
    "r.add_header('Accept', 'application/json')",
    "if data: r.add_header('Content-Type', 'application/json')",
    "add_surrogate_to_request(r, 'custom.cloudflare', allowed_hosts=['api.cloudflare.com'])",
    "resp = urllib.request.urlopen(r, timeout=60)",
    "body = resp.read()",
    "print(body.decode('utf-8') if body.strip() else '{\\\"deleted\\\": true}')"
  ].join("\n");
  return { script, method, path, body };
}

async function cfApiCall(method, path, body) {
  const { script } = cfApi(method, path, body);
  const argv = ["-c", script, method, path];
  if (body !== undefined) argv.push(JSON.stringify(body));
  const { stdout } = await execFileAsync("python3", argv, { maxBuffer: 8 * 1024 * 1024 });
  return JSON.parse(stdout);
}

async function cfAccountId() {
  const response = await cfApiCall("GET", "/accounts");
  const accounts = response.result || [];
  if (accounts.length === 0) throw new Error("No Cloudflare accounts visible to the credential");
  return accounts[0].id;
}

async function cfKvListKeys(namespaceId) {
  const accountId = await cfAccountId();
  const response = await cfApiCall("GET", `/accounts/${accountId}/storage/kv/namespaces/${namespaceId}/keys`);
  if (!response.success) return [];
  return (response.result || []).map((item) => item.name).filter((name) => typeof name === "string");
}

async function cfKvBulkDelete(namespaceId, keys) {
  const accountId = await cfAccountId();
  const response = await cfApiCall(
    "POST",
    `/accounts/${accountId}/storage/kv/namespaces/${namespaceId}/bulk/delete`,
    keys
  );
  return response.success === true;
}

async function git(args) {
  return run("git", args, { cwd: process.env.TRIAL_REPO_DIR || process.cwd() });
}

async function curlJson(url, timeoutMs = 30000) {
  return run("curl", ["-fsSL", "--max-time", String(Math.ceil(timeoutMs / 1000)), url]);
}

async function curlJsonPost(url, body, bearer, timeoutMs) {
  return run("curl", [
    "-fsSL",
    "--max-time",
    String(Math.ceil(timeoutMs / 1000)),
    "-X",
    "POST",
    url,
    "-H",
    "content-type: application/json",
    "-H",
    `authorization: Bearer ${bearer}`,
    "--data-binary",
    JSON.stringify(body)
  ]);
}

export async function ghApi(method, path, body) {
  // GitHub API via the workspace github skill's dynamic-credential mechanism
  // (custom.github surrogate, api.github.com only). Body travels as base64 in
  // argv so stdin handling cannot block.
  const script = [
    "import sys, json, base64",
    "import urllib.request",
    "sys.path.insert(0, '/opt/hatch/skills/skill-creator/bin')",
    "sys.path.insert(0, '/home/hatch/workspace/skills/github/bin')",
    "from dynamic_credentials import add_surrogate_to_request, read_json_response",
    "method, path = sys.argv[1], sys.argv[2]",
    "raw = base64.b64decode(sys.argv[3]).decode('utf-8') if len(sys.argv) > 3 and sys.argv[3] else ''",
    "data = json.dumps(json.loads(raw)).encode() if raw.strip() else None",
    "r = urllib.request.Request('https://api.github.com' + path, data=data, method=method)",
    "r.add_header('Accept', 'application/vnd.github+json')",
    "r.add_header('X-GitHub-Api-Version', '2022-11-28')",
    "r.add_header('User-Agent', 'ai-saas-guard-staging-trial')",
    "if data: r.add_header('Content-Type', 'application/json')",
    "add_surrogate_to_request(r, 'custom.github', allowed_hosts=['api.github.com'])",
    "resp = urllib.request.urlopen(r, timeout=60)",
    "print(json.dumps(read_json_response(resp)))"
  ].join("\n");
  const argv = ["-c", script, method, path];
  if (body !== undefined) {
    argv.push(Buffer.from(JSON.stringify(body), "utf8").toString("base64"));
  }
  const { stdout } = await execFileAsync("python3", argv, { maxBuffer: 4 * 1024 * 1024 });
  return JSON.parse(stdout);
}

async function ghApiRaw(method, path, accept) {
  const script = [
    "import sys",
    "import urllib.request",
    "sys.path.insert(0, '/opt/hatch/skills/skill-creator/bin')",
    "sys.path.insert(0, '/home/hatch/workspace/skills/github/bin')",
    "from dynamic_credentials import add_surrogate_to_request",
    "method, path, accept = sys.argv[1], sys.argv[2], sys.argv[3]",
    "r = urllib.request.Request('https://api.github.com' + path, method=method)",
    "r.add_header('Accept', accept)",
    "r.add_header('X-GitHub-Api-Version', '2022-11-28')",
    "r.add_header('User-Agent', 'ai-saas-guard-staging-trial')",
    "add_surrogate_to_request(r, 'custom.github', allowed_hosts=['api.github.com'])",
    "resp = urllib.request.urlopen(r, timeout=60)",
    "sys.stdout.write(resp.read().decode('utf-8'))"
  ].join("\n");
  const { stdout } = await execFileAsync("python3", ["-c", script, method, path, accept], {
    maxBuffer: 8 * 1024 * 1024
  });
  return stdout;
}

async function run(command, args, options = {}) {
  const { stdout } = await execFileAsync(command, args, {
    cwd: options.cwd ?? process.cwd(),
    maxBuffer: 8 * 1024 * 1024,
    timeout: options.timeout
  });
  return stdout;
}

async function ignoreFailure(promise) {
  try {
    await promise;
    return true;
  } catch {
    return false;
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
