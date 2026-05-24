import assert from "node:assert/strict";
import { test } from "node:test";

const requiredFailureReasons = [
  "git_fetch_head_failed",
  "cli_scan_failed",
  "invalid_cli_output",
  "check_run_publication_failed",
  "timeout",
  "cancellation"
];

async function loadDeployedStaging() {
  const deployed = await import("../dist/hosted/deployed-staging.js");
  assert.equal(typeof deployed.createHostedDeployedWorkerStagingEvidenceBundle, "function");
  assert.equal(typeof deployed.evaluateHostedDeployedWorkerStagingReleaseGate, "function");
  return deployed;
}

function safeHealthProbe(overrides = {}) {
  return {
    observedAt: "2026-05-24T21:00:00.000Z",
    status: 200,
    body: {
      ok: true,
      platform: "node_container",
      roles: ["webhook-ingress", "scan-worker"],
      scannerVersion: "0.32.0",
      checkRunPublisher: "configured",
      privacy: safePrivacy()
    },
    ...overrides
  };
}

function safePrivacy() {
  return {
    includesRawWebhookPayload: false,
    includesUntrustedPrText: false,
    includesRawSource: false,
    includesRawDiffs: false,
    includesSecrets: false,
    includesCustomerPayloads: false,
    includesPrivateCheckoutPath: false,
    includesInstallationToken: false
  };
}

function acceptedReplay() {
  return {
    accepted: true,
    stage: "queue",
    deliveryId: "delivery-deployed-success",
    queuedWorker: true,
    shouldCreateCheckRun: true,
    shouldCreatePrComment: false,
    privacy: {
      ...safePrivacy(),
      claimsLiveHostedService: false
    }
  };
}

function completedWorker() {
  return {
    processed: true,
    status: "completed",
    checkRunPublished: true,
    compactReportStored: true,
    workerSandboxDeleted: true,
    activeWorkerSandboxCount: 0,
    cleanupVerified: true,
    privacy: {
      ...safePrivacy(),
      claimsLiveHostedService: false
    }
  };
}

function failedWorker(reason) {
  return {
    processed: true,
    status: "failed",
    errorClass: reason === "check_run_publication_failed" ? "check_run_publication_rejected" : "scan_runner_failed",
    reason,
    safeFailureReason: reason,
    workerSandboxDeleted: true,
    activeWorkerSandboxCount: 0,
    cleanupVerified: true,
    privacy: {
      ...safePrivacy(),
      claimsLiveHostedService: false
    }
  };
}

function externalEvidence() {
  return [
    "clean_ci",
    "hosted_contract_tests",
    "workflow_static_checks",
    "dependency_scan",
    "container_scan",
    "monitoring_alerting",
    "manual_rollback",
    "incident_response"
  ].map((id) => ({
    id,
    status: "passed",
    collectedAt: "2026-05-24T21:01:00.000Z",
    evidenceUrl: `https://github.com/zr9959/ai-saas-guard/actions/runs/deployed-${id}`,
    owner: "release"
  }));
}

test("hosted deployed worker staging evidence accepts deployed health webhook worker cleanup and log samples", async () => {
  const {
    createHostedDeployedWorkerStagingEvidenceBundle,
    evaluateHostedDeployedWorkerStagingReleaseGate
  } = await loadDeployedStaging();
  const bundle = createHostedDeployedWorkerStagingEvidenceBundle({
    collectedAt: "2026-05-24T21:05:00.000Z",
    evidenceBaseUrl: "https://github.com/zr9959/ai-saas-guard/actions/runs/26359000000",
    owner: "hosted-staging",
    publicBaseUrl: "https://guard-staging.example.test/",
    scannerVersion: "0.32.0",
    healthProbe: safeHealthProbe(),
    webhookReplays: [acceptedReplay()],
    workerTicks: [completedWorker(), ...requiredFailureReasons.map(failedWorker)],
    logBoundary: {
      accepted: true,
      sampleCount: 2,
      blockedReasons: [],
      allowedFields: [
        "scanKey",
        "installationId",
        "repositoryId",
        "pullRequestNumber",
        "headSha",
        "scannerVersion",
        "durationMs",
        "summaryCounts",
        "errorClass",
        "cleanupStatus"
      ],
      privacy: {
        ...safePrivacy(),
        claimsLiveHostedService: false
      }
    },
    externalEvidence: externalEvidence(),
    requiredFailureReasons
  });
  const gate = evaluateHostedDeployedWorkerStagingReleaseGate({
    bundle,
    commitSha: "b23030be462e48f070fcfd40471033fc6ec5eca9",
    scannerVersion: "0.32.0",
    deploymentTarget: "staging",
    evaluatedAt: "2026-05-24T21:06:00.000Z",
    releaseNotes:
      "Deployed worker staging evidence for review-first checks. This is not a pentest, certification, or full security audit.",
    containerImageDigest: "sha256:bbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbbb"
  });
  const byId = new Map(bundle.evidence.map((item) => [item.id, item]));
  const serialized = JSON.stringify(bundle);

  assert.equal(bundle.readyForReleaseGate, true);
  assert.equal(bundle.deployedScenarioSummary.publicIngressAccepted, true);
  assert.equal(bundle.deployedScenarioSummary.healthAccepted, true);
  assert.equal(bundle.deployedScenarioSummary.checkRunPublished, true);
  assert.deepEqual(bundle.deployedScenarioSummary.observedFailureReasons, [...requiredFailureReasons].sort());
  assert.equal(byId.get("webhook_replay").status, "passed");
  assert.match(byId.get("webhook_replay").note, /deployed staging ingress/i);
  assert.equal(byId.get("queue_worker_cleanup").status, "passed");
  assert.equal(byId.get("privacy_retention").status, "passed");
  assert.equal(byId.get("release_cleanup").status, "passed");
  assert.equal(gate.blocked, false);
  assert.equal(gate.shouldExposeHostedEnvironment, true);
  assert.equal(serialized.includes("localhost"), false);
  assert.equal(serialized.includes("rawSource"), false);
  assert.equal(serialized.includes("ghs_"), false);
  assert.equal(serialized.includes("command=rm -rf"), false);
});

test("hosted deployed worker staging evidence blocks private ingress unsafe health and missing cleanup", async () => {
  const { createHostedDeployedWorkerStagingEvidenceBundle } = await loadDeployedStaging();
  const bundle = createHostedDeployedWorkerStagingEvidenceBundle({
    collectedAt: "2026-05-24T21:10:00.000Z",
    evidenceBaseUrl: "file:///tmp/ai-saas-guard-deployed-evidence",
    owner: "hosted-staging",
    publicBaseUrl: "http://localhost:3000",
    scannerVersion: "0.32.0",
    healthProbe: safeHealthProbe({
      status: 200,
      body: {
        ok: true,
        platform: "node_container",
        roles: ["webhook-ingress"],
        scannerVersion: "0.31.0",
        privacy: {
          ...safePrivacy(),
          includesSecrets: true
        }
      }
    }),
    webhookReplays: [acceptedReplay()],
    workerTicks: [
      {
        ...completedWorker(),
        workerSandboxDeleted: false,
        activeWorkerSandboxCount: 1,
        cleanupVerified: false
      }
    ],
    logBoundary: {
      accepted: false,
      sampleCount: 1,
      blockedReasons: ["secret_value"],
      allowedFields: [],
      privacy: {
        ...safePrivacy(),
        claimsLiveHostedService: false
      }
    },
    externalEvidence: []
  });
  const byId = new Map(bundle.evidence.map((item) => [item.id, item]));
  const serialized = JSON.stringify(bundle);

  assert.equal(bundle.readyForReleaseGate, false);
  assert.deepEqual(bundle.blockedReasons, [
    "invalid_public_base_url",
    "unsafe_evidence_base_url",
    "health_scanner_version_mismatch",
    "health_missing_scan_worker_role",
    "health_privacy_flags_unsafe",
    "worker_failure_cleanup_probe_missing",
    "worker_cleanup_not_verified",
    "log_boundary_rejected"
  ]);
  assert.equal(bundle.deployedScenarioSummary.publicIngressAccepted, false);
  assert.equal(bundle.deployedScenarioSummary.healthAccepted, false);
  assert.equal(bundle.deployedScenarioSummary.allWorkerCheckoutsDeleted, false);
  assert.equal(byId.get("webhook_replay").status, "missing");
  assert.equal(byId.get("queue_worker_cleanup").status, "missing");
  assert.equal(byId.get("privacy_retention").status, "missing");
  assert.equal(serialized.includes("localhost"), false);
});

test("hosted deployed worker staging evidence rejects credentialed or parameterized URLs", async () => {
  const { createHostedDeployedWorkerStagingEvidenceBundle } = await loadDeployedStaging();
  const bundle = createHostedDeployedWorkerStagingEvidenceBundle({
    collectedAt: "2026-05-24T21:20:00.000Z",
    evidenceBaseUrl: "https://github.com/zr9959/ai-saas-guard/actions/runs/26359000000?token=do-not-log",
    owner: "hosted-staging",
    publicBaseUrl: "https://user:password@guard-staging.example.test",
    scannerVersion: "0.32.0",
    healthProbe: safeHealthProbe(),
    webhookReplays: [acceptedReplay()],
    workerTicks: [completedWorker(), ...requiredFailureReasons.map(failedWorker)],
    logBoundary: {
      accepted: true,
      sampleCount: 1,
      blockedReasons: [],
      allowedFields: ["scanKey"],
      privacy: {
        ...safePrivacy(),
        claimsLiveHostedService: false
      }
    },
    externalEvidence: externalEvidence(),
    requiredFailureReasons
  });
  const serialized = JSON.stringify(bundle);

  assert.equal(bundle.readyForReleaseGate, false);
  assert.deepEqual(bundle.blockedReasons, ["invalid_public_base_url", "unsafe_evidence_base_url"]);
  assert.equal(serialized.includes("password"), false);
  assert.equal(serialized.includes("do-not-log"), false);
});
