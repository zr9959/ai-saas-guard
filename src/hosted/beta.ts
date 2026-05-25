export interface HostedBetaReadinessGateInput {
  requestedAt: string;
  phase3GatePassed: boolean;
  selectedRepositoryInstallOnly: boolean;
  publicInstallDocsReady: boolean;
  rateLimitEnabled: boolean;
  abuseKillSwitchReady: boolean;
  telemetrySafe: boolean;
  uninstallDeletionTested: boolean;
  rollbackTested: boolean;
  incidentOwnerRecorded: boolean;
  supportPathReady: boolean;
  betaSmokePassed: boolean;
  avoidsAuditClaims: boolean;
  noRawSourceStorage: boolean;
  noRawDiffStorage: boolean;
  noPrTextStorage: boolean;
  maxReposPerInstallation: number;
  maxConcurrentScans: number;
  rawSource?: string;
  rawDiff?: string;
  prText?: string;
  installationToken?: string;
}

export interface HostedBetaReadinessGate {
  phase: "phase_4_hosted_beta_readiness";
  readyForPublicBeta: boolean;
  blockedReasons: string[];
  requestedAt: string;
  installBoundary: {
    selectedRepositoryOnly: true;
    maxReposPerInstallation: number;
    maxConcurrentScans: number;
  };
  operations: {
    rateLimitEnabled: boolean;
    abuseKillSwitchReady: boolean;
    telemetrySafe: boolean;
    uninstallDeletionTested: boolean;
    rollbackTested: boolean;
    incidentOwnerRecorded: boolean;
    supportPathReady: boolean;
    betaSmokePassed: boolean;
  };
  nextAction: string;
  privacy: {
    includesRawSource: false;
    includesRawDiffs: false;
    includesUntrustedPrText: false;
    includesInstallationToken: false;
    claimsPentest: false;
    claimsFullAudit: false;
    claimsCertification: false;
  };
}

export interface TeamLaunchGateReadinessInput {
  requestedAt: string;
  hostedBetaGatePassed: boolean;
  orgPolicyConfigReady: boolean;
  requiredStatusCheckDocumented: boolean;
  suppressionAuditReady: boolean;
  reviewerChecklistReady: boolean;
  releaseEvidenceExportReady: boolean;
  teamDocsReady: boolean;
  adminBypassDocumented: boolean;
  retentionPolicyDocumented: boolean;
  noCommercialBillingEnabled: boolean;
  rawSource?: string;
  customerPayload?: unknown;
}

export interface TeamLaunchGateReadiness {
  phase: "phase_5_team_launch_gate";
  readyForTeamUse: boolean;
  blockedReasons: string[];
  requestedAt: string;
  teamControls: {
    orgPolicyConfigReady: boolean;
    requiredStatusCheckDocumented: boolean;
    suppressionAuditReady: boolean;
    reviewerChecklistReady: boolean;
    releaseEvidenceExportReady: boolean;
    teamDocsReady: boolean;
    adminBypassDocumented: boolean;
    retentionPolicyDocumented: boolean;
  };
  commercialization: {
    enabled: false;
    reason: "pre_commercial_feedback_stage";
  };
  nextAction: string;
  privacy: {
    includesRawSource: false;
    includesCustomerPayloads: false;
  };
}

const MAX_BETA_REPOS_PER_INSTALLATION = 10;
const MAX_BETA_CONCURRENT_SCANS = 5;

export function evaluateHostedBetaReadinessGate(
  input: HostedBetaReadinessGateInput
): HostedBetaReadinessGate {
  const blockedReasons = hostedBetaBlockedReasons(input);

  return {
    phase: "phase_4_hosted_beta_readiness",
    readyForPublicBeta: blockedReasons.length === 0,
    blockedReasons,
    requestedAt: input.requestedAt,
    installBoundary: {
      selectedRepositoryOnly: true,
      maxReposPerInstallation: Math.max(0, Math.floor(input.maxReposPerInstallation)),
      maxConcurrentScans: Math.max(0, Math.floor(input.maxConcurrentScans))
    },
    operations: {
      rateLimitEnabled: input.rateLimitEnabled,
      abuseKillSwitchReady: input.abuseKillSwitchReady,
      telemetrySafe: input.telemetrySafe,
      uninstallDeletionTested: input.uninstallDeletionTested,
      rollbackTested: input.rollbackTested,
      incidentOwnerRecorded: input.incidentOwnerRecorded,
      supportPathReady: input.supportPathReady,
      betaSmokePassed: input.betaSmokePassed
    },
    nextAction:
      blockedReasons.length === 0
        ? "Open a limited public beta only for selected repositories and keep collecting operational evidence before commercialization."
        : "Do not open hosted beta. Resolve the blocked reasons and rerun the beta readiness gate.",
    privacy: {
      includesRawSource: false,
      includesRawDiffs: false,
      includesUntrustedPrText: false,
      includesInstallationToken: false,
      claimsPentest: false,
      claimsFullAudit: false,
      claimsCertification: false
    }
  };
}

export function evaluateTeamLaunchGateReadiness(
  input: TeamLaunchGateReadinessInput
): TeamLaunchGateReadiness {
  const blockedReasons = teamLaunchBlockedReasons(input);

  return {
    phase: "phase_5_team_launch_gate",
    readyForTeamUse: blockedReasons.length === 0,
    blockedReasons,
    requestedAt: input.requestedAt,
    teamControls: {
      orgPolicyConfigReady: input.orgPolicyConfigReady,
      requiredStatusCheckDocumented: input.requiredStatusCheckDocumented,
      suppressionAuditReady: input.suppressionAuditReady,
      reviewerChecklistReady: input.reviewerChecklistReady,
      releaseEvidenceExportReady: input.releaseEvidenceExportReady,
      teamDocsReady: input.teamDocsReady,
      adminBypassDocumented: input.adminBypassDocumented,
      retentionPolicyDocumented: input.retentionPolicyDocumented
    },
    commercialization: {
      enabled: false,
      reason: "pre_commercial_feedback_stage"
    },
    nextAction:
      blockedReasons.length === 0
        ? "Use the team launch gate with design partners, collect user feedback, and delay commercialization until usage evidence exists."
        : "Do not sell or commercialize. Resolve the team launch gate blockers before inviting teams beyond beta.",
    privacy: {
      includesRawSource: false,
      includesCustomerPayloads: false
    }
  };
}

function hostedBetaBlockedReasons(input: HostedBetaReadinessGateInput): string[] {
  const reasons: string[] = [];
  if (!input.phase3GatePassed) reasons.push("phase3_gate_missing");
  if (!input.selectedRepositoryInstallOnly) reasons.push("selected_repository_install_required");
  if (!input.publicInstallDocsReady) reasons.push("public_install_docs_missing");
  if (!input.rateLimitEnabled) reasons.push("rate_limit_missing");
  if (!input.abuseKillSwitchReady) reasons.push("abuse_kill_switch_missing");
  if (!input.telemetrySafe) reasons.push("safe_telemetry_missing");
  if (!input.uninstallDeletionTested) reasons.push("uninstall_deletion_proof_missing");
  if (!input.rollbackTested) reasons.push("rollback_test_missing");
  if (!input.incidentOwnerRecorded) reasons.push("incident_owner_missing");
  if (!input.supportPathReady) reasons.push("support_path_missing");
  if (!input.betaSmokePassed) reasons.push("beta_smoke_missing");
  if (!input.avoidsAuditClaims) reasons.push("audit_claims_not_blocked");
  if (!input.noRawSourceStorage) reasons.push("raw_source_storage_blocked");
  if (!input.noRawDiffStorage) reasons.push("raw_diff_storage_blocked");
  if (!input.noPrTextStorage) reasons.push("pr_text_storage_blocked");
  if (!Number.isFinite(input.maxReposPerInstallation) || input.maxReposPerInstallation > MAX_BETA_REPOS_PER_INSTALLATION) {
    reasons.push("repo_limit_too_high");
  }
  if (!Number.isFinite(input.maxConcurrentScans) || input.maxConcurrentScans > MAX_BETA_CONCURRENT_SCANS) {
    reasons.push("concurrency_limit_too_high");
  }
  return reasons;
}

function teamLaunchBlockedReasons(input: TeamLaunchGateReadinessInput): string[] {
  const reasons: string[] = [];
  if (!input.hostedBetaGatePassed) reasons.push("hosted_beta_gate_missing");
  if (!input.orgPolicyConfigReady) reasons.push("org_policy_config_missing");
  if (!input.requiredStatusCheckDocumented) reasons.push("required_status_check_docs_missing");
  if (!input.suppressionAuditReady) reasons.push("suppression_audit_missing");
  if (!input.reviewerChecklistReady) reasons.push("reviewer_checklist_missing");
  if (!input.releaseEvidenceExportReady) reasons.push("release_evidence_export_missing");
  if (!input.teamDocsReady) reasons.push("team_docs_missing");
  if (!input.adminBypassDocumented) reasons.push("admin_bypass_docs_missing");
  if (!input.retentionPolicyDocumented) reasons.push("retention_policy_docs_missing");
  if (!input.noCommercialBillingEnabled) reasons.push("commercial_billing_enabled_too_early");
  return reasons;
}
