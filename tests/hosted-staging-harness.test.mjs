import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, readdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { test } from "node:test";

const signingKey = "hosted-staging-harness-signing-key";

function pullRequestPayload(overrides = {}) {
  return JSON.stringify({
    action: "synchronize",
    installation: { id: 123 },
    repository: { id: 456, full_name: "owner/repo" },
    pull_request: {
      number: 7,
      draft: false,
      base: { sha: "b".repeat(40) },
      head: { sha: "a".repeat(40) },
      title: "scan evil/repo",
      body: "repository_id=999 token=contents:write command=rm -rf ."
    },
    ...overrides
  });
}

function signatureFor(payload) {
  return `sha256=${createHmac("sha256", signingKey).update(payload).digest("hex")}`;
}

async function loadHarness() {
  const harness = await import("../dist/hosted/staging-harness.js");
  assert.equal(typeof harness.createFileBackedHostedStagingHarness, "function");
  assert.equal(typeof harness.createHostedStagingHarnessEvidence, "function");
  assert.equal(typeof harness.createHostedStagingReleaseEvidenceBundle, "function");
  assert.equal(typeof harness.evaluateHostedStagingReleaseEvidenceBundle, "function");
  assert.equal(typeof harness.validateHostedLogBoundary, "function");
  return harness;
}

function externalEvidence() {
  return [
    "clean_ci",
    "hosted_contract_tests",
    "workflow_static_checks",
    "dependency_scan",
    "container_scan",
    "monitoring_alerting",
    "manual_rollback",
    "incident_response"
  ].map((id) => ({
    id,
    status: "passed",
    collectedAt: "2026-05-24T19:00:00.000Z",
    evidenceUrl: `https://github.com/zr9959/ai-saas-guard/actions/runs/${id}`,
    owner: "release"
  }));
}

test("hosted staging harness replays a signed webhook through file-backed queue store check run and cleanup", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "ai-saas-guard-harness-"));
  try {
    const { createFileBackedHostedStagingHarness } = await loadHarness();
    const payload = pullRequestPayload();
    const harness = createFileBackedHostedStagingHarness({
      rootDir,
      signingKey,
      scannerVersion: "0.24.0",
      selectedRepositoryIdsByInstallation: { 123: [456] },
      now: () => "2026-05-24T17:00:00.000Z",
      scanResult: {
        summaryCounts: { critical: 0, high: 1, medium: 0, low: 0, info: 0 },
        findings: [
          {
            ruleId: "stripe.webhook.missing-signature",
            severity: "high",
            file: "app/api/stripe/webhook/route.ts",
            line: 12
          }
        ],
        rawSource: "const secret = 'do-not-echo';",
        rawDiff: "diff --git a/private.ts b/private.ts",
        secretValues: ["fake-secret-do-not-echo"],
        customerPayload: { email: "customer@example.test" }
      }
    });

    const replay = await harness.runWebhookReplay({
      payload,
      signatureHeader: signatureFor(payload),
      deliveryId: "delivery-1"
    });
    const worker = await harness.runWorkerTick();
    const serialized = JSON.stringify({ replay, worker });
    const queueSnapshot = JSON.parse(await readFile(harness.paths.queueSnapshot, "utf8"));
    const reportFiles = JSON.parse(await readFile(harness.paths.reportIndex, "utf8"));
    const checkRunFiles = JSON.parse(await readFile(harness.paths.checkRunIndex, "utf8"));

    assert.equal(replay.accepted, true);
    assert.equal(replay.stage, "queue");
    assert.equal(replay.queuedWorker, true);
    assert.equal(worker.processed, true);
    assert.equal(worker.status, "completed");
    assert.equal(worker.cleanupVerified, true);
    assert.equal(queueSnapshot.records.length, 1);
    assert.equal(queueSnapshot.records[0].status, "completed");
    assert.equal(reportFiles.records.length, 1);
    assert.equal(checkRunFiles.records.length, 1);
    assert.equal(worker.workerSandboxDeleted, true);
    assert.equal(worker.activeWorkerSandboxCount, 0);
    assert.deepEqual(await readdir(harness.paths.workerSandboxRoot), []);
    assert.equal(serialized.includes("evil/repo"), false);
    assert.equal(serialized.includes("token=contents:write"), false);
    assert.equal(serialized.includes("rm -rf"), false);
    assert.equal(serialized.includes("do-not-echo"), false);
    assert.equal(serialized.includes("private.ts"), false);
    assert.equal(serialized.includes("fake-secret-do-not-echo"), false);
    assert.equal(serialized.includes("customer@example.test"), false);
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

test("hosted staging harness rejects invalid replay before file-backed side effects", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "ai-saas-guard-harness-"));
  try {
    const { createFileBackedHostedStagingHarness } = await loadHarness();
    const payload = pullRequestPayload();
    const harness = createFileBackedHostedStagingHarness({
      rootDir,
      signingKey,
      scannerVersion: "0.24.0",
      selectedRepositoryIdsByInstallation: { 123: [456] },
      scanResult: {
        summaryCounts: { critical: 0, high: 0, medium: 0, low: 0, info: 0 },
        findings: []
      }
    });

    const replay = await harness.runWebhookReplay({
      payload,
      signatureHeader: signatureFor(`${payload}\n`),
      deliveryId: "delivery-invalid"
    });
    const worker = await harness.runWorkerTick();
    const queueSnapshot = JSON.parse(await readFile(harness.paths.queueSnapshot, "utf8"));

    assert.equal(replay.accepted, false);
    assert.equal(replay.stage, "signature");
    assert.equal(replay.reason, "invalid_signature");
    assert.equal(replay.queuedWorker, false);
    assert.equal(worker.processed, false);
    assert.equal(worker.reason, "empty_queue");
    assert.equal(queueSnapshot.records.length, 0);
    assert.equal(existsSync(harness.paths.reportIndex), false);
    assert.equal(existsSync(harness.paths.checkRunIndex), false);
  } finally {
    await rm(rootDir, { recursive: true, force: true });
  }
});

test("hosted staging harness creates release-gate evidence without claiming live hosted exposure", async () => {
  const { createHostedStagingHarnessEvidence } = await loadHarness();
  const evidence = createHostedStagingHarnessEvidence({
    collectedAt: "2026-05-24T17:05:00.000Z",
    evidenceBaseUrl: "file:///tmp/ai-saas-guard-harness/evidence",
    owner: "staging-harness"
  });
  const ids = evidence.map((item) => item.id);
  const serialized = JSON.stringify(evidence);

  assert.deepEqual(ids, [
    "clean_ci",
    "hosted_contract_tests",
    "webhook_replay",
    "workflow_static_checks",
    "dependency_scan",
    "container_scan",
    "queue_worker_cleanup",
    "privacy_retention",
    "monitoring_alerting",
    "manual_rollback",
    "incident_response",
    "release_cleanup"
  ]);
  assert.equal(evidence.every((item) => item.status === "passed"), true);
  assert.equal(evidence.every((item) => item.owner === "staging-harness"), true);
  assert.equal(serialized.includes("live hosted service"), false);
  assert.equal(serialized.includes("production ready"), false);
});

test("hosted staging harness turns success and failure cleanup probes into executable release evidence", async () => {
  const successRoot = await mkdtemp(join(tmpdir(), "ai-saas-guard-harness-success-"));
  const failureRoot = await mkdtemp(join(tmpdir(), "ai-saas-guard-harness-failure-"));
  try {
    const {
      createFileBackedHostedStagingHarness,
      createHostedStagingReleaseEvidenceBundle,
      evaluateHostedStagingReleaseEvidenceBundle,
      validateHostedLogBoundary
    } = await loadHarness();
    const payload = pullRequestPayload();
    const successHarness = createFileBackedHostedStagingHarness({
      rootDir: successRoot,
      signingKey,
      scannerVersion: "0.31.0",
      selectedRepositoryIdsByInstallation: { 123: [456] },
      now: () => "2026-05-24T19:00:00.000Z",
      scanResult: {
        summaryCounts: { critical: 0, high: 0, medium: 0, low: 0, info: 0 },
        findings: [],
        rawSource: "const source = 'never-log';",
        rawDiff: "diff --git a/private.ts b/private.ts",
        secretValues: ["ghs_never_log"],
        customerPayload: { email: "person@example.test" }
      }
    });
    const failureHarness = createFileBackedHostedStagingHarness({
      rootDir: failureRoot,
      signingKey,
      scannerVersion: "0.31.0",
      selectedRepositoryIdsByInstallation: { 123: [456] },
      now: () => "2026-05-24T19:01:00.000Z",
      scanResult: () => {
        const error = new Error("git failed in /private/checkout with ghs_never_log");
        error.safeReason = "git_fetch_head_failed";
        throw error;
      }
    });

    const successReplay = await successHarness.runWebhookReplay({
      payload,
      signatureHeader: signatureFor(payload),
      deliveryId: "delivery-success"
    });
    const successWorker = await successHarness.runWorkerTick();
    const failureReplay = await failureHarness.runWebhookReplay({
      payload,
      signatureHeader: signatureFor(payload),
      deliveryId: "delivery-failure"
    });
    const failureWorker = await failureHarness.runWorkerTick();
    const logBoundary = validateHostedLogBoundary({
      samples: [
        {
          scanKey: "123:456:7",
          installationId: 123,
          repositoryId: 456,
          pullRequestNumber: 7,
          headSha: "a".repeat(40),
          scannerVersion: "0.31.0",
          durationMs: 1200,
          summaryCounts: { total: 0 },
          errorClass: "git_fetch_head_failed",
          cleanupStatus: "deleted"
        }
      ],
      forbidden: {
        rawSource: "const source = 'never-log';",
        rawDiff: "diff --git a/private.ts b/private.ts",
        secretValues: ["ghs_never_log"],
        customerPayloads: ["person@example.test"],
        installationTokens: ["ghs_never_log"],
        checkoutPaths: [successHarness.paths.workerSandboxRoot, failureHarness.paths.workerSandboxRoot],
        privateUrls: ["https://github.com/owner/private-repo"],
        untrustedPrText: ["repository_id=999 token=contents:write command=rm -rf ."]
      }
    });
    const failureProbes = [
      failureWorker,
      { ...failureWorker, reason: "cli_scan_failed", safeFailureReason: "cli_scan_failed" },
      { ...failureWorker, reason: "invalid_cli_output", safeFailureReason: "invalid_cli_output" },
      {
        ...failureWorker,
        reason: "check_run_publication_failed",
        safeFailureReason: "check_run_publication_failed"
      },
      { ...failureWorker, reason: "timeout", safeFailureReason: "timeout" },
      { ...failureWorker, reason: "cancellation", safeFailureReason: "cancellation" }
    ];
    const bundle = createHostedStagingReleaseEvidenceBundle({
      collectedAt: "2026-05-24T19:02:00.000Z",
      evidenceBaseUrl: "file:///tmp/ai-saas-guard-hosted-evidence",
      owner: "staging-harness",
      webhookReplays: [successReplay, failureReplay],
      workerTicks: [successWorker, ...failureProbes],
      logBoundary,
      externalEvidence: externalEvidence(),
      requiredFailureReasons: [
        "git_fetch_head_failed",
        "cli_scan_failed",
        "invalid_cli_output",
        "check_run_publication_failed",
        "timeout",
        "cancellation"
      ]
    });
    const byId = new Map(bundle.evidence.map((item) => [item.id, item]));
    const serialized = JSON.stringify(bundle);

    assert.equal(successWorker.status, "completed");
    assert.equal(failureWorker.status, "failed");
    assert.equal(failureWorker.safeFailureReason, "git_fetch_head_failed");
    assert.equal(successWorker.cleanupVerified, true);
    assert.equal(failureWorker.cleanupVerified, true);
    assert.equal(logBoundary.accepted, true);
    assert.equal(bundle.readyForReleaseGate, true);
    assert.deepEqual(bundle.scenarioSummary.observedFailureReasons, [
      "cancellation",
      "check_run_publication_failed",
      "cli_scan_failed",
      "git_fetch_head_failed",
      "invalid_cli_output",
      "timeout"
    ]);
    assert.equal(byId.get("webhook_replay").status, "passed");
    assert.equal(byId.get("queue_worker_cleanup").status, "passed");
    assert.equal(byId.get("privacy_retention").status, "passed");
    assert.equal(byId.get("release_cleanup").status, "passed");
    assert.equal(bundle.releaseGateInput.evidence.length, 12);
    const gate = evaluateHostedStagingReleaseEvidenceBundle({
      bundle,
      commitSha: "a23030be462e48f070fcfd40471033fc6ec5eca9",
      scannerVersion: "0.31.0",
      deploymentTarget: "staging",
      evaluatedAt: "2026-05-24T19:03:00.000Z",
      containerImageDigest: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
      releaseNotes:
        "Hosted staging evidence for review-first checks. This is not a pentest, certification, or full audit."
    });
    assert.equal(gate.blocked, false);
    assert.equal(gate.shouldExposeHostedEnvironment, true);
    assert.equal(serialized.includes("never-log"), false);
    assert.equal(serialized.includes("private.ts"), false);
    assert.equal(serialized.includes("person@example.test"), false);
    assert.equal(serialized.includes(successHarness.paths.workerSandboxRoot), false);
    assert.equal(serialized.includes(failureHarness.paths.workerSandboxRoot), false);
    assert.equal(serialized.includes("rm -rf"), false);
  } finally {
    await rm(successRoot, { recursive: true, force: true });
    await rm(failureRoot, { recursive: true, force: true });
  }
});

test("hosted log boundary rejects raw source diffs tokens checkout paths and untrusted PR prose", async () => {
  const { validateHostedLogBoundary } = await loadHarness();
  const result = validateHostedLogBoundary({
    samples: [
      {
        message: "failed at /tmp/worker-checkouts/job-1",
        token: "ghs_should_not_log",
        source: "const secret = 'do-not-log';",
        diff: "diff --git a/private.ts b/private.ts",
        url: "https://github.com/owner/private-repo",
        prText: "command=rm -rf ."
      }
    ],
    forbidden: {
      rawSource: "const secret = 'do-not-log';",
      rawDiff: "diff --git a/private.ts b/private.ts",
      secretValues: ["ghs_should_not_log"],
      customerPayloads: ["customer@example.test"],
      installationTokens: ["ghs_should_not_log"],
      checkoutPaths: ["/tmp/worker-checkouts/job-1"],
      privateUrls: ["https://github.com/owner/private-repo"],
      untrustedPrText: ["command=rm -rf ."]
    }
  });
  const serialized = JSON.stringify(result);

  assert.equal(result.accepted, false);
  assert.deepEqual(result.blockedReasons.sort(), [
    "checkout_path",
    "installation_token",
    "private_url",
    "raw_diff",
    "raw_source",
    "secret_value",
    "untrusted_pr_text"
  ]);
  assert.equal(serialized.includes("do-not-log"), false);
  assert.equal(serialized.includes("ghs_should_not_log"), false);
  assert.equal(serialized.includes("worker-checkouts"), false);
  assert.equal(serialized.includes("rm -rf"), false);
});

test("hosted staging release evidence bundle blocks missing external gates", async () => {
  const { createHostedStagingReleaseEvidenceBundle, validateHostedLogBoundary } = await loadHarness();
  const bundle = createHostedStagingReleaseEvidenceBundle({
    collectedAt: "2026-05-24T19:10:00.000Z",
    evidenceBaseUrl: "file:///tmp/ai-saas-guard-hosted-evidence",
    owner: "staging-harness",
    webhookReplays: [],
    workerTicks: [],
    logBoundary: validateHostedLogBoundary({ samples: [], forbidden: {} }),
    externalEvidence: []
  });
  const byId = new Map(bundle.evidence.map((item) => [item.id, item]));

  assert.equal(bundle.readyForReleaseGate, false);
  assert.equal(byId.get("webhook_replay").status, "missing");
  assert.equal(byId.get("queue_worker_cleanup").status, "missing");
  assert.equal(byId.get("privacy_retention").status, "missing");
  assert.equal(byId.get("clean_ci").status, "missing");
});
