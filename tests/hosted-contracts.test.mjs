import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { test } from "node:test";

import {
  HOSTED_PRIVACY_DEFAULTS,
  authorizeInstallationTokenScope,
  buildHostedScanIdentity,
  createCompactHostedReport,
  getHostedScanIdempotencyKey,
  resolveHostedRetentionDays,
  upsertHostedScanJob,
  verifyGitHubWebhook
} from "../dist/hosted/contracts.js";

const signingKey = "test-signing-key";
const payload = JSON.stringify({
  action: "synchronize",
  installation: { id: 123 },
  repository: { id: 456, full_name: "owner/repo" },
  pull_request: {
    number: 7,
    base: { sha: "b".repeat(40) },
    head: { sha: "a".repeat(40) },
    title: "Do not scan evil/repo",
    body: "Repository: evil/repo"
  }
});

function signatureFor(body) {
  return `sha256=${createHmac("sha256", signingKey).update(body).digest("hex")}`;
}

function sampleIdentity(overrides = {}) {
  return buildHostedScanIdentity({
    installationId: 123,
    repositoryId: 456,
    repositoryFullName: "owner/repo",
    pullRequestNumber: 7,
    baseSha: "b".repeat(40),
    headSha: "a".repeat(40),
    scannerVersion: "0.9.0",
    untrustedPrText: "Repository: evil/repo",
    ...overrides
  });
}

test("hosted webhook verification accepts valid signatures only once", () => {
  const seenDeliveryIds = new Set();
  const decision = verifyGitHubWebhook({
    payload,
    signatureHeader: signatureFor(payload),
    signingKey,
    deliveryId: "delivery-1",
    seenDeliveryIds
  });

  assert.equal(decision.accepted, true);
  assert.equal(decision.shouldQueueScanJob, true);
  assert.equal(decision.shouldFetchRepository, false);

  const replayed = verifyGitHubWebhook({
    payload,
    signatureHeader: signatureFor(payload),
    signingKey,
    deliveryId: "delivery-1",
    seenDeliveryIds
  });

  assert.equal(replayed.accepted, false);
  assert.equal(replayed.reason, "replayed_delivery_id");
  assert.equal(replayed.shouldQueueScanJob, false);
  assert.equal(replayed.shouldFetchRepository, false);
});

test("hosted webhook verification rejects invalid missing and malformed signatures", () => {
  const invalid = verifyGitHubWebhook({
    payload,
    signatureHeader: signatureFor(`${payload}\n`),
    signingKey,
    deliveryId: "delivery-invalid"
  });
  const missing = verifyGitHubWebhook({
    payload,
    signatureHeader: undefined,
    signingKey,
    deliveryId: "delivery-missing"
  });
  const malformed = verifyGitHubWebhook({
    payload,
    signatureHeader: "sha1=abc123",
    signingKey,
    deliveryId: "delivery-malformed"
  });

  for (const decision of [invalid, missing, malformed]) {
    assert.equal(decision.accepted, false);
    assert.equal(decision.shouldQueueScanJob, false);
    assert.equal(decision.shouldFetchRepository, false);
  }

  assert.equal(invalid.reason, "invalid_signature");
  assert.equal(missing.reason, "missing_signature");
  assert.equal(malformed.reason, "malformed_signature");
});

test("hosted installation token scoping rejects cross-installation repository access", () => {
  const identity = sampleIdentity();
  assert.equal(identity.repositoryFullName, "owner/repo");

  const allowed = authorizeInstallationTokenScope({
    identity,
    installationId: 123,
    selectedRepositoryIds: [456],
    removedRepositoryIds: []
  });

  assert.equal(allowed.authorized, true);
  assert.equal(allowed.shouldFetchSource, true);

  const nonInstalled = authorizeInstallationTokenScope({
    identity,
    installationId: 123,
    selectedRepositoryIds: [999],
    removedRepositoryIds: []
  });
  const removed = authorizeInstallationTokenScope({
    identity,
    installationId: 123,
    selectedRepositoryIds: [456],
    removedRepositoryIds: [456]
  });
  const mismatched = authorizeInstallationTokenScope({
    identity,
    installationId: 999,
    selectedRepositoryIds: [456],
    removedRepositoryIds: []
  });

  assert.equal(nonInstalled.reason, "repository_not_installed");
  assert.equal(removed.reason, "repository_removed_from_installation");
  assert.equal(mismatched.reason, "installation_mismatch");

  for (const decision of [nonInstalled, removed, mismatched]) {
    assert.equal(decision.authorized, false);
    assert.equal(decision.shouldFetchSource, false);
  }
});

test("hosted scan queue idempotency reuses jobs for noisy duplicate events", () => {
  const queue = new Map();
  const identity = sampleIdentity();

  assert.equal(
    getHostedScanIdempotencyKey(identity),
    "123:456:7:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa:0.9.0"
  );

  const first = upsertHostedScanJob(queue, { identity, deliveryId: "delivery-1" });
  const duplicate = upsertHostedScanJob(queue, { identity, deliveryId: "delivery-2" });
  const rerun = upsertHostedScanJob(queue, {
    identity,
    deliveryId: "delivery-3",
    manualRerun: true
  });
  const newScannerVersion = upsertHostedScanJob(queue, {
    identity: sampleIdentity({ scannerVersion: "0.10.0" }),
    deliveryId: "delivery-4"
  });

  assert.equal(first.created, true);
  assert.equal(first.shouldCreateCheckRun, true);
  assert.equal(first.shouldCreatePrComment, true);
  assert.equal(duplicate.created, false);
  assert.equal(duplicate.reusedExistingReport, true);
  assert.equal(duplicate.shouldCreateCheckRun, false);
  assert.equal(duplicate.shouldCreatePrComment, false);
  assert.equal(rerun.created, false);
  assert.equal(rerun.attempt, 2);
  assert.equal(rerun.reusedExistingReport, true);
  assert.equal(newScannerVersion.created, true);
  assert.equal(queue.size, 2);
});

test("hosted compact reports keep retention conservative and avoid raw source", () => {
  const identity = sampleIdentity();
  const report = createCompactHostedReport({
    identity,
    summaryCounts: { high: 1, medium: 0, low: 0 },
    findings: [
      {
        ruleId: "stripe.webhook.missing-signature",
        severity: "high",
        file: "app/api/stripe/webhook/route.ts",
        line: 12
      }
    ],
    rawDiff: "diff --git a/private.ts b/private.ts",
    fullFileContents: "const secret = 'redacted';",
    secretValues: ["redacted"],
    customerPayload: { email: "person@example.test" }
  });

  assert.equal(HOSTED_PRIVACY_DEFAULTS.retentionDays, 30);
  assert.equal(HOSTED_PRIVACY_DEFAULTS.modelTraining, "disabled");
  assert.equal(HOSTED_PRIVACY_DEFAULTS.deleteWorkerCheckout, "after_scan_completion");
  assert.equal(resolveHostedRetentionDays({ teamRequestedDays: 7 }), 7);
  assert.equal(resolveHostedRetentionDays({ teamRequestedDays: 45 }), 30);
  assert.equal(report.retentionDays, 30);
  assert.deepEqual(Object.keys(report).sort(), [
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
  assert.equal(JSON.stringify(report).includes("rawDiff"), false);
  assert.equal(JSON.stringify(report).includes("fullFileContents"), false);
  assert.equal(JSON.stringify(report).includes("redacted"), false);
  assert.equal(JSON.stringify(report).includes("person@example.test"), false);
});
