import assert from "node:assert/strict";
import { createHmac, randomUUID } from "node:crypto";
import { test } from "node:test";

import worker, {
  HOSTED_WORKER_PRIVACY,
  MAX_WEBHOOK_PAYLOAD_BYTES,
  createGitHubAppManifestCallback,
  createHostedWorkerHealth,
  parsePullRequestWebhookIdentity,
  verifyGitHubWebhookSignature
} from "../hosted/cloudflare-worker/src/index.js";

function signPayload(payload, secret) {
  return `sha256=${createHmac("sha256", secret).update(payload).digest("hex")}`;
}

function createKv() {
  const records = new Map();
  return {
    records,
    async get(key) {
      return records.get(key) ?? null;
    },
    async put(key, value) {
      records.set(key, value);
    }
  };
}

function createPullRequestPayload(overrides = {}) {
  return {
    action: "synchronize",
    installation: { id: 12345 },
    repository: {
      id: 67890,
      full_name: "zr9959/ai-saas-guard",
      private: false
    },
    pull_request: {
      number: 42,
      draft: false,
      base: { sha: "b".repeat(40), ref: "main" },
      head: { sha: "a".repeat(40), ref: "feature-branch" },
      title: "Untrusted title should not choose identity",
      body: "Untrusted body should not choose identity"
    },
    ...overrides
  };
}

test("Cloudflare hosted worker health response is public-safe", () => {
  const health = createHostedWorkerHealth();

  assert.equal(health.ok, true);
  assert.equal(health.service, "ai-saas-guard-hosted");
  assert.equal(health.mode, "webhook-ingress");
  assert.deepEqual(health.privacy, HOSTED_WORKER_PRIVACY);
  assert.doesNotMatch(JSON.stringify(health), /private key|webhook secret|installation token|raw source|raw diff/i);
});

test("Cloudflare hosted worker manifest callback never stores the GitHub one-time code", () => {
  const callback = createGitHubAppManifestCallback(
    new URL("https://ai-saas-guard.example.workers.dev/github/app/manifest-callback?code=temporary-code")
  );

  assert.equal(callback.ok, true);
  assert.equal(callback.stage, "github_app_manifest_callback");
  assert.equal(callback.manifestCodeReceived, true);
  assert.equal(callback.storesManifestCode, false);
  assert.equal(callback.nextStep, "exchange_code_server_side");
  assert.deepEqual(callback.privacy, HOSTED_WORKER_PRIVACY);
  assert.doesNotMatch(JSON.stringify(callback), /temporary-code|private key|webhook secret|installation token/i);
});

test("Cloudflare hosted worker validates GitHub webhook signatures", async () => {
  const payload = JSON.stringify(createPullRequestPayload());
  const secret = "local-test-webhook-secret";

  assert.equal(
    await verifyGitHubWebhookSignature({
      payload,
      signatureHeader: signPayload(payload, secret),
      secret
    }),
    true
  );
  assert.equal(
    await verifyGitHubWebhookSignature({
      payload,
      signatureHeader: "sha256=bad",
      secret
    }),
    false
  );
  assert.equal(
    await verifyGitHubWebhookSignature({
      payload,
      signatureHeader: "",
      secret
    }),
    false
  );
});

test("Cloudflare hosted worker extracts only trusted pull request identity fields", () => {
  const identity = parsePullRequestWebhookIdentity(createPullRequestPayload());

  assert.deepEqual(identity, {
    action: "synchronize",
    installationId: 12345,
    repositoryId: 67890,
    repositoryFullName: "zr9959/ai-saas-guard",
    repositoryPrivate: false,
    pullRequestNumber: 42,
    baseSha: "b".repeat(40),
    headSha: "a".repeat(40),
    draft: false
  });
});

test("Cloudflare hosted worker queues a signed pull request webhook idempotently", async () => {
  const secret = "local-test-webhook-secret";
  const payload = JSON.stringify(createPullRequestPayload());
  const deliveryId = randomUUID();
  const env = {
    WEBHOOK_SECRET: secret,
    HOSTED_EVENTS: createKv(),
    SCANNER_VERSION: "0.24.0"
  };
  const request = new Request("https://ai-saas-guard.example.workers.dev/github/webhook", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-github-event": "pull_request",
      "x-github-delivery": deliveryId,
      "x-hub-signature-256": signPayload(payload, secret)
    },
    body: payload
  });

  const first = await worker.fetch(request.clone(), env);
  const duplicate = await worker.fetch(request.clone(), env);
  const firstBody = await first.json();
  const duplicateBody = await duplicate.json();

  assert.equal(first.status, 202);
  assert.equal(firstBody.accepted, true);
  assert.equal(firstBody.stage, "queued");
  assert.equal(firstBody.shouldCreateCheckRun, false);
  assert.match(firstBody.scanKey, /^scan:12345:67890:42:/);
  assert.equal(duplicate.status, 202);
  assert.equal(duplicateBody.accepted, true);
  assert.equal(duplicateBody.stage, "duplicate_delivery");
  assert.equal(env.HOSTED_EVENTS.records.size, 2);

  const storedValues = [...env.HOSTED_EVENTS.records.values()].join("\n");
  assert.match(storedValues, /zr9959\/ai-saas-guard/);
  assert.doesNotMatch(storedValues, /Untrusted title|Untrusted body|raw source|raw diff|webhook secret/i);
});

test("Cloudflare hosted worker rejects invalid signatures before storage", async () => {
  const env = {
    WEBHOOK_SECRET: "local-test-webhook-secret",
    HOSTED_EVENTS: createKv(),
    SCANNER_VERSION: "0.24.0"
  };
  const response = await worker.fetch(
    new Request("https://ai-saas-guard.example.workers.dev/github/webhook", {
      method: "POST",
      headers: {
        "x-github-event": "pull_request",
        "x-github-delivery": randomUUID(),
        "x-hub-signature-256": "sha256=bad"
      },
      body: JSON.stringify(createPullRequestPayload())
    }),
    env
  );
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.equal(body.accepted, false);
  assert.equal(body.stage, "signature");
  assert.equal(env.HOSTED_EVENTS.records.size, 0);
});

test("Cloudflare hosted worker rejects oversized payloads before storage", async () => {
  const env = {
    WEBHOOK_SECRET: "local-test-webhook-secret",
    HOSTED_EVENTS: createKv(),
    SCANNER_VERSION: "0.24.0"
  };
  const response = await worker.fetch(
    new Request("https://ai-saas-guard.example.workers.dev/github/webhook", {
      method: "POST",
      headers: {
        "content-length": String(MAX_WEBHOOK_PAYLOAD_BYTES + 1),
        "x-github-event": "pull_request",
        "x-github-delivery": randomUUID(),
        "x-hub-signature-256": "sha256=not-read-before-size-check"
      },
      body: "{}"
    }),
    env
  );
  const body = await response.json();

  assert.equal(response.status, 413);
  assert.equal(body.accepted, false);
  assert.equal(body.reason, "payload_too_large");
  assert.equal(body.maxBytes, MAX_WEBHOOK_PAYLOAD_BYTES);
  assert.equal(env.HOSTED_EVENTS.records.size, 0);
});
