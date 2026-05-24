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
  return harness;
}

test("hosted staging harness replays a signed webhook through file-backed queue store check run and cleanup", async () => {
  const rootDir = await mkdtemp(join(tmpdir(), "ai-saas-guard-harness-"));
  try {
    const { createFileBackedHostedStagingHarness } = await loadHarness();
    const payload = pullRequestPayload();
    const harness = createFileBackedHostedStagingHarness({
      rootDir,
      signingKey,
      scannerVersion: "0.23.0",
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
      scannerVersion: "0.23.0",
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
