import assert from "node:assert/strict";
import { test } from "node:test";

const completeEvidence = [
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
].map((id) => ({
  id,
  status: "passed",
  collectedAt: "2026-05-24T16:00:00.000Z",
  evidenceUrl: `https://github.com/zr9959/ai-saas-guard/actions/runs/${id}`,
  owner: "release"
}));

const baseInput = {
  appName: "AI SaaS Guard Hosted Staging",
  environment: "staging",
  publicBaseUrl: "https://guard-staging.example.test",
  homepageUrl: "https://guard-staging.example.test",
  containerImageDigest: "sha256:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa",
  commitSha: "a23030be462e48f070fcfd40471033fc6ec5eca9",
  scannerVersion: "0.24.0",
  evaluatedAt: "2026-05-24T16:05:00.000Z",
  releaseNotes:
    "Staging hosted service evidence for review-first checks. This is not a pentest, certification, or full audit.",
  secretRefs: {
    githubAppId: "secret:AI_SAAS_GUARD_APP_ID",
    githubAppPrivateKey: "secret:AI_SAAS_GUARD_APP_KEY",
    githubWebhookSecret: "secret:AI_SAAS_GUARD_WEBHOOK_SECRET"
  },
  providerRefs: {
    secretManager: "secret-manager:platform",
    queue: "queue:hosted-scan-jobs",
    compactReportStore: "store:compact-reports",
    workerSandbox: "sandbox:readonly-checkouts",
    checkRunPublisher: "github-checks:installation",
    logDrain: "logs:redacted-json",
    metrics: "metrics:hosted-staging",
    rollback: "rollback:previous-container-digest",
    incidentResponse: "runbook:hosted-incident-response"
  },
  evidence: completeEvidence
};

async function loadStaging() {
  const staging = await import("../dist/hosted/staging.js");
  assert.equal(typeof staging.planHostedProviderBinding, "function");
  assert.equal(typeof staging.planHostedStagingDeployment, "function");
  assert.equal(typeof staging.planHostedGitHubAppPromotion, "function");
  return staging;
}

test("hosted provider binding validates durable provider references without exposing raw inputs", async () => {
  const { planHostedProviderBinding } = await loadStaging();
  const plan = planHostedProviderBinding({
    environment: "staging",
    providerRefs: baseInput.providerRefs,
    rawPrivateKey: "-----BEGIN PRIVATE KEY-----should-not-leak",
    rawWebhookSecret: "whsec_should-not-leak",
    rawInstallationToken: "ghs_should-not-leak",
    rawSource: "const secret = 'do-not-echo';",
    rawDiff: "diff --git a/private.ts b/private.ts",
    secretValues: ["sk_live_do_not_echo"],
    customerPayload: { email: "customer@example.test" }
  });
  const serialized = JSON.stringify(plan);

  assert.equal(plan.readyToBindProviders, false);
  assert.deepEqual(plan.blockedReasons, [
    "raw_secret_material:rawPrivateKey",
    "raw_secret_material:rawWebhookSecret",
    "raw_secret_material:rawInstallationToken",
    "raw_source_material:rawSource",
    "raw_source_material:rawDiff",
    "raw_secret_material:secretValues",
    "raw_customer_payload:customerPayload"
  ]);
  assert.equal(plan.adapters.queue.durable, true);
  assert.equal(plan.adapters.compactReportStore.persistsRawSource, false);
  assert.equal(plan.adapters.workerSandbox.networkAccess, "disabled");
  assert.equal(plan.adapters.checkRunPublisher.createsPrComments, false);
  assert.equal(plan.observability.logs.redacted, true);
  assert.equal(plan.operational.rollback.required, true);
  assert.equal(plan.privacy.includesPrivateKey, false);
  assert.equal(serialized.includes("BEGIN PRIVATE KEY"), false);
  assert.equal(serialized.includes("whsec_should-not-leak"), false);
  assert.equal(serialized.includes("do-not-echo"), false);
  assert.equal(serialized.includes("customer@example.test"), false);
});

test("hosted staging deployment composes app, provider, release gate, and GitHub App plans", async () => {
  const { planHostedStagingDeployment } = await loadStaging();
  const plan = planHostedStagingDeployment(baseInput);
  const serialized = JSON.stringify(plan);

  assert.equal(plan.readyForStagingExposure, true);
  assert.deepEqual(plan.blockedReasons, []);
  assert.equal(plan.environment, "staging");
  assert.equal(plan.nodeContainer.readyToDeploy, true);
  assert.equal(plan.providerBinding.readyToBindProviders, true);
  assert.equal(plan.releaseGate.shouldExposeHostedEnvironment, true);
  assert.equal(plan.githubApp.readyToCreateGitHubApp, true);
  assert.equal(plan.githubApp.manifest.hook_attributes.url, "https://guard-staging.example.test/github/webhook");
  assert.deepEqual(plan.executionOrder, [
    "bind_provider_adapters",
    "deploy_node_container_roles",
    "configure_github_app_webhook",
    "run_webhook_replay",
    "run_worker_cleanup_probe",
    "verify_check_run_publication",
    "record_release_gate_evidence"
  ]);
  assert.equal(plan.privacy.includesRawSource, false);
  assert.equal(plan.privacy.includesSecrets, false);
  assert.equal(serialized.includes("BEGIN PRIVATE KEY"), false);
  assert.equal(serialized.includes("customer@example.test"), false);
});

test("hosted staging deployment blocks incomplete evidence unsafe refs and unsafe claims", async () => {
  const { planHostedStagingDeployment } = await loadStaging();
  const plan = planHostedStagingDeployment({
    ...baseInput,
    publicBaseUrl: "http://localhost:3000",
    homepageUrl: "https://guard-staging.example.test",
    containerImageDigest: "not-a-digest",
    providerRefs: {
      ...baseInput.providerRefs,
      queue: "memory:jobs",
      metrics: ""
    },
    evidence: completeEvidence.filter((evidence) => evidence.id !== "webhook_replay"),
    releaseNotes: "This release provides a full security audit and certification."
  });

  assert.equal(plan.readyForStagingExposure, false);
  assert.deepEqual(plan.blockedReasons, [
    "node_container:invalid_public_base_url",
    "node_container:invalid_container_image_digest",
    "node_container:invalid_adapter_ref:queue",
    "provider_binding:invalid_provider_ref:queue",
    "provider_binding:missing_provider_ref:metrics",
    "release_gate:missing:webhook_replay",
    "release_gate:claim:certification_claim",
    "release_gate:claim:full_audit_claim",
    "release_gate:missing_container_digest",
    "github_app:release_gate_blocked",
    "github_app:invalid_container_image_digest",
    "github_app:invalid_webhook_url"
  ]);
  assert.equal(plan.nodeContainer.endpoints.webhookUrl, "");
  assert.equal(JSON.stringify(plan).includes("localhost"), false);
});

test("hosted GitHub App promotion requires staging success before production creation", async () => {
  const { planHostedGitHubAppPromotion } = await loadStaging();
  const staging = {
    ...baseInput,
    environment: "production",
    publicBaseUrl: "https://guard.example.test",
    homepageUrl: "https://guard.example.test"
  };
  const readyPlan = planHostedGitHubAppPromotion({
    ...staging,
    stagingDeploymentVerified: true,
    stagingCheckRunPublished: true,
    stagingRollbackVerified: true
  });
  const blockedPlan = planHostedGitHubAppPromotion({
    ...staging,
    stagingDeploymentVerified: false,
    stagingCheckRunPublished: true,
    stagingRollbackVerified: false
  });

  assert.equal(readyPlan.readyForProductionGitHubApp, true);
  assert.deepEqual(readyPlan.blockedReasons, []);
  assert.equal(readyPlan.production.githubApp.readyToCreateGitHubApp, true);
  assert.equal(readyPlan.production.githubApp.manifest.hook_attributes.url, "https://guard.example.test/github/webhook");
  assert.equal(blockedPlan.readyForProductionGitHubApp, false);
  assert.deepEqual(blockedPlan.blockedReasons, [
    "staging_deployment_not_verified",
    "staging_rollback_not_verified",
    "production:github_app:release_gate_blocked"
  ]);
});
