import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { test } from "node:test";

const signingKey = "hosted-app-test-signing-key";

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

async function loadHostedApp() {
  const app = await import("../dist/hosted/app.js");
  assert.equal(typeof app.createHostedHttpApp, "function");
  assert.equal(typeof app.createInMemoryHostedAppPlatform, "function");
  assert.equal(typeof app.planHostedNodeContainerDeployment, "function");
  return app;
}

function jsonBody(response) {
  return JSON.parse(response.body);
}

test("hosted app skeleton accepts signed webhooks and processes one worker tick through provider adapters", async () => {
  const { createInMemoryHostedAppPlatform } = await loadHostedApp();
  const payload = pullRequestPayload();
  const platform = createInMemoryHostedAppPlatform({
    signingKey,
    scannerVersion: "0.22.0",
    selectedRepositoryIdsByInstallation: { 123: [456] },
    now: () => "2026-05-24T14:00:00.000Z",
    scanRunner: async ({ plan }) => {
      assert.equal(plan.cli.command, "ai-saas-guard");
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

  const webhook = platform.app.handleHttpRequest({
    method: "POST",
    path: "/github/webhook",
    headers: {
      "x-hub-signature-256": signatureFor(payload),
      "x-github-delivery": "delivery-1"
    },
    body: payload
  });
  const worker = await platform.app.runWorkerTick();
  const serialized = JSON.stringify({ webhook, worker, platform });

  assert.equal(webhook.status, 202);
  assert.equal(jsonBody(webhook).accepted, true);
  assert.equal(jsonBody(webhook).stage, "queue");
  assert.equal(jsonBody(webhook).queuedWorker, true);
  assert.equal(worker.processed, true);
  assert.equal(worker.status, "completed");
  assert.equal(platform.adapters.queue.records.size, 1);
  assert.equal(platform.adapters.compactReportStore.records.length, 1);
  assert.equal(platform.adapters.checkRunPublisher.requests.length, 1);
  assert.equal(platform.adapters.checkRunPublisher.requests[0].payload.name, "AI SaaS Guard");
  assert.equal(serialized.includes("evil/repo"), false);
  assert.equal(serialized.includes("token=contents:write"), false);
  assert.equal(serialized.includes("rm -rf"), false);
  assert.equal(serialized.includes("rawSource"), false);
  assert.equal(serialized.includes("rawDiff"), false);
  assert.equal(serialized.includes("redacted"), false);
  assert.equal(serialized.includes("person@example.test"), false);
});

test("hosted app skeleton exposes safe health and rejects invalid routes before side effects", async () => {
  const { createInMemoryHostedAppPlatform } = await loadHostedApp();
  const platform = createInMemoryHostedAppPlatform({
    signingKey,
    scannerVersion: "0.22.0",
    selectedRepositoryIdsByInstallation: { 123: [456] },
    scanRunner: async () => {
      throw new Error("worker should not run");
    }
  });
  const payload = pullRequestPayload();

  const health = platform.app.handleHttpRequest({
    method: "GET",
    path: "/healthz",
    headers: {},
    body: ""
  });
  const wrongMethod = platform.app.handleHttpRequest({
    method: "GET",
    path: "/github/webhook",
    headers: {},
    body: ""
  });
  const unknownRoute = platform.app.handleHttpRequest({
    method: "POST",
    path: "/unknown",
    headers: {},
    body: payload
  });
  const missingSignature = platform.app.handleHttpRequest({
    method: "POST",
    path: "/github/webhook",
    headers: { "x-github-delivery": "delivery-unsigned" },
    body: payload
  });

  assert.equal(health.status, 200);
  assert.equal(jsonBody(health).ok, true);
  assert.equal(jsonBody(health).platform, "node_container");
  assert.deepEqual(jsonBody(health).roles, ["webhook-ingress", "scan-worker"]);
  assert.equal(wrongMethod.status, 405);
  assert.equal(unknownRoute.status, 404);
  assert.equal(missingSignature.status, 400);
  assert.equal(jsonBody(missingSignature).accepted, false);
  assert.equal(jsonBody(missingSignature).reason, "missing_signature");
  assert.equal(platform.adapters.queue.records.size, 0);
  assert.equal(platform.adapters.compactReportStore.records.length, 0);
  assert.equal(platform.adapters.checkRunPublisher.requests.length, 0);
});

test("hosted node container deployment plan maps real provider adapters without raw secrets", async () => {
  const { planHostedNodeContainerDeployment } = await loadHostedApp();
  const plan = planHostedNodeContainerDeployment({
    environment: "production",
    publicBaseUrl: "https://guard.example.test",
    containerImageDigest: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    secretRefs: {
      githubAppId: "secret:AI_SAAS_GUARD_APP_ID",
      githubAppPrivateKey: "secret:AI_SAAS_GUARD_APP_KEY",
      githubWebhookSecret: "secret:AI_SAAS_GUARD_WEBHOOK_SECRET"
    },
    queueRef: "queue:hosted-scan-jobs",
    compactReportStoreRef: "store:compact-reports",
    workerSandboxRef: "sandbox:readonly-checkouts",
    checkRunPublisherRef: "github-checks:installation",
    rawPrivateKey: "-----BEGIN PRIVATE KEY-----should-not-leak",
    rawWebhookSecret: "whsec_should-not-leak",
    rawInstallationToken: "ghs_should-not-leak"
  });
  const serialized = JSON.stringify(plan);

  assert.equal(plan.readyToDeploy, false);
  assert.deepEqual(plan.blockedReasons, [
    "raw_secret_material:rawPrivateKey",
    "raw_secret_material:rawWebhookSecret",
    "raw_secret_material:rawInstallationToken"
  ]);
  assert.equal(plan.platform, "node_container");
  assert.deepEqual(plan.roles, ["webhook-ingress", "scan-worker"]);
  assert.equal(plan.endpoints.webhookUrl, "https://guard.example.test/github/webhook");
  assert.equal(plan.endpoints.healthUrl, "https://guard.example.test/healthz");
  assert.deepEqual(plan.adapters, {
    secretManager: "platform_secret_manager",
    queue: "queue:hosted-scan-jobs",
    compactReportStore: "store:compact-reports",
    workerSandbox: "sandbox:readonly-checkouts",
    checkRunPublisher: "github-checks:installation"
  });
  assert.equal(plan.runtime.localCliNoNetwork, true);
  assert.equal(plan.runtime.rawSourcePersistence, false);
  assert.equal(plan.privacy.includesPrivateKey, false);
  assert.equal(plan.privacy.includesWebhookSecret, false);
  assert.equal(plan.privacy.includesInstallationToken, false);
  assert.equal(serialized.includes("BEGIN PRIVATE KEY"), false);
  assert.equal(serialized.includes("whsec_should-not-leak"), false);
  assert.equal(serialized.includes("ghs_should-not-leak"), false);
});

test("hosted node container deployment plan blocks unsafe URLs and incomplete adapter refs", async () => {
  const { planHostedNodeContainerDeployment } = await loadHostedApp();
  const plan = planHostedNodeContainerDeployment({
    environment: "production",
    publicBaseUrl: "http://localhost:3000",
    containerImageDigest: "not-a-digest",
    secretRefs: {
      githubAppId: "",
      githubAppPrivateKey: "secret:key",
      githubWebhookSecret: ""
    },
    queueRef: "",
    compactReportStoreRef: "store:compact-reports",
    workerSandboxRef: "",
    checkRunPublisherRef: ""
  });

  assert.equal(plan.readyToDeploy, false);
  assert.deepEqual(plan.blockedReasons, [
    "invalid_public_base_url",
    "invalid_container_image_digest",
    "missing_secret_ref:githubAppId",
    "missing_secret_ref:githubWebhookSecret",
    "missing_adapter_ref:queue",
    "missing_adapter_ref:workerSandbox",
    "missing_adapter_ref:checkRunPublisher"
  ]);
  assert.equal(plan.endpoints.webhookUrl, "");
  assert.equal(plan.endpoints.healthUrl, "");
  assert.equal(JSON.stringify(plan).includes("localhost"), false);
});

test("hosted node container deployment plan blocks raw source data and invalid provider refs", async () => {
  const { planHostedNodeContainerDeployment } = await loadHostedApp();
  const plan = planHostedNodeContainerDeployment({
    environment: "production",
    publicBaseUrl: "https://guard.example.test/",
    containerImageDigest: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    secretRefs: {
      githubAppId: "12345",
      githubAppPrivateKey: "-----BEGIN PRIVATE KEY-----",
      githubWebhookSecret: "plain-webhook-secret"
    },
    queueRef: "memory-only",
    compactReportStoreRef: "local-file",
    workerSandboxRef: "shell",
    checkRunPublisherRef: "http",
    rawSource: "const secret = 'do-not-echo';",
    rawDiff: "diff --git a/private.ts b/private.ts",
    secretValues: ["sk_live_do_not_echo"],
    customerPayload: { email: "customer@example.test" }
  });
  const serialized = JSON.stringify(plan);

  assert.equal(plan.readyToDeploy, false);
  assert.deepEqual(plan.blockedReasons, [
    "invalid_secret_ref:githubAppId",
    "invalid_secret_ref:githubAppPrivateKey",
    "invalid_secret_ref:githubWebhookSecret",
    "invalid_adapter_ref:queue",
    "invalid_adapter_ref:compactReportStore",
    "invalid_adapter_ref:workerSandbox",
    "invalid_adapter_ref:checkRunPublisher",
    "raw_source_material:rawSource",
    "raw_source_material:rawDiff",
    "raw_secret_material:secretValues",
    "raw_customer_payload:customerPayload"
  ]);
  assert.equal(serialized.includes("do-not-echo"), false);
  assert.equal(serialized.includes("private.ts"), false);
  assert.equal(serialized.includes("sk_live_do_not_echo"), false);
  assert.equal(serialized.includes("customer@example.test"), false);
});
