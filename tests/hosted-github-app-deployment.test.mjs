import assert from "node:assert/strict";
import { test } from "node:test";

async function loadGitHubAppDeploymentPlanner() {
  const deployment = await import("../dist/hosted/github-app.js");
  assert.equal(typeof deployment.planHostedGitHubAppDeployment, "function");
  assert.equal(typeof deployment.HOSTED_GITHUB_APP_REQUIRED_PERMISSIONS, "object");
  assert.equal(Array.isArray(deployment.HOSTED_GITHUB_APP_EVENTS), true);
  return deployment;
}

function passingReleaseGate() {
  return {
    shouldExposeHostedEnvironment: true,
    blocked: false,
    containerImageDigestRecorded: true,
    missingEvidenceIds: [],
    failedEvidenceIds: [],
    staleEvidenceIds: [],
    exceptionEvidenceIds: [],
    releaseNotesCompliant: true
  };
}

test("hosted GitHub App deployment planner creates a least-privilege manifest", async () => {
  const {
    HOSTED_GITHUB_APP_EVENTS,
    HOSTED_GITHUB_APP_REQUIRED_PERMISSIONS,
    planHostedGitHubAppDeployment
  } = await loadGitHubAppDeploymentPlanner();
  const plan = planHostedGitHubAppDeployment({
    appName: "AI SaaS Guard Hosted",
    homepageUrl: "https://ai-saas-guard.example.test",
    webhookUrl: "https://ai-saas-guard.example.test/github/webhook",
    setupUrl: "https://ai-saas-guard.example.test/setup",
    callbackUrl: "https://ai-saas-guard.example.test/oauth/callback",
    environment: "production",
    containerImageDigest: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    secretRefs: {
      appId: "secret:AI_SAAS_GUARD_APP_ID",
      privateKey: "secret:AI_SAAS_GUARD_PRIVATE_KEY",
      webhookSecret: "secret:AI_SAAS_GUARD_WEBHOOK_SECRET"
    },
    releaseGate: passingReleaseGate(),
    rawPrivateKey: undefined,
    rawWebhookSecret: undefined
  });
  const serialized = JSON.stringify(plan);

  assert.equal(plan.readyToCreateGitHubApp, true);
  assert.deepEqual(plan.blockedReasons, []);
  assert.deepEqual(plan.manifest.default_permissions, HOSTED_GITHUB_APP_REQUIRED_PERMISSIONS);
  assert.deepEqual(plan.manifest.default_events, HOSTED_GITHUB_APP_EVENTS);
  assert.equal(plan.manifest.hook_attributes.url, "https://ai-saas-guard.example.test/github/webhook");
  assert.equal(plan.manifest.hook_attributes.active, true);
  assert.equal(plan.manifest.public, false);
  assert.equal(plan.manifest.default_permissions.contents, "read");
  assert.equal(plan.manifest.default_permissions.pull_requests, "read");
  assert.equal(plan.manifest.default_permissions.checks, "write");
  assert.equal(plan.manifest.default_permissions.metadata, "read");
  assert.equal("administration" in plan.manifest.default_permissions, false);
  assert.equal("actions" in plan.manifest.default_permissions, false);
  assert.equal("secrets" in plan.manifest.default_permissions, false);
  assert.deepEqual(plan.requiredSecretRefs, [
    "secret:AI_SAAS_GUARD_APP_ID",
    "secret:AI_SAAS_GUARD_PRIVATE_KEY",
    "secret:AI_SAAS_GUARD_WEBHOOK_SECRET"
  ]);
  assert.equal(plan.privacy.includesPrivateKey, false);
  assert.equal(plan.privacy.includesWebhookSecret, false);
  assert.equal(serialized.includes("BEGIN PRIVATE KEY"), false);
  assert.equal(serialized.includes("whsec_should-not-leak"), false);
});

test("hosted GitHub App deployment planner blocks private URLs and raw secret input fields", async () => {
  const { planHostedGitHubAppDeployment } = await loadGitHubAppDeploymentPlanner();
  const plan = planHostedGitHubAppDeployment({
    appName: "AI SaaS Guard Hosted",
    homepageUrl: "https://[::1]/",
    webhookUrl: "https://10.0.0.8/github/webhook",
    environment: "production",
    containerImageDigest: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
    secretRefs: {
      appId: "platform-ref:github-app-id",
      privateKey: "platform-ref:github-app-key",
      webhookSecret: "platform-ref:github-webhook"
    },
    releaseGate: passingReleaseGate(),
    rawPrivateKey: "-----BEGIN PRIVATE KEY-----should-not-leak",
    rawWebhookSecret: "whsec_should-not-leak"
  });
  const serialized = JSON.stringify(plan);

  assert.equal(plan.readyToCreateGitHubApp, false);
  assert.deepEqual(plan.blockedReasons, [
    "invalid_homepage_url",
    "invalid_webhook_url",
    "raw_secret_material:rawPrivateKey",
    "raw_secret_material:rawWebhookSecret"
  ]);
  assert.equal(serialized.includes("BEGIN PRIVATE KEY"), false);
  assert.equal(serialized.includes("whsec_should-not-leak"), false);
});

test("hosted GitHub App deployment planner blocks unsafe or incomplete deployment inputs", async () => {
  const { planHostedGitHubAppDeployment } = await loadGitHubAppDeploymentPlanner();
  const plan = planHostedGitHubAppDeployment({
    appName: "AI SaaS Guard Hosted",
    homepageUrl: "https://ai-saas-guard.example.test",
    webhookUrl: "http://localhost:3000/github/webhook",
    environment: "production",
    containerImageDigest: "not-a-digest",
    secretRefs: {
      appId: "",
      privateKey: "-----BEGIN PRIVATE KEY-----raw",
      webhookSecret: "whsec_raw"
    },
    requestedPermissions: {
      contents: "write",
      pull_requests: "write",
      checks: "write",
      metadata: "read",
      administration: "write"
    },
    requestedEvents: ["pull_request", "push"],
    releaseGate: {
      ...passingReleaseGate(),
      shouldExposeHostedEnvironment: false,
      blocked: true,
      missingEvidenceIds: ["container_scan"]
    }
  });
  const serialized = JSON.stringify(plan);

  assert.equal(plan.readyToCreateGitHubApp, false);
  assert.deepEqual(plan.blockedReasons, [
    "release_gate_blocked",
    "invalid_container_image_digest",
    "invalid_webhook_url",
    "missing_secret_ref:appId",
    "raw_secret_material:privateKey",
    "raw_secret_material:webhookSecret",
    "permission_not_allowed:administration",
    "permission_not_allowed:contents",
    "permission_not_allowed:pull_requests",
    "event_not_allowed:push"
  ]);
  assert.equal(plan.manifest.default_permissions.contents, "read");
  assert.equal(plan.manifest.default_permissions.pull_requests, "read");
  assert.deepEqual(plan.manifest.default_events, ["pull_request", "installation", "installation_repositories"]);
  assert.equal(serialized.includes("BEGIN PRIVATE KEY"), false);
  assert.equal(serialized.includes("whsec_raw"), false);
});
