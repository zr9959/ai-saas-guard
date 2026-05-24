import {
  evaluateHostedOperationalReleaseGate,
  HOSTED_OPERATIONAL_RELEASE_GATE_REQUIREMENTS,
  type HostedOperationalReleaseGateDecision,
  type HostedOperationalReleaseGateEvidence,
  type HostedOperationalReleaseGateRequirementId
} from "./contracts.js";
import { HOSTED_NODE_CONTAINER_PLATFORM, HOSTED_NODE_CONTAINER_ROLES } from "./app.js";
import type {
  HostedLogBoundaryValidation,
  HostedStagingHarnessReplayResult,
  HostedStagingHarnessWorkerTickResult
} from "./staging-harness.js";

export interface HostedDeployedWorkerHealthProbe {
  observedAt: string;
  status: number;
  body: unknown;
}

export interface HostedDeployedWorkerStagingEvidenceBundleInput {
  collectedAt: string;
  evidenceBaseUrl: string;
  owner: string;
  publicBaseUrl: string;
  scannerVersion: string;
  healthProbe: HostedDeployedWorkerHealthProbe;
  webhookReplays: HostedStagingHarnessReplayResult[];
  workerTicks: HostedStagingHarnessWorkerTickResult[];
  logBoundary: HostedLogBoundaryValidation;
  externalEvidence: HostedOperationalReleaseGateEvidence[];
  requiredFailureReasons?: string[];
}

export interface HostedDeployedWorkerStagingEvidenceBundle {
  readyForReleaseGate: boolean;
  blockedReasons: string[];
  evidence: HostedOperationalReleaseGateEvidence[];
  releaseGateInput: {
    evidence: HostedOperationalReleaseGateEvidence[];
  };
  deployedScenarioSummary: HostedDeployedWorkerStagingScenarioSummary;
  privacy: HostedDeployedWorkerStagingPrivacy;
}

export interface HostedDeployedWorkerStagingScenarioSummary {
  publicIngressAccepted: boolean;
  healthAccepted: boolean;
  webhookReplayAccepted: boolean;
  completedWorkerProbe: boolean;
  failureCleanupProbe: boolean;
  observedFailureReasons: string[];
  allWorkerCheckoutsDeleted: boolean;
  checkRunPublished: boolean;
  logBoundaryAccepted: boolean;
}

export interface HostedDeployedWorkerStagingReleaseGateInput {
  bundle: HostedDeployedWorkerStagingEvidenceBundle;
  commitSha: string;
  scannerVersion: string;
  deploymentTarget: string;
  evaluatedAt: string;
  releaseNotes: string;
  containerImageDigest: string;
  maxEvidenceAgeDays?: number;
}

export interface HostedDeployedWorkerStagingPrivacy {
  includesRawHealthResponse: false;
  includesPublicBaseUrl: false;
  includesRawWebhookPayload: false;
  includesUntrustedPrText: false;
  includesRawSource: false;
  includesRawDiffs: false;
  includesSecrets: false;
  includesCustomerPayloads: false;
  includesPrivateCheckoutPath: false;
  includesInstallationToken: false;
  claimsProductionHostedService: false;
}

export function createHostedDeployedWorkerStagingEvidenceBundle(
  input: HostedDeployedWorkerStagingEvidenceBundleInput
): HostedDeployedWorkerStagingEvidenceBundle {
  const summary = deployedScenarioSummary(input);
  const blockedReasons = deployedBlockedReasons(input, summary);
  const externalEvidence = new Map(
    input.externalEvidence.map((evidence) => [evidence.id, sanitizeEvidence(evidence, input)])
  );
  const evidence = HOSTED_OPERATIONAL_RELEASE_GATE_REQUIREMENTS.map((requirement) => {
    const generated = generatedEvidenceFor(requirement.id, input, summary, blockedReasons);
    return generated ?? externalEvidence.get(requirement.id) ?? missingEvidence(requirement.id, input);
  });
  const readyForReleaseGate =
    blockedReasons.length === 0 && evidence.every((item) => item.status === "passed");

  return {
    readyForReleaseGate,
    blockedReasons,
    evidence,
    releaseGateInput: { evidence },
    deployedScenarioSummary: summary,
    privacy: deployedPrivacy()
  };
}

export function evaluateHostedDeployedWorkerStagingReleaseGate(
  input: HostedDeployedWorkerStagingReleaseGateInput
): HostedOperationalReleaseGateDecision {
  return evaluateHostedOperationalReleaseGate({
    commitSha: input.commitSha,
    scannerVersion: input.scannerVersion,
    deploymentTarget: input.deploymentTarget,
    evaluatedAt: input.evaluatedAt,
    evidence: input.bundle.evidence,
    releaseNotes: input.releaseNotes,
    containerImageDigest: input.containerImageDigest,
    maxEvidenceAgeDays: input.maxEvidenceAgeDays
  });
}

function deployedScenarioSummary(
  input: HostedDeployedWorkerStagingEvidenceBundleInput
): HostedDeployedWorkerStagingScenarioSummary {
  const processedWorkers = input.workerTicks.filter((tick) => tick.processed);
  const completedWorkers = processedWorkers.filter((tick) => tick.status === "completed");
  const observedFailureReasons = [
    ...new Set(
      processedWorkers.flatMap((tick) =>
        tick.status === "failed" && tick.cleanupVerified && tick.safeFailureReason
          ? [tick.safeFailureReason]
          : []
      )
    )
  ].sort();
  const requiredFailureReasons = input.requiredFailureReasons ?? [];
  const failureCleanupProbe = requiredFailureReasons.length
    ? requiredFailureReasons.every((reason) => observedFailureReasons.includes(reason))
    : processedWorkers.some((tick) => tick.status === "failed" && tick.cleanupVerified);
  const allWorkerCheckoutsDeleted =
    processedWorkers.length > 0 &&
    processedWorkers.every(
      (tick) =>
        tick.workerSandboxDeleted &&
        tick.activeWorkerSandboxCount === 0 &&
        tick.cleanupVerified
    );

  return {
    publicIngressAccepted: isSafePublicHttpsUrl(input.publicBaseUrl),
    healthAccepted: healthProbeAccepted(input),
    webhookReplayAccepted: input.webhookReplays.some(
      (replay) => replay.accepted && replay.queuedWorker && replay.shouldCreateCheckRun
    ),
    completedWorkerProbe: completedWorkers.some(
      (tick) => tick.checkRunPublished && tick.compactReportStored
    ),
    failureCleanupProbe,
    observedFailureReasons,
    allWorkerCheckoutsDeleted,
    checkRunPublished: completedWorkers.some((tick) => tick.checkRunPublished),
    logBoundaryAccepted: input.logBoundary.sampleCount > 0 && input.logBoundary.accepted
  };
}

function deployedBlockedReasons(
  input: HostedDeployedWorkerStagingEvidenceBundleInput,
  summary: HostedDeployedWorkerStagingScenarioSummary
): string[] {
  const reasons: string[] = [];
  const health = healthBody(input.healthProbe.body);

  if (!summary.publicIngressAccepted) reasons.push("invalid_public_base_url");
  if (!isSafePublicHttpsUrl(input.evidenceBaseUrl)) reasons.push("unsafe_evidence_base_url");
  if (input.healthProbe.status !== 200) reasons.push("health_status_unhealthy");
  if (health.ok !== true) reasons.push("health_not_ok");
  if (health.platform !== HOSTED_NODE_CONTAINER_PLATFORM) reasons.push("health_platform_mismatch");
  if (health.scannerVersion !== input.scannerVersion) {
    reasons.push("health_scanner_version_mismatch");
  }
  if (!health.roles.includes("webhook-ingress")) reasons.push("health_missing_webhook_role");
  if (!health.roles.includes("scan-worker")) reasons.push("health_missing_scan_worker_role");
  if (!privacyFlagsAreSafe(health.privacy)) reasons.push("health_privacy_flags_unsafe");
  if (!summary.webhookReplayAccepted) reasons.push("webhook_replay_missing");
  if (!summary.completedWorkerProbe) reasons.push("worker_success_probe_missing");
  if (!summary.failureCleanupProbe) reasons.push("worker_failure_cleanup_probe_missing");
  if (!summary.allWorkerCheckoutsDeleted) reasons.push("worker_cleanup_not_verified");
  if (!summary.checkRunPublished) reasons.push("check_run_not_published");
  if (!summary.logBoundaryAccepted) reasons.push("log_boundary_rejected");

  return reasons;
}

function generatedEvidenceFor(
  id: HostedOperationalReleaseGateRequirementId,
  input: HostedDeployedWorkerStagingEvidenceBundleInput,
  summary: HostedDeployedWorkerStagingScenarioSummary,
  blockedReasons: string[]
): HostedOperationalReleaseGateEvidence | undefined {
  if (blockedReasons.length > 0) {
    return undefined;
  }

  if (id === "webhook_replay") {
    return summary.publicIngressAccepted && summary.healthAccepted && summary.webhookReplayAccepted
      ? passedEvidence(id, "Deployed staging ingress accepted a signed webhook and queued check-run-only work.", input)
      : missingEvidence(id, input);
  }

  if (id === "queue_worker_cleanup") {
    return summary.completedWorkerProbe &&
      summary.failureCleanupProbe &&
      summary.allWorkerCheckoutsDeleted
      ? passedEvidence(
          id,
          "Deployed staging worker success and failure probes published compact checks and deleted worker checkouts.",
          input
        )
      : missingEvidence(id, input);
  }

  if (id === "privacy_retention") {
    return summary.logBoundaryAccepted && privacyFlagsAreSafe(input.logBoundary.privacy)
      ? passedEvidence(
          id,
          "Deployed staging log samples stayed within the safe metadata boundary and avoided raw payloads.",
          input
        )
      : missingEvidence(id, input);
  }

  if (id === "release_cleanup") {
    return summary.allWorkerCheckoutsDeleted
      ? passedEvidence(id, "Deployed staging release cleanup left no active worker checkout entries.", input)
      : missingEvidence(id, input);
  }

  return undefined;
}

function healthProbeAccepted(input: HostedDeployedWorkerStagingEvidenceBundleInput): boolean {
  const health = healthBody(input.healthProbe.body);
  return (
    input.healthProbe.status === 200 &&
    health.ok === true &&
    health.platform === HOSTED_NODE_CONTAINER_PLATFORM &&
    HOSTED_NODE_CONTAINER_ROLES.every((role) => health.roles.includes(role)) &&
    health.scannerVersion === input.scannerVersion &&
    privacyFlagsAreSafe(health.privacy)
  );
}

function sanitizeEvidence(
  evidence: HostedOperationalReleaseGateEvidence,
  input: HostedDeployedWorkerStagingEvidenceBundleInput
): HostedOperationalReleaseGateEvidence {
  return {
    id: evidence.id,
    status: evidence.status,
    ...(evidence.collectedAt === undefined
      ? { collectedAt: input.collectedAt }
      : { collectedAt: evidence.collectedAt }),
    ...(safeEvidenceUrl(evidence.evidenceUrl) === undefined
      ? {}
      : { evidenceUrl: safeEvidenceUrl(evidence.evidenceUrl) }),
    note: `External deployed-staging release-gate evidence recorded for ${evidence.id}.`,
    ...(evidence.owner === undefined ? { owner: input.owner } : { owner: evidence.owner })
  };
}

function passedEvidence(
  id: HostedOperationalReleaseGateRequirementId,
  note: string,
  input: HostedDeployedWorkerStagingEvidenceBundleInput
): HostedOperationalReleaseGateEvidence {
  return {
    id,
    status: "passed",
    collectedAt: input.collectedAt,
    ...(evidenceUrlFor(input, id) === undefined ? {} : { evidenceUrl: evidenceUrlFor(input, id) }),
    note,
    owner: input.owner
  };
}

function missingEvidence(
  id: HostedOperationalReleaseGateRequirementId,
  input: HostedDeployedWorkerStagingEvidenceBundleInput
): HostedOperationalReleaseGateEvidence {
  return {
    id,
    status: "missing",
    collectedAt: input.collectedAt,
    note: `Missing deployed staging worker evidence for ${id}.`,
    owner: input.owner
  };
}

function evidenceUrlFor(
  input: Pick<HostedDeployedWorkerStagingEvidenceBundleInput, "evidenceBaseUrl">,
  id: HostedOperationalReleaseGateRequirementId
): string | undefined {
  const baseUrl = safeEvidenceUrl(input.evidenceBaseUrl);
  return baseUrl === undefined ? undefined : `${baseUrl}/${id}.json`;
}

function safeEvidenceUrl(value: string | undefined): string | undefined {
  if (!value || !isSafePublicHttpsUrl(value)) {
    return undefined;
  }
  return trimTrailingSlashes(value.trim());
}

function healthBody(value: unknown): {
  ok: boolean | undefined;
  platform: string | undefined;
  roles: string[];
  scannerVersion: string | undefined;
  privacy: Record<string, unknown> | undefined;
} {
  if (!isRecord(value)) {
    return {
      ok: undefined,
      platform: undefined,
      roles: [],
      scannerVersion: undefined,
      privacy: undefined
    };
  }
  const roles = Array.isArray(value.roles)
    ? value.roles.filter((role): role is string => typeof role === "string")
    : [];

  return {
    ok: typeof value.ok === "boolean" ? value.ok : undefined,
    platform: typeof value.platform === "string" ? value.platform : undefined,
    roles,
    scannerVersion: typeof value.scannerVersion === "string" ? value.scannerVersion : undefined,
    privacy: isRecord(value.privacy) ? value.privacy : undefined
  };
}

function privacyFlagsAreSafe(value: unknown): boolean {
  return isRecord(value) && Object.values(value).every((flag) => flag === false);
}

function isSafePublicHttpsUrl(value: string): boolean {
  try {
    const url = new URL(value.trim());
    return (
      url.protocol === "https:" &&
      !url.username &&
      !url.password &&
      !url.search &&
      !url.hash &&
      !isUnsafeHostedHostname(url.hostname)
    );
  } catch {
    return false;
  }
}

function isUnsafeHostedHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase().replace(/\.$/, "");
  return (
    normalized === "localhost" ||
    normalized.endsWith(".localhost") ||
    isUnsafeIpv4Hostname(normalized) ||
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe80:")
  );
}

function isUnsafeIpv4Hostname(hostname: string): boolean {
  const parts = hostname.split(".");
  if (parts.length !== 4 || !parts.every((part) => /^\d+$/.test(part))) return false;
  const octets = parts.map((part) => Number(part));
  if (octets.some((octet) => !Number.isInteger(octet) || octet < 0 || octet > 255)) {
    return false;
  }
  const [first, second] = octets;
  return (
    first === 0 ||
    first === 10 ||
    first === 127 ||
    (first === 169 && second === 254) ||
    (first === 172 && second >= 16 && second <= 31) ||
    (first === 192 && second === 168) ||
    (first === 100 && second >= 64 && second <= 127) ||
    first >= 224
  );
}

function trimTrailingSlashes(value: string): string {
  let end = value.length;
  while (end > 0 && value[end - 1] === "/") {
    end -= 1;
  }
  return value.slice(0, end);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function deployedPrivacy(): HostedDeployedWorkerStagingPrivacy {
  return {
    includesRawHealthResponse: false,
    includesPublicBaseUrl: false,
    includesRawWebhookPayload: false,
    includesUntrustedPrText: false,
    includesRawSource: false,
    includesRawDiffs: false,
    includesSecrets: false,
    includesCustomerPayloads: false,
    includesPrivateCheckoutPath: false,
    includesInstallationToken: false,
    claimsProductionHostedService: false
  };
}
