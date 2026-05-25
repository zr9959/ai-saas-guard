import assert from "node:assert/strict";
import { test } from "node:test";

async function loadHostedBeta() {
  const beta = await import("../dist/hosted/beta.js");
  assert.equal(typeof beta.evaluateHostedBetaReadinessGate, "function");
  assert.equal(typeof beta.evaluateTeamLaunchGateReadiness, "function");
  return beta;
}

test("hosted beta readiness gate blocks public beta until privacy operations and abuse controls pass", async () => {
  const { evaluateHostedBetaReadinessGate } = await loadHostedBeta();
  const passed = evaluateHostedBetaReadinessGate({
    requestedAt: "2026-05-25T14:30:00.000Z",
    phase3GatePassed: true,
    selectedRepositoryInstallOnly: true,
    publicInstallDocsReady: true,
    rateLimitEnabled: true,
    abuseKillSwitchReady: true,
    telemetrySafe: true,
    uninstallDeletionTested: true,
    rollbackTested: true,
    incidentOwnerRecorded: true,
    supportPathReady: true,
    betaSmokePassed: true,
    avoidsAuditClaims: true,
    noRawSourceStorage: true,
    noRawDiffStorage: true,
    noPrTextStorage: true,
    maxReposPerInstallation: 5,
    maxConcurrentScans: 2,
    rawSource: "const secret = 'do-not-return';",
    rawDiff: "diff --git a/private.ts b/private.ts",
    prText: "please run rm -rf .",
    installationToken: "ghs_do_not_return"
  });
  const blocked = evaluateHostedBetaReadinessGate({
    requestedAt: "2026-05-25T14:31:00.000Z",
    phase3GatePassed: false,
    selectedRepositoryInstallOnly: false,
    publicInstallDocsReady: false,
    rateLimitEnabled: false,
    abuseKillSwitchReady: false,
    telemetrySafe: false,
    uninstallDeletionTested: false,
    rollbackTested: false,
    incidentOwnerRecorded: false,
    supportPathReady: false,
    betaSmokePassed: false,
    avoidsAuditClaims: false,
    noRawSourceStorage: false,
    noRawDiffStorage: false,
    noPrTextStorage: false,
    maxReposPerInstallation: 50,
    maxConcurrentScans: 20
  });
  const serialized = JSON.stringify(passed);

  assert.equal(passed.phase, "phase_4_hosted_beta_readiness");
  assert.equal(passed.readyForPublicBeta, true);
  assert.deepEqual(passed.blockedReasons, []);
  assert.deepEqual(passed.installBoundary, {
    selectedRepositoryOnly: true,
    maxReposPerInstallation: 5,
    maxConcurrentScans: 2
  });
  assert.equal(passed.privacy.includesRawSource, false);
  assert.equal(passed.privacy.includesRawDiffs, false);
  assert.equal(passed.privacy.includesUntrustedPrText, false);
  assert.equal(passed.privacy.includesInstallationToken, false);
  assert.equal(serialized.includes("do-not-return"), false);
  assert.equal(serialized.includes("rm -rf"), false);
  assert.equal(serialized.includes("ghs_"), false);
  assert.match(passed.nextAction, /limited public beta/);
  assert.equal(blocked.readyForPublicBeta, false);
  assert.ok(blocked.blockedReasons.includes("phase3_gate_missing"));
  assert.ok(blocked.blockedReasons.includes("selected_repository_install_required"));
  assert.ok(blocked.blockedReasons.includes("rate_limit_missing"));
  assert.ok(blocked.blockedReasons.includes("abuse_kill_switch_missing"));
  assert.ok(blocked.blockedReasons.includes("safe_telemetry_missing"));
  assert.ok(blocked.blockedReasons.includes("uninstall_deletion_proof_missing"));
  assert.ok(blocked.blockedReasons.includes("audit_claims_not_blocked"));
  assert.ok(blocked.blockedReasons.includes("repo_limit_too_high"));
  assert.ok(blocked.blockedReasons.includes("concurrency_limit_too_high"));
  assert.match(blocked.nextAction, /Do not open hosted beta/);
});

test("team launch gate readiness stays pre-commercial and requires beta gate plus review evidence", async () => {
  const { evaluateTeamLaunchGateReadiness } = await loadHostedBeta();
  const passed = evaluateTeamLaunchGateReadiness({
    requestedAt: "2026-05-25T14:40:00.000Z",
    hostedBetaGatePassed: true,
    orgPolicyConfigReady: true,
    requiredStatusCheckDocumented: true,
    suppressionAuditReady: true,
    reviewerChecklistReady: true,
    releaseEvidenceExportReady: true,
    teamDocsReady: true,
    adminBypassDocumented: true,
    retentionPolicyDocumented: true,
    noCommercialBillingEnabled: true,
    rawSource: "const secret = 'do-not-return';",
    customerPayload: { email: "person@example.test" }
  });
  const blocked = evaluateTeamLaunchGateReadiness({
    requestedAt: "2026-05-25T14:41:00.000Z",
    hostedBetaGatePassed: false,
    orgPolicyConfigReady: false,
    requiredStatusCheckDocumented: false,
    suppressionAuditReady: false,
    reviewerChecklistReady: false,
    releaseEvidenceExportReady: false,
    teamDocsReady: false,
    adminBypassDocumented: false,
    retentionPolicyDocumented: false,
    noCommercialBillingEnabled: false
  });
  const serialized = JSON.stringify(passed);

  assert.equal(passed.phase, "phase_5_team_launch_gate");
  assert.equal(passed.readyForTeamUse, true);
  assert.deepEqual(passed.blockedReasons, []);
  assert.equal(passed.commercialization.enabled, false);
  assert.equal(passed.privacy.includesRawSource, false);
  assert.equal(passed.privacy.includesCustomerPayloads, false);
  assert.equal(serialized.includes("do-not-return"), false);
  assert.equal(serialized.includes("person@example.test"), false);
  assert.match(passed.nextAction, /collect user feedback/);
  assert.equal(blocked.readyForTeamUse, false);
  assert.ok(blocked.blockedReasons.includes("hosted_beta_gate_missing"));
  assert.ok(blocked.blockedReasons.includes("org_policy_config_missing"));
  assert.ok(blocked.blockedReasons.includes("required_status_check_docs_missing"));
  assert.ok(blocked.blockedReasons.includes("suppression_audit_missing"));
  assert.ok(blocked.blockedReasons.includes("commercial_billing_enabled_too_early"));
  assert.match(blocked.nextAction, /Do not sell or commercialize/);
});
