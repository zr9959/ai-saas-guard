import assert from "node:assert/strict";
import { generateKeyPairSync, verify } from "node:crypto";
import { test } from "node:test";

const identity = {
  installationId: 123,
  repositoryId: 456,
  repositoryFullName: "owner/repo",
  pullRequestNumber: 7,
  baseSha: "b".repeat(40),
  headSha: "a".repeat(40),
  scannerVersion: "0.20.0"
};

async function loadProductionAdapters() {
  const adapters = await import("../dist/hosted/production-adapters.js");
  assert.equal(typeof adapters.createHostedGitHubAppJwt, "function");
  assert.equal(typeof adapters.planHostedGitHubInstallationTokenRequest, "function");
  assert.equal(typeof adapters.planHostedProductionWorkerExecution, "function");
  return adapters;
}

function decodeJwtPart(token, index) {
  const part = token.split(".")[index];
  assert.ok(part);
  return JSON.parse(Buffer.from(part, "base64url").toString("utf8"));
}

function verifyJwtSignature(token, publicKey) {
  const [header, payload, signature] = token.split(".");
  assert.ok(header);
  assert.ok(payload);
  assert.ok(signature);
  return verify(
    "RSA-SHA256",
    Buffer.from(`${header}.${payload}`),
    publicKey,
    Buffer.from(signature, "base64url")
  );
}

test("hosted GitHub App JWT is RS256, short lived, and does not expose private key material", async () => {
  const { createHostedGitHubAppJwt } = await loadProductionAdapters();
  const { privateKey, publicKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  const privateKeyPem = privateKey.export({ format: "pem", type: "pkcs8" }).toString();
  const issued = createHostedGitHubAppJwt({
    appId: "12345",
    privateKey: privateKeyPem,
    nowSeconds: 1_772_000_000
  });
  const header = decodeJwtPart(issued.token, 0);
  const payload = decodeJwtPart(issued.token, 1);
  const serialized = JSON.stringify(issued);

  assert.equal(header.alg, "RS256");
  assert.equal(header.typ, "JWT");
  assert.equal(payload.iss, "12345");
  assert.equal(payload.iat, 1_771_999_940);
  assert.equal(payload.exp, 1_772_000_600);
  assert.equal(issued.issuedAt, 1_771_999_940);
  assert.equal(issued.expiresAt, 1_772_000_600);
  assert.equal(issued.maxTtlSeconds, 600);
  assert.equal(issued.privacy.includesPrivateKey, false);
  assert.equal(verifyJwtSignature(issued.token, publicKey), true);
  assert.equal(serialized.includes("BEGIN PRIVATE KEY"), false);
  assert.equal(serialized.includes(privateKeyPem), false);
});

test("hosted installation token request plans scoped GitHub permissions without persisting bearer tokens", async () => {
  const { planHostedGitHubInstallationTokenRequest } = await loadProductionAdapters();
  const plan = planHostedGitHubInstallationTokenRequest({
    installationId: 123,
    repositoryId: 456,
    purpose: "first_slice",
    requestedAt: "2026-05-24T13:00:00.000Z",
    apiBaseUrl: "https://api.github.com",
    appJwt: "gh-app-jwt-should-not-be-serialized",
    rawPrivateKey: "-----BEGIN PRIVATE KEY-----should-not-leak",
    rawInstallationToken: "ghs_should-not-leak"
  });
  const serialized = JSON.stringify(plan);

  assert.equal(plan.readyToRequestToken, false);
  assert.deepEqual(plan.blockedReasons, [
    "raw_secret_material:appJwt",
    "raw_secret_material:rawPrivateKey",
    "raw_secret_material:rawInstallationToken"
  ]);
  assert.equal(plan.request.method, "POST");
  assert.equal(plan.request.endpoint, "/app/installations/123/access_tokens");
  assert.equal(plan.request.url, "https://api.github.com/app/installations/123/access_tokens");
  assert.deepEqual(plan.request.body.repository_ids, [456]);
  assert.deepEqual(plan.request.body.permissions, {
    contents: "read",
    pull_requests: "read",
    checks: "write"
  });
  assert.equal(plan.request.authorization, "runtime_bearer_app_jwt");
  assert.equal(plan.request.headers.accept, "application/vnd.github+json");
  assert.equal(plan.request.headers["x-github-api-version"], "2026-03-10");
  assert.equal(plan.responseHandling.persistToken, false);
  assert.equal(plan.responseHandling.cacheUntilExpiresAt, true);
  assert.equal(plan.responseHandling.redactTokenInLogs, true);
  assert.equal(plan.privacy.includesAppJwt, false);
  assert.equal(plan.privacy.includesInstallationToken, false);
  assert.equal(plan.privacy.includesPrivateKey, false);
  assert.equal(serialized.includes("gh-app-jwt-should-not-be-serialized"), false);
  assert.equal(serialized.includes("BEGIN PRIVATE KEY"), false);
  assert.equal(serialized.includes("ghs_should-not-leak"), false);
});

test("hosted production worker execution fixes command, bounds resources, and plans cleanup for every terminal state", async () => {
  const { planHostedProductionWorkerExecution } = await loadProductionAdapters();
  const plan = planHostedProductionWorkerExecution({
    identity,
    jobKey: "123:456:7:head:0.20.0",
    requestedAt: "2026-05-24T13:05:00.000Z",
    selectedRepositoryIds: [456],
    temporaryCheckoutRoot: "/private/tmp/ai-saas-guard/job-123",
    workerTimeoutMs: 60 * 60 * 1000,
    maxOutputBytes: 50 * 1024 * 1024,
    rawSource: "const secret = 'redacted';",
    rawDiff: "diff --git a/private.ts b/private.ts",
    secretValues: ["redacted"],
    customerPayload: { email: "person@example.test" }
  });
  const serialized = JSON.stringify(plan);

  assert.equal(plan.readyToRunWorker, true);
  assert.deepEqual(plan.blockedReasons, []);
  assert.equal(plan.workerPlan.accepted, true);
  assert.equal(plan.workerPlan.cli.command, "ai-saas-guard");
  assert.deepEqual(plan.workerPlan.cli.args, [
    "pr-risk",
    "--root",
    "<worker-checkout>",
    "--base",
    "b".repeat(40),
    "--json"
  ]);
  assert.equal(plan.checkoutTokenRequest.readyToRequestToken, true);
  assert.deepEqual(plan.checkoutTokenRequest.request.body.permissions, {
    contents: "read",
    pull_requests: "read"
  });
  assert.equal(plan.checkRunTokenRequest.readyToRequestToken, true);
  assert.deepEqual(plan.checkRunTokenRequest.request.body.permissions, {
    checks: "write"
  });
  assert.equal(plan.execution.timeoutMs, 600_000);
  assert.equal(plan.execution.maxOutputBytes, 1_048_576);
  assert.equal(plan.execution.cancellation, "supported");
  assert.equal(plan.execution.networkAccess, "disabled");
  assert.equal(plan.output.compactJsonOnly, true);
  assert.equal(plan.output.persistRawSource, false);
  assert.equal(plan.output.persistRawDiffs, false);
  assert.equal(plan.cleanup.success.shouldDeleteWorkerCheckout, true);
  assert.equal(plan.cleanup.failure.shouldDeleteWorkerCheckout, true);
  assert.equal(plan.cleanup.timeout.shouldDeleteWorkerCheckout, true);
  assert.equal(plan.cleanup.cancellation.shouldDeleteWorkerCheckout, true);
  assert.equal(plan.cleanup.failure.safeMetadata.terminalState, "failure");
  assert.equal(serialized.includes("/private/tmp/ai-saas-guard"), false);
  assert.equal(serialized.includes("rawSource"), false);
  assert.equal(serialized.includes("rawDiff"), false);
  assert.equal(serialized.includes("redacted"), false);
  assert.equal(serialized.includes("person@example.test"), false);
});
