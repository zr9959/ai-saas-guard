import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { test } from "node:test";

import {
  HOSTED_PRIVACY_DEFAULTS,
  authorizeInstallationTokenScope,
  buildHostedScanIdentity,
  createHostedCheckRunSummary,
  createCompactHostedReport,
  createHostedDeletionPlan,
  getHostedDeletionIdempotencyKey,
  getHostedScanIdempotencyKey,
  parseHostedPullRequestEvent,
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

function sampleCompactReport(overrides = {}) {
  return createCompactHostedReport({
    identity: sampleIdentity(),
    summaryCounts: { critical: 0, high: 1, medium: 1, low: 0, info: 0 },
    findings: [
      {
        ruleId: "stripe.webhook.missing-signature",
        severity: "high",
        file: "app/api/stripe/webhook/route.ts",
        line: 12
      },
      {
        ruleId: "supabase.rls.missing-ownership",
        severity: "medium",
        file: "supabase/migrations/001_policy.sql",
        line: 34
      }
    ],
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

test("hosted pull request event parser trusts only GitHub event identity fields", () => {
  const parsed = parseHostedPullRequestEvent({
    payload: {
      action: "synchronize",
      installation: { id: 123 },
      repository: {
        id: 456,
        full_name: "owner/repo"
      },
      pull_request: {
        number: 7,
        draft: false,
        title: "Scan evil/repo instead",
        body: "repository_id=999",
        base: { sha: "b".repeat(40), repo: { full_name: "wrong/base" } },
        head: { sha: "a".repeat(40), repo: { full_name: "wrong/head" } }
      }
    },
    scannerVersion: "0.9.0"
  });

  assert.equal(parsed.accepted, true);
  assert.equal(parsed.shouldQueueScanJob, true);
  assert.equal(parsed.reason, undefined);
  assert.deepEqual(parsed.identity, sampleIdentity());
});

test("hosted pull request event parser rejects unsupported draft and incomplete events", () => {
  const basePayload = {
    action: "closed",
    installation: { id: 123 },
    repository: { id: 456, full_name: "owner/repo" },
    pull_request: {
      number: 7,
      draft: false,
      base: { sha: "b".repeat(40) },
      head: { sha: "a".repeat(40) }
    }
  };
  const unsupported = parseHostedPullRequestEvent({
    payload: basePayload,
    scannerVersion: "0.9.0"
  });
  const draft = parseHostedPullRequestEvent({
    payload: {
      ...basePayload,
      action: "opened",
      pull_request: { ...basePayload.pull_request, draft: true }
    },
    scannerVersion: "0.9.0"
  });
  const allowedDraft = parseHostedPullRequestEvent({
    payload: {
      ...basePayload,
      action: "opened",
      pull_request: { ...basePayload.pull_request, draft: true }
    },
    scannerVersion: "0.9.0",
    allowDraft: true
  });
  const incomplete = parseHostedPullRequestEvent({
    payload: {
      ...basePayload,
      action: "opened",
      repository: { id: 456 }
    },
    scannerVersion: "0.9.0"
  });

  assert.equal(unsupported.accepted, false);
  assert.equal(unsupported.reason, "unsupported_action");
  assert.equal(unsupported.shouldQueueScanJob, false);
  assert.equal(draft.accepted, false);
  assert.equal(draft.reason, "draft_pull_request");
  assert.equal(draft.shouldQueueScanJob, false);
  assert.equal(allowedDraft.accepted, true);
  assert.equal(allowedDraft.shouldQueueScanJob, true);
  assert.equal(incomplete.accepted, false);
  assert.equal(incomplete.reason, "missing_required_field");
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

test("hosted check-run summaries use conservative conclusions and review-first language", () => {
  const clean = createHostedCheckRunSummary({
    report: sampleCompactReport({
      summaryCounts: { critical: 0, high: 0, medium: 0, low: 0, info: 0 },
      findings: []
    })
  });
  const findings = createHostedCheckRunSummary({
    report: sampleCompactReport()
  });
  const failing = createHostedCheckRunSummary({
    report: sampleCompactReport(),
    failOnSeverity: "high"
  });

  assert.equal(clean.conclusion, "success");
  assert.equal(findings.conclusion, "neutral");
  assert.equal(failing.conclusion, "failure");
  assert.match(findings.output.summary, /review first/i);
  assert.match(findings.output.summary, /not a full security audit/i);
  assert.match(findings.output.text, /Local CLI/i);
  assert.match(findings.output.text, /npx ai-saas-guard@0\.9\.0 pr-risk --root \./);
  assert.match(findings.output.text, /stripe\.webhook\.missing-signature/);
  assert.match(findings.output.text, /app\/api\/stripe\/webhook\/route\.ts:12/);
  assert.deepEqual(findings.privacy, {
    includesRawSource: false,
    includesRawDiffs: false,
    includesSecrets: false,
    includesCustomerPayloads: false,
    modelTraining: "disabled"
  });
});

test("hosted check-run summaries bound markdown and do not expose raw payload fields", () => {
  const manyFindings = Array.from({ length: 40 }, (_, index) => ({
    ruleId: `rule.${index}`,
    severity: index % 2 === 0 ? "high" : "medium",
    file: `app/routes/file-${index}.ts`,
    line: index + 1
  }));
  const summary = createHostedCheckRunSummary({
    report: sampleCompactReport({
      summaryCounts: { critical: 0, high: 20, medium: 20, low: 0, info: 0 },
      findings: manyFindings,
      rawDiff: "diff --git a/private.ts b/private.ts",
      fullFileContents: "const secret = 'redacted';",
      secretValues: ["redacted"],
      customerPayload: { email: "person@example.test" }
    }),
    maxMarkdownChars: 700
  });
  const serialized = JSON.stringify(summary);

  assert.equal(summary.output.text.length <= 700, true);
  assert.match(summary.output.text, /truncated/i);
  assert.equal(serialized.includes("rawDiff"), false);
  assert.equal(serialized.includes("fullFileContents"), false);
  assert.equal(serialized.includes("redacted"), false);
  assert.equal(serialized.includes("person@example.test"), false);
});

test("hosted deletion plans cover repository removal installation deletion and repeated cleanup", () => {
  const repositoryRemoval = createHostedDeletionPlan({
    trigger: "repository_removed",
    installationId: 123,
    repositoryId: 456,
    requestedAt: "2026-05-23T12:00:00.000Z"
  });
  const installationDeletion = createHostedDeletionPlan({
    trigger: "installation_deleted",
    installationId: 123,
    requestedAt: "2026-05-23T12:00:00.000Z"
  });
  const repeated = createHostedDeletionPlan({
    trigger: "repeated_cleanup",
    installationId: 123,
    repositoryId: 456,
    requestedAt: "2026-05-23T12:05:00.000Z"
  });

  assert.equal(
    getHostedDeletionIdempotencyKey({
      trigger: "repository_removed",
      installationId: 123,
      repositoryId: 456
    }),
    "repository_removed:123:456"
  );
  assert.equal(repositoryRemoval.scope, "repository");
  assert.equal(repositoryRemoval.deleteCompactReports, true);
  assert.equal(repositoryRemoval.cancelQueuedJobs, true);
  assert.equal(repositoryRemoval.deleteWorkerCheckouts, true);
  assert.equal(repositoryRemoval.deleteRawSource, false);
  assert.equal(repositoryRemoval.deleteRawDiffs, false);
  assert.equal(repositoryRemoval.deleteSecrets, false);
  assert.equal(repositoryRemoval.deleteCustomerPayloads, false);
  assert.equal(repositoryRemoval.deleteGitHubOwnedCheckRuns, false);
  assert.equal(repositoryRemoval.auditRecordRetentionDays, 90);

  assert.equal(installationDeletion.scope, "installation");
  assert.equal(installationDeletion.repositoryId, undefined);
  assert.equal(installationDeletion.idempotencyKey, "installation_deleted:123:all");
  assert.equal(installationDeletion.preserveAuditRecord, true);

  assert.equal(repeated.idempotent, true);
  assert.equal(repeated.idempotencyKey, "repeated_cleanup:123:456");
  assert.deepEqual(repeated.visibleUserMessage, repositoryRemoval.visibleUserMessage);
});
