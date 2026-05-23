import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { test } from "node:test";

const signingKey = "hosted-service-test-signing-key";

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

async function loadHostedServiceRuntime() {
  const service = await import("../dist/hosted/service.js");
  assert.equal(typeof service.createHostedServiceRuntime, "function");
  assert.equal(typeof service.createInMemoryHostedServiceAdapters, "function");
  return service;
}

test("hosted service runtime accepts signed webhooks and runs one check-run-only worker job", async () => {
  const { createHostedServiceRuntime, createInMemoryHostedServiceAdapters } =
    await loadHostedServiceRuntime();
  const adapters = createInMemoryHostedServiceAdapters();
  const payload = pullRequestPayload();
  const runtime = createHostedServiceRuntime({
    signingKey,
    scannerVersion: "0.19.0",
    selectedRepositoryIdsByInstallation: { 123: [456] },
    now: () => "2026-05-24T12:00:00.000Z",
    queue: adapters.queue,
    compactReportStore: adapters.compactReportStore,
    checkRunPublisher: adapters.checkRunPublisher,
    scanRunner: async ({ plan }) => {
      assert.equal(plan.readOnly, true);
      assert.equal(plan.cli.command, "ai-saas-guard");
      assert.deepEqual(plan.cli.args, [
        "pr-risk",
        "--root",
        "<worker-checkout>",
        "--base",
        "b".repeat(40),
        "--json"
      ]);

      return {
        summaryCounts: { critical: 0, high: 1, medium: 0, low: 0, info: 0 },
        findings: [
          {
            ruleId: "stripe.webhook.missing-signature",
            severity: "high",
            file: "app/api/stripe/webhook/route.ts",
            line: 12
          }
        ],
        rawSource: "const secret = 'redacted';",
        rawDiff: "diff --git a/private.ts b/private.ts",
        secretValues: ["redacted"],
        customerPayload: { email: "person@example.test" }
      };
    }
  });

  const accepted = runtime.handlePullRequestWebhook({
    payload,
    signatureHeader: signatureFor(payload),
    deliveryId: "delivery-1"
  });
  const duplicate = runtime.handlePullRequestWebhook({
    payload,
    signatureHeader: signatureFor(payload),
    deliveryId: "delivery-2"
  });
  const worker = await runtime.runNextQueuedScan();
  const serialized = JSON.stringify({ accepted, duplicate, worker, adapters });

  assert.equal(accepted.accepted, true);
  assert.equal(accepted.stage, "queue");
  assert.equal(accepted.queueDecision.created, true);
  assert.equal(accepted.shouldCreatePrComment, false);
  assert.equal(duplicate.accepted, true);
  assert.equal(duplicate.queueDecision.reusedExistingJob, true);
  assert.equal(adapters.queue.records.size, 1);

  assert.equal(worker.processed, true);
  assert.equal(worker.status, "completed");
  assert.equal(worker.checkRunPublication.shouldWriteCheckRun, true);
  assert.equal(worker.checkRunPublication.shouldCreatePrComment, false);
  assert.equal(worker.cleanup.shouldDeleteWorkerCheckout, true);
  assert.equal(adapters.compactReportStore.records.length, 1);
  assert.equal(adapters.checkRunPublisher.requests.length, 1);
  assert.equal(adapters.checkRunPublisher.requests[0].payload.name, "AI SaaS Guard");
  assert.match(adapters.checkRunPublisher.requests[0].payload.output.text, /Local CLI/i);
  assert.equal(serialized.includes("evil/repo"), false);
  assert.equal(serialized.includes("token=contents:write"), false);
  assert.equal(serialized.includes("rm -rf"), false);
  assert.equal(serialized.includes("rawSource"), false);
  assert.equal(serialized.includes("rawDiff"), false);
  assert.equal(serialized.includes("redacted"), false);
  assert.equal(serialized.includes("person@example.test"), false);
});

test("hosted service runtime rejects invalid webhooks before queue or worker side effects", async () => {
  const { createHostedServiceRuntime, createInMemoryHostedServiceAdapters } =
    await loadHostedServiceRuntime();
  const adapters = createInMemoryHostedServiceAdapters();
  const payload = pullRequestPayload();
  const runtime = createHostedServiceRuntime({
    signingKey,
    scannerVersion: "0.19.0",
    selectedRepositoryIdsByInstallation: { 123: [456] },
    queue: adapters.queue,
    compactReportStore: adapters.compactReportStore,
    checkRunPublisher: adapters.checkRunPublisher,
    scanRunner: async () => {
      throw new Error("scan runner should not be called");
    }
  });

  const rejected = runtime.handlePullRequestWebhook({
    payload,
    signatureHeader: signatureFor(`${payload}\n`),
    deliveryId: "delivery-invalid"
  });
  const worker = await runtime.runNextQueuedScan();

  assert.equal(rejected.accepted, false);
  assert.equal(rejected.stage, "signature");
  assert.equal(rejected.reason, "invalid_signature");
  assert.equal(rejected.shouldFetchRepository, false);
  assert.equal(adapters.queue.records.size, 0);
  assert.equal(adapters.compactReportStore.records.length, 0);
  assert.equal(adapters.checkRunPublisher.requests.length, 0);
  assert.equal(worker.processed, false);
  assert.equal(worker.reason, "empty_queue");
});

test("hosted service runtime records cleanup-safe worker failures", async () => {
  const { createHostedServiceRuntime, createInMemoryHostedServiceAdapters } =
    await loadHostedServiceRuntime();
  const adapters = createInMemoryHostedServiceAdapters();
  const payload = pullRequestPayload();
  const runtime = createHostedServiceRuntime({
    signingKey,
    scannerVersion: "0.19.0",
    selectedRepositoryIdsByInstallation: { 123: [456] },
    now: () => "2026-05-24T12:05:00.000Z",
    queue: adapters.queue,
    compactReportStore: adapters.compactReportStore,
    checkRunPublisher: adapters.checkRunPublisher,
    scanRunner: async () => {
      throw new Error("private checkout /tmp/private-checkouts/job failed");
    }
  });

  runtime.handlePullRequestWebhook({
    payload,
    signatureHeader: signatureFor(payload),
    deliveryId: "delivery-worker-failure"
  });
  const worker = await runtime.runNextQueuedScan();
  const serialized = JSON.stringify(worker);

  assert.equal(worker.processed, true);
  assert.equal(worker.status, "failed");
  assert.equal(worker.errorClass, "scan_runner_failed");
  assert.equal(worker.cleanup.shouldDeleteWorkerCheckout, true);
  assert.equal(worker.cleanup.privacy.returnsCleanupError, false);
  assert.equal(adapters.compactReportStore.records.length, 0);
  assert.equal(adapters.checkRunPublisher.requests.length, 0);
  assert.equal(serialized.includes("/tmp/private-checkouts"), false);
  assert.equal(serialized.includes("private checkout"), false);
});
