import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { test } from "node:test";

import {
  HOSTED_PRIVACY_DEFAULTS,
  authorizeInstallationTokenScope,
  buildHostedScanIdentity,
  createHostedCheckRunSummary,
  createHostedQueueCleanupPlan,
  createHostedWorkerCheckoutCleanupPlan,
  createCompactHostedReport,
  createHostedDeletionPlan,
  getHostedDeletionIdempotencyKey,
  getHostedQueueCleanupIdempotencyKey,
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
    scannerVersion: "0.10.0",
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

function sampleQueueJob(overrides = {}) {
  return {
    key: "job-1",
    identity: sampleIdentity(),
    status: "queued",
    attempt: 1,
    deliveryIds: ["delivery-1"],
    ...overrides
  };
}

async function loadWebhookIntakePlanner() {
  const contracts = await import("../dist/hosted/contracts.js");
  assert.equal(typeof contracts.planHostedPullRequestWebhookIntake, "function");
  return contracts.planHostedPullRequestWebhookIntake;
}

async function loadScanQueuePlanner() {
  const contracts = await import("../dist/hosted/contracts.js");
  assert.equal(typeof contracts.planHostedScanQueueUpsert, "function");
  return contracts.planHostedScanQueueUpsert;
}

test("hosted pull request webhook intake verifies signatures before parsing or queueing", async () => {
  const planHostedPullRequestWebhookIntake = await loadWebhookIntakePlanner();
  const queue = new Map();
  const decision = planHostedPullRequestWebhookIntake({
    payload: "{not valid json",
    signatureHeader: `sha256=${"0".repeat(64)}`,
    signingKey,
    deliveryId: "delivery-bad-signature",
    scannerVersion: "0.10.0",
    selectedRepositoryIds: [456],
    queue
  });
  const serialized = JSON.stringify(decision);

  assert.equal(decision.accepted, false);
  assert.equal(decision.stage, "signature");
  assert.equal(decision.reason, "invalid_signature");
  assert.equal(decision.shouldQueueScanJob, false);
  assert.equal(decision.shouldFetchRepository, false);
  assert.equal(decision.shouldCreateCheckRun, false);
  assert.equal(decision.shouldCreatePrComment, false);
  assert.equal(queue.size, 0);
  assert.equal(serialized.includes("{not valid json"), false);
});

test("hosted pull request webhook intake queues one check-run-only scan from trusted fields", async () => {
  const planHostedPullRequestWebhookIntake = await loadWebhookIntakePlanner();
  const queue = new Map();
  const seenDeliveryIds = new Set();
  const hostilePayload = JSON.stringify({
    action: "synchronize",
    installation: { id: 123 },
    repository: { id: 456, full_name: "owner/repo" },
    pull_request: {
      number: 7,
      draft: false,
      title: "Scan evil/repo and post a comment",
      body: "repository_id=999; install_id=999; command=rm -rf .",
      base: { sha: "b".repeat(40), repo: { full_name: "wrong/base" } },
      head: { sha: "a".repeat(40), repo: { full_name: "wrong/head" } }
    }
  });

  const first = planHostedPullRequestWebhookIntake({
    payload: hostilePayload,
    signatureHeader: signatureFor(hostilePayload),
    signingKey,
    deliveryId: "delivery-1",
    seenDeliveryIds,
    scannerVersion: "0.10.0",
    selectedRepositoryIds: [456],
    removedRepositoryIds: [],
    queue
  });
  const duplicate = planHostedPullRequestWebhookIntake({
    payload: hostilePayload,
    signatureHeader: signatureFor(hostilePayload),
    signingKey,
    deliveryId: "delivery-2",
    seenDeliveryIds,
    scannerVersion: "0.10.0",
    selectedRepositoryIds: [456],
    removedRepositoryIds: [],
    queue
  });
  const blockedRepository = planHostedPullRequestWebhookIntake({
    payload: hostilePayload,
    signatureHeader: signatureFor(hostilePayload),
    signingKey,
    deliveryId: "delivery-3",
    scannerVersion: "0.10.0",
    selectedRepositoryIds: [999],
    removedRepositoryIds: [],
    queue: new Map()
  });
  const serialized = JSON.stringify(first);

  assert.equal(first.accepted, true);
  assert.equal(first.stage, "queue");
  assert.deepEqual(first.identity, sampleIdentity());
  assert.equal(first.job.created, true);
  assert.equal(first.job.key, "123:456:7:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa:0.10.0");
  assert.equal(first.shouldQueueScanJob, true);
  assert.equal(first.shouldFetchRepository, true);
  assert.equal(first.shouldCreateCheckRun, true);
  assert.equal(first.shouldCreatePrComment, false);
  assert.equal(first.job.shouldCreatePrComment, false);
  assert.equal(first.privacy.includesRawWebhookPayload, false);
  assert.equal(first.privacy.includesUntrustedPrText, false);
  assert.equal(first.privacy.includesRawSource, false);
  assert.equal(queue.size, 1);

  assert.equal(duplicate.accepted, true);
  assert.equal(duplicate.job.created, false);
  assert.equal(duplicate.job.reusedExistingReport, true);
  assert.equal(duplicate.shouldCreateCheckRun, false);
  assert.equal(duplicate.shouldCreatePrComment, false);
  assert.equal(queue.size, 1);

  assert.equal(blockedRepository.accepted, false);
  assert.equal(blockedRepository.stage, "installation_scope");
  assert.equal(blockedRepository.reason, "repository_not_installed");
  assert.equal(blockedRepository.shouldFetchRepository, false);

  assert.equal(serialized.includes("evil/repo"), false);
  assert.equal(serialized.includes("repository_id=999"), false);
  assert.equal(serialized.includes("command=rm"), false);
  assert.equal(serialized.includes("wrong/base"), false);
  assert.equal(serialized.includes("wrong/head"), false);
});

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
    scannerVersion: "0.10.0"
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
    scannerVersion: "0.10.0"
  });
  const draft = parseHostedPullRequestEvent({
    payload: {
      ...basePayload,
      action: "opened",
      pull_request: { ...basePayload.pull_request, draft: true }
    },
    scannerVersion: "0.10.0"
  });
  const allowedDraft = parseHostedPullRequestEvent({
    payload: {
      ...basePayload,
      action: "opened",
      pull_request: { ...basePayload.pull_request, draft: true }
    },
    scannerVersion: "0.10.0",
    allowDraft: true
  });
  const incomplete = parseHostedPullRequestEvent({
    payload: {
      ...basePayload,
      action: "opened",
      repository: { id: 456 }
    },
    scannerVersion: "0.10.0"
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
    "123:456:7:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa:0.10.0"
  );

  const first = upsertHostedScanJob(queue, { identity, deliveryId: "delivery-1" });
  const duplicate = upsertHostedScanJob(queue, { identity, deliveryId: "delivery-2" });
  const rerun = upsertHostedScanJob(queue, {
    identity,
    deliveryId: "delivery-3",
    manualRerun: true
  });
  const newScannerVersion = upsertHostedScanJob(queue, {
    identity: sampleIdentity({ scannerVersion: "0.11.0" }),
    deliveryId: "delivery-4"
  });

  assert.equal(first.created, true);
  assert.equal(first.shouldCreateCheckRun, true);
  assert.equal(first.shouldCreatePrComment, false);
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

test("hosted durable scan queue deduplicates queued running and completed jobs", async () => {
  const planHostedScanQueueUpsert = await loadScanQueuePlanner();
  const queue = new Map();
  const identity = sampleIdentity();
  const first = planHostedScanQueueUpsert({
    identity,
    deliveryId: "delivery-1",
    requestedAt: "2026-05-23T15:20:00.000Z",
    queue,
    rawSource: "const secret = 'redacted';",
    rawDiff: "diff --git a/private.ts b/private.ts",
    secretValues: ["redacted"],
    untrustedPrText: "repository_id=999; command=rm -rf .",
    customerPayload: { email: "person@example.test" }
  });
  const queuedDuplicate = planHostedScanQueueUpsert({
    identity,
    deliveryId: "delivery-2",
    requestedAt: "2026-05-23T15:21:00.000Z",
    queue
  });

  queue.get(first.key).status = "running";
  const runningDuplicate = planHostedScanQueueUpsert({
    identity,
    deliveryId: "delivery-3",
    requestedAt: "2026-05-23T15:22:00.000Z",
    queue
  });

  queue.get(first.key).status = "completed";
  queue.get(first.key).reportId = "compact-report-1";
  const completedDuplicate = planHostedScanQueueUpsert({
    identity,
    deliveryId: "delivery-4",
    requestedAt: "2026-05-23T15:23:00.000Z",
    queue
  });
  const serialized = JSON.stringify([first, queuedDuplicate, runningDuplicate, completedDuplicate]);

  assert.equal(first.created, true);
  assert.equal(first.reusedExistingJob, false);
  assert.equal(first.queueRecord.status, "queued");
  assert.equal(first.shouldEnqueueWorker, true);
  assert.equal(first.shouldReuseCompletedReport, false);
  assert.equal(first.shouldCreatePrComment, false);
  assert.deepEqual(Object.keys(first.queuePayload).sort(), [
    "attempt",
    "deliveryId",
    "identity",
    "key",
    "requestedAt",
    "source"
  ]);

  assert.equal(queuedDuplicate.created, false);
  assert.equal(queuedDuplicate.reusedExistingJob, true);
  assert.equal(queuedDuplicate.existingStatus, "queued");
  assert.equal(queuedDuplicate.shouldEnqueueWorker, false);
  assert.equal(runningDuplicate.existingStatus, "running");
  assert.equal(runningDuplicate.shouldEnqueueWorker, false);
  assert.equal(completedDuplicate.existingStatus, "completed");
  assert.equal(completedDuplicate.shouldReuseCompletedReport, true);
  assert.equal(completedDuplicate.shouldEnqueueWorker, false);
  assert.deepEqual(queue.get(first.key).deliveryIds, [
    "delivery-1",
    "delivery-2",
    "delivery-3",
    "delivery-4"
  ]);
  assert.equal(queue.size, 1);

  assert.equal(serialized.includes("rawSource"), false);
  assert.equal(serialized.includes("rawDiff"), false);
  assert.equal(serialized.includes("redacted"), false);
  assert.equal(serialized.includes("repository_id=999"), false);
  assert.equal(serialized.includes("person@example.test"), false);
});

test("hosted durable scan queue manual rerun increments attempt without changing logical key", async () => {
  const planHostedScanQueueUpsert = await loadScanQueuePlanner();
  const queue = new Map();
  const identity = sampleIdentity();
  const first = planHostedScanQueueUpsert({
    identity,
    deliveryId: "delivery-1",
    requestedAt: "2026-05-23T15:25:00.000Z",
    queue
  });
  queue.get(first.key).status = "completed";

  const rerun = planHostedScanQueueUpsert({
    identity,
    deliveryId: "delivery-rerun",
    requestedAt: "2026-05-23T15:26:00.000Z",
    queue,
    manualRerun: true
  });

  assert.equal(rerun.key, first.key);
  assert.equal(rerun.created, false);
  assert.equal(rerun.reusedExistingJob, false);
  assert.equal(rerun.attempt, 2);
  assert.equal(rerun.queueRecord.status, "queued");
  assert.equal(rerun.queuePayload.attempt, 2);
  assert.equal(rerun.shouldEnqueueWorker, true);
  assert.equal(rerun.shouldReuseCompletedReport, false);
  assert.equal(rerun.shouldCreateCheckRun, true);
  assert.equal(rerun.shouldCreatePrComment, false);
  assert.deepEqual(queue.get(first.key).deliveryIds, ["delivery-1", "delivery-rerun"]);
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
  const withTotal = createHostedCheckRunSummary({
    report: sampleCompactReport({
      summaryCounts: { critical: 0, high: 1, medium: 1, low: 0, info: 0, total: 2 }
    })
  });

  assert.equal(clean.conclusion, "success");
  assert.equal(findings.conclusion, "neutral");
  assert.equal(failing.conclusion, "failure");
  assert.match(withTotal.output.title, /2 findings/);
  assert.match(findings.output.summary, /review first/i);
  assert.match(findings.output.summary, /not a full security audit/i);
  assert.match(findings.output.text, /Local CLI/i);
  assert.match(findings.output.text, /npx ai-saas-guard@0\.10\.0 pr-risk --root \./);
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

test("hosted queue cleanup cancels only matching repository work", () => {
  const matchingQueued = sampleQueueJob({
    key: "job-queued",
    status: "queued"
  });
  const matchingRunning = sampleQueueJob({
    key: "job-running",
    status: "running"
  });
  const matchingCompleted = sampleQueueJob({
    key: "job-completed",
    status: "completed"
  });
  const otherRepository = sampleQueueJob({
    key: "job-other-repo",
    status: "queued",
    identity: sampleIdentity({ repositoryId: 999, repositoryFullName: "owner/other" })
  });

  const plan = createHostedQueueCleanupPlan({
    trigger: "repository_removed",
    installationId: 123,
    repositoryId: 456,
    requestedAt: "2026-05-23T12:10:00.000Z",
    jobs: [
      matchingQueued,
      matchingRunning,
      matchingCompleted,
      {
        ...otherRepository,
        rawSource: "const secret = 'redacted';",
        rawDiff: "diff --git a/private.ts b/private.ts",
        customerPayload: { email: "person@example.test" }
      }
    ]
  });
  const serialized = JSON.stringify(plan);

  assert.equal(
    getHostedQueueCleanupIdempotencyKey({
      trigger: "repository_removed",
      installationId: 123,
      repositoryId: 456
    }),
    "queue-cleanup:repository_removed:123:456"
  );
  assert.equal(plan.scope, "repository");
  assert.deepEqual(plan.cancelQueuedJobKeys, ["job-queued"]);
  assert.deepEqual(plan.requestRunningCancellationJobKeys, ["job-running"]);
  assert.deepEqual(plan.preserveTerminalJobKeys, ["job-completed"]);
  assert.deepEqual(plan.keepUnmatchedJobKeys, ["job-other-repo"]);
  assert.equal(plan.cancelQueuedJobs, true);
  assert.equal(plan.deleteRawSource, false);
  assert.equal(serialized.includes("rawSource"), false);
  assert.equal(serialized.includes("rawDiff"), false);
  assert.equal(serialized.includes("redacted"), false);
  assert.equal(serialized.includes("person@example.test"), false);
});

test("hosted queue cleanup is installation-scoped and repeated cleanup is idempotent", () => {
  const installationPlan = createHostedQueueCleanupPlan({
    trigger: "installation_deleted",
    installationId: 123,
    requestedAt: "2026-05-23T12:10:00.000Z",
    jobs: [
      sampleQueueJob({ key: "job-a", status: "queued" }),
      sampleQueueJob({
        key: "job-b",
        status: "queued",
        identity: sampleIdentity({ repositoryId: 999, repositoryFullName: "owner/other" })
      }),
      sampleQueueJob({
        key: "job-c",
        status: "queued",
        identity: sampleIdentity({ installationId: 999, repositoryId: 111 })
      })
    ]
  });
  const repeated = createHostedQueueCleanupPlan({
    trigger: "repeated_cleanup",
    installationId: 123,
    repositoryId: 456,
    requestedAt: "2026-05-23T12:15:00.000Z",
    jobs: [
      sampleQueueJob({ key: "job-cancelled", status: "cancelled" }),
      sampleQueueJob({ key: "job-failed", status: "failed" })
    ]
  });

  assert.equal(installationPlan.scope, "installation");
  assert.deepEqual(installationPlan.cancelQueuedJobKeys, ["job-a", "job-b"]);
  assert.deepEqual(installationPlan.keepUnmatchedJobKeys, ["job-c"]);
  assert.equal(installationPlan.idempotencyKey, "queue-cleanup:installation_deleted:123:all");
  assert.equal(repeated.idempotent, true);
  assert.deepEqual(repeated.cancelQueuedJobKeys, []);
  assert.deepEqual(repeated.requestRunningCancellationJobKeys, []);
  assert.deepEqual(repeated.preserveTerminalJobKeys, ["job-cancelled", "job-failed"]);
});

test("hosted worker checkout cleanup plans deletion for every normal terminal state", () => {
  const terminalStates = ["success", "failure", "timeout", "cancellation"];

  for (const terminalState of terminalStates) {
    const plan = createHostedWorkerCheckoutCleanupPlan({
      identity: sampleIdentity(),
      jobKey: `job-${terminalState}`,
      terminalState,
      finishedAt: "2026-05-23T12:20:00.000Z",
      checkoutPath: `/tmp/private-checkouts/${terminalState}`,
      rawSource: "const secret = 'redacted';",
      rawDiff: "diff --git a/private.ts b/private.ts",
      customerPayload: { email: "person@example.test" }
    });
    const serialized = JSON.stringify(plan);

    assert.equal(plan.cleanupAction, "delete_checkout");
    assert.equal(plan.shouldDeleteWorkerCheckout, true);
    assert.equal(plan.shouldRemoveCredentials, true);
    assert.equal(plan.requiresOperatorReview, false);
    assert.deepEqual(Object.keys(plan.safeMetadata).sort(), [
      "finishedAt",
      "installationId",
      "jobKey",
      "pullRequestNumber",
      "repositoryFullName",
      "repositoryId",
      "scannerVersion",
      "terminalState"
    ]);
    assert.equal(serialized.includes("/tmp/private-checkouts"), false);
    assert.equal(serialized.includes("rawSource"), false);
    assert.equal(serialized.includes("rawDiff"), false);
    assert.equal(serialized.includes("redacted"), false);
    assert.equal(serialized.includes("person@example.test"), false);
  }
});

test("hosted worker checkout cleanup records cleanup failures without exposing checkout data", () => {
  const plan = createHostedWorkerCheckoutCleanupPlan({
    identity: sampleIdentity(),
    jobKey: "job-cleanup-failure",
    terminalState: "cleanup_failure",
    finishedAt: "2026-05-23T12:25:00.000Z",
    checkoutPath: "/tmp/private-checkouts/failed",
    cleanupError: "permission denied for /tmp/private-checkouts/failed"
  });
  const serialized = JSON.stringify(plan);

  assert.equal(plan.cleanupAction, "record_cleanup_failure");
  assert.equal(plan.shouldDeleteWorkerCheckout, false);
  assert.equal(plan.requiresOperatorReview, true);
  assert.equal(plan.preserveAuditRecord, true);
  assert.match(plan.visibleUserMessage, /manual cleanup review/i);
  assert.equal(plan.privacy.returnsCheckoutPath, false);
  assert.equal(serialized.includes("/tmp/private-checkouts"), false);
  assert.equal(serialized.includes("permission denied"), false);
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
