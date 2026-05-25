import { createHmac, timingSafeEqual } from "node:crypto";

export type WebhookRejectReason =
  | "missing_signature"
  | "malformed_signature"
  | "invalid_signature"
  | "replayed_delivery_id";

export interface GitHubWebhookDecision {
  accepted: boolean;
  reason?: WebhookRejectReason;
  shouldQueueScanJob: boolean;
  shouldFetchRepository: boolean;
  deliveryId?: string;
}

export interface GitHubWebhookInput {
  payload: string | Buffer;
  signatureHeader?: string;
  signingKey: string | Buffer;
  deliveryId?: string;
  seenDeliveryIds?: Set<string>;
}

export interface HostedScanIdentityInput {
  installationId: number;
  repositoryId: number;
  repositoryFullName: string;
  pullRequestNumber: number;
  baseSha: string;
  headSha: string;
  scannerVersion: string;
  untrustedPrText?: string;
}

export interface HostedScanIdentity {
  installationId: number;
  repositoryId: number;
  repositoryFullName: string;
  pullRequestNumber: number;
  baseSha: string;
  headSha: string;
  scannerVersion: string;
}

export type PullRequestEventRejectReason =
  | "unsupported_action"
  | "draft_pull_request"
  | "missing_required_field";

export interface HostedPullRequestEventInput {
  payload: unknown;
  scannerVersion: string;
  allowDraft?: boolean;
  supportedActions?: string[];
}

export interface HostedPullRequestEventDecision {
  accepted: boolean;
  shouldQueueScanJob: boolean;
  reason?: PullRequestEventRejectReason;
  action?: string;
  identity?: HostedScanIdentity;
}

export type HostedPullRequestWebhookIntakeStage =
  | "signature"
  | "payload"
  | "event"
  | "installation_scope"
  | "queue";

export type HostedPullRequestWebhookIntakeRejectReason =
  | WebhookRejectReason
  | PullRequestEventRejectReason
  | InstallationScopeRejectReason
  | "invalid_json"
  | "missing_delivery_id";

export interface HostedPullRequestWebhookIntakeInput {
  payload: string | Buffer;
  signatureHeader?: string;
  signingKey: string | Buffer;
  deliveryId?: string;
  seenDeliveryIds?: Set<string>;
  scannerVersion: string;
  selectedRepositoryIds: number[];
  removedRepositoryIds?: number[];
  queue: Map<string, HostedScanJobState>;
  allowDraft?: boolean;
  supportedActions?: string[];
  manualRerun?: boolean;
}

export interface HostedPullRequestWebhookIntakeDecision {
  accepted: boolean;
  stage: HostedPullRequestWebhookIntakeStage;
  reason?: HostedPullRequestWebhookIntakeRejectReason;
  action?: string;
  deliveryId?: string;
  identity?: HostedScanIdentity;
  job?: HostedScanJobDecision;
  shouldQueueScanJob: boolean;
  shouldFetchRepository: boolean;
  shouldCreateCheckRun: boolean;
  shouldCreatePrComment: false;
  privacy: {
    includesRawWebhookPayload: false;
    includesUntrustedPrText: false;
    includesRawSource: false;
    includesRawDiffs: false;
    includesSecrets: false;
    includesCustomerPayloads: false;
  };
}

export type InstallationScopeRejectReason =
  | "installation_mismatch"
  | "repository_not_installed"
  | "repository_removed_from_installation";

export interface InstallationScopeInput {
  identity: HostedScanIdentity;
  installationId: number;
  selectedRepositoryIds: number[];
  removedRepositoryIds?: number[];
}

export interface InstallationScopeDecision {
  authorized: boolean;
  shouldFetchSource: boolean;
  reason?: InstallationScopeRejectReason;
}

export interface HostedScanJobState {
  key: string;
  attempt: number;
  deliveryIds: string[];
}

export interface HostedScanJobInput {
  identity: HostedScanIdentity;
  deliveryId: string;
  manualRerun?: boolean;
}

export interface HostedScanJobDecision {
  key: string;
  created: boolean;
  reusedExistingReport: boolean;
  attempt: number;
  shouldCreateCheckRun: boolean;
  shouldCreatePrComment: boolean;
}

export type HostedQueueJobStatus = "queued" | "running" | "completed" | "failed" | "cancelled";

export interface HostedScanQueueRecord {
  key: string;
  identity: HostedScanIdentity;
  status: HostedQueueJobStatus;
  attempt: number;
  deliveryIds: string[];
  createdAt: string;
  updatedAt: string;
  reportId?: string;
}

export interface HostedScanQueuePayload {
  key: string;
  identity: HostedScanIdentity;
  deliveryId: string;
  attempt: number;
  requestedAt: string;
  source: "github_pull_request";
}

export interface HostedScanQueueUpsertInput {
  identity: HostedScanIdentity;
  deliveryId: string;
  requestedAt: string;
  queue: Map<string, HostedScanQueueRecord>;
  manualRerun?: boolean;
  rawSource?: string;
  rawDiff?: string;
  secretValues?: string[];
  untrustedPrText?: string;
  customerPayload?: unknown;
}

export interface HostedScanQueueUpsertDecision {
  key: string;
  idempotent: true;
  created: boolean;
  reusedExistingJob: boolean;
  existingStatus?: HostedQueueJobStatus;
  attempt: number;
  queueRecord: HostedScanQueueRecord;
  queuePayload: HostedScanQueuePayload;
  shouldEnqueueWorker: boolean;
  shouldReuseCompletedReport: boolean;
  shouldCreateCheckRun: boolean;
  shouldCreatePrComment: false;
  privacy: {
    includesRawSource: false;
    includesRawDiffs: false;
    includesSecrets: false;
    includesUntrustedPrText: false;
    includesCustomerPayloads: false;
  };
}

export type HostedQueueCleanupTrigger =
  | "repository_removed"
  | "installation_deleted"
  | "repeated_cleanup";

export interface HostedQueueCleanupJobState {
  key: string;
  identity: HostedScanIdentity;
  status: HostedQueueJobStatus;
  attempt?: number;
  deliveryIds?: string[];
}

export interface HostedQueueCleanupPlanInput {
  trigger: HostedQueueCleanupTrigger;
  installationId: number;
  repositoryId?: number;
  requestedAt: string;
  jobs: HostedQueueCleanupJobState[];
}

export interface HostedQueueCleanupPlan {
  trigger: HostedQueueCleanupTrigger;
  scope: "repository" | "installation";
  installationId: number;
  repositoryId?: number;
  requestedAt: string;
  idempotencyKey: string;
  idempotent: true;
  matchedJobKeys: string[];
  cancelQueuedJobKeys: string[];
  requestRunningCancellationJobKeys: string[];
  preserveTerminalJobKeys: string[];
  keepUnmatchedJobKeys: string[];
  cancelQueuedJobs: true;
  requestRunningCancellation: true;
  deleteRawSource: false;
  deleteRawDiffs: false;
  deleteSecrets: false;
  deleteCustomerPayloads: false;
}

export type HostedWorkerCheckoutTerminalState =
  | "success"
  | "failure"
  | "timeout"
  | "cancellation"
  | "cleanup_failure";

export type HostedWorkerReadOnlyScanRejectReason =
  | InstallationScopeRejectReason
  | "contents_read_permission_required";

export interface HostedWorkerReadOnlyScanInput {
  identity: HostedScanIdentity;
  jobKey: string;
  requestedAt: string;
  installationId: number;
  selectedRepositoryIds: number[];
  removedRepositoryIds?: number[];
  installationTokenPermissions: {
    contents?: string;
  };
  checkoutRoot?: string;
  untrustedRepositoryFullName?: string;
  untrustedTokenPermissions?: unknown;
  untrustedCommand?: string;
  untrustedPrText?: string;
  rawSource?: string;
  rawDiff?: string;
  secretValues?: string[];
  customerPayload?: unknown;
}

export interface HostedWorkerReadOnlyScanPlan {
  accepted: boolean;
  reason?: HostedWorkerReadOnlyScanRejectReason;
  jobKey: string;
  requestedAt: string;
  readOnly: true;
  shouldFetchSource: boolean;
  shouldRunCli: boolean;
  shouldPersistRawSource: false;
  shouldPersistRawDiffs: false;
  shouldCreatePrComment: false;
  installationTokenScope?: {
    installationId: number;
    repositoryId: number;
    permissions: {
      contents: "read";
    };
    selectedRepositoryOnly: true;
  };
  checkout?: {
    repositoryId: number;
    repositoryFullName: string;
    pullRequestNumber: number;
    baseSha: string;
    targetCommitSha: string;
    directoryScope: "temporary_worker_directory";
    cleanupRequired: true;
    returnsCheckoutPath: false;
  };
  cli?: {
    command: "ai-saas-guard";
    args: string[];
    workingDirectory: "<worker-checkout>";
    networkAccess: "disabled";
    writeMode: "read_only";
  };
  output?: {
    compactJsonOnly: true;
    persistRawSource: false;
    persistRawDiffs: false;
    persistSecrets: false;
    persistCustomerPayloads: false;
  };
  privacy: {
    returnsCheckoutPath: false;
    includesRawSource: false;
    includesRawDiffs: false;
    includesSecrets: false;
    includesCustomerPayloads: false;
    acceptsRepositoryIdentityFromPrText: false;
    acceptsTokenScopeFromPrText: false;
    acceptsCommandFromPrText: false;
  };
}

export type HostedWorkerCheckoutCleanupAction = "delete_checkout" | "record_cleanup_failure";

export interface HostedWorkerCheckoutCleanupInput {
  identity: HostedScanIdentity;
  jobKey: string;
  terminalState: HostedWorkerCheckoutTerminalState;
  finishedAt: string;
  checkoutPath?: string;
  cleanupError?: string;
  rawSource?: string;
  rawDiff?: string;
  secretValues?: string[];
  customerPayload?: unknown;
}

export interface HostedWorkerCheckoutCleanupPlan {
  cleanupAction: HostedWorkerCheckoutCleanupAction;
  shouldDeleteWorkerCheckout: boolean;
  shouldRemoveCredentials: boolean;
  shouldRemoveRawSource: boolean;
  shouldRemoveRawDiffs: boolean;
  shouldRemoveGeneratedArtifacts: boolean;
  requiresOperatorReview: boolean;
  preserveAuditRecord: true;
  visibleUserMessage: string;
  safeMetadata: {
    jobKey: string;
    installationId: number;
    repositoryId: number;
    repositoryFullName: string;
    pullRequestNumber: number;
    scannerVersion: string;
    terminalState: HostedWorkerCheckoutTerminalState;
    finishedAt: string;
  };
  privacy: {
    returnsCheckoutPath: false;
    returnsCleanupError: false;
    returnsRawSource: false;
    returnsRawDiffs: false;
    returnsSecrets: false;
    returnsCustomerPayloads: false;
  };
}

export interface CompactHostedFinding {
  ruleId: string;
  severity: string;
  file: string;
  line?: number;
}

export interface CompactHostedReportInput {
  identity: HostedScanIdentity;
  summaryCounts: Record<string, number>;
  findings: CompactHostedFinding[];
  retentionDays?: number;
  rawDiff?: string;
  fullFileContents?: string;
  secretValues?: string[];
  customerPayload?: unknown;
}

export interface CompactHostedReport {
  installationId: number;
  repositoryId: number;
  repositoryFullName: string;
  pullRequestNumber: number;
  baseSha: string;
  headSha: string;
  scannerVersion: string;
  summaryCounts: Record<string, number>;
  ruleIds: string[];
  evidence: Array<{
    ruleId: string;
    severity: string;
    file: string;
    line?: number;
  }>;
  retentionDays: number;
  modelTraining: "disabled";
  workerCheckoutDeletion: "after_scan_completion";
}

export type HostedCheckRunConclusion = "success" | "neutral" | "failure";

export type HostedCheckRunSeverityThreshold =
  | "critical"
  | "high"
  | "medium"
  | "low"
  | "info";

export type HostedCheckRunAnnotationLevel = "notice" | "warning" | "failure";

export interface HostedCheckRunSummaryInput {
  report: CompactHostedReport;
  failOnSeverity?: HostedCheckRunSeverityThreshold;
  maxMarkdownChars?: number;
}

export interface HostedCheckRunAnnotation {
  path: string;
  startLine: number;
  endLine: number;
  annotationLevel: HostedCheckRunAnnotationLevel;
  title: string;
  message: string;
}

export interface HostedCheckRunSummary {
  name: "AI SaaS Guard";
  conclusion: HostedCheckRunConclusion;
  output: {
    title: string;
    summary: string;
    text: string;
  };
  annotations: HostedCheckRunAnnotation[];
  localCliCommand: string;
  privacy: {
    includesRawSource: false;
    includesRawDiffs: false;
    includesSecrets: false;
    includesCustomerPayloads: false;
    modelTraining: "disabled";
  };
}

export type HostedCheckRunPublicationRejectReason =
  | InstallationScopeRejectReason
  | "checks_write_permission_required";

export interface HostedCheckRunPublicationInput {
  identity: HostedScanIdentity;
  report: CompactHostedReport;
  jobKey: string;
  requestedAt: string;
  installationId: number;
  selectedRepositoryIds: number[];
  removedRepositoryIds?: number[];
  installationTokenPermissions: {
    checks?: string;
  };
  failOnSeverity?: HostedCheckRunSeverityThreshold;
  maxMarkdownChars?: number;
  rawSource?: string;
  rawDiff?: string;
  secretValues?: string[];
  untrustedPrText?: string;
  customerPayload?: unknown;
}

export interface HostedCheckRunApiPayload {
  name: "AI SaaS Guard";
  head_sha: string;
  status: "completed";
  conclusion: HostedCheckRunConclusion;
  external_id: string;
  output: {
    title: string;
    summary: string;
    text: string;
    annotations: HostedCheckRunAnnotation[];
  };
}

export interface HostedCheckRunPublicationPlan {
  accepted: boolean;
  reason?: HostedCheckRunPublicationRejectReason;
  jobKey: string;
  requestedAt: string;
  operation?: "create";
  shouldWriteCheckRun: boolean;
  shouldCreatePrComment: false;
  shouldCallGitHubApi: false;
  installationTokenScope?: {
    installationId: number;
    repositoryId: number;
    permissions: {
      checks: "write";
    };
    selectedRepositoryOnly: true;
  };
  request?: {
    method: "POST";
    endpoint: string;
    payload: HostedCheckRunApiPayload;
  };
  privacy: {
    includesRawSource: false;
    includesRawDiffs: false;
    includesSecrets: false;
    includesCustomerPayloads: false;
    includesUntrustedPrText: false;
    createsPrComment: false;
    modelTraining: "disabled";
  };
}

export type HostedGitHubAppTrialGateBlockedReason =
  | "trial_repository_limit_exceeded"
  | "trial_repository_not_selected"
  | "check_run_publication_missing"
  | "compact_report_missing"
  | "worker_cleanup_missing"
  | "safe_log_boundary_rejected";

export interface HostedGitHubAppTrialGateInput {
  requestedAt: string;
  appName: string;
  installationId: number;
  selectedRepositoryIds: number[];
  trialRepositoryIds: number[];
  completedCheckRuns: Array<{
    repositoryId: number;
    pullRequestNumber: number;
    headSha: string;
    conclusion: HostedCheckRunConclusion;
    compactReportStored: boolean;
    checkRunPublished: boolean;
    workerCleanupVerified: boolean;
  }>;
  safeLogBoundary: {
    accepted: boolean;
    sampleCount: number;
    blockedReasons: string[];
  };
  maxTrialRepositories?: number;
  rawSource?: string;
  rawDiff?: string;
  secretValues?: string[];
  customerPayload?: unknown;
}

export interface HostedGitHubAppTrialGate {
  readyForTrial: boolean;
  blockedReasons: HostedGitHubAppTrialGateBlockedReason[];
  requestedAt: string;
  scope: {
    appName: string;
    installationId: number;
    trialRepositoryIds: number[];
    maxTrialRepositories: number;
  };
  checkRunsReady: boolean;
  safeLogBoundaryReady: boolean;
  requiredNextProof: string[];
  privacy: {
    includesRawSource: false;
    includesRawDiffs: false;
    includesSecrets: false;
    includesCustomerPayloads: false;
    claimsCompleteHostedSaas: false;
  };
}

export type HostedDeletionTrigger =
  | "repository_removed"
  | "installation_deleted"
  | "repeated_cleanup";

export interface HostedDeletionPlanInput {
  trigger: HostedDeletionTrigger;
  installationId: number;
  repositoryId?: number;
  requestedAt: string;
  auditRecordRetentionDays?: number;
}

export interface HostedDeletionPlan {
  trigger: HostedDeletionTrigger;
  scope: "repository" | "installation";
  installationId: number;
  repositoryId?: number;
  requestedAt: string;
  idempotencyKey: string;
  idempotent: true;
  deleteCompactReports: true;
  cancelQueuedJobs: true;
  deleteWorkerCheckouts: true;
  deleteRawSource: false;
  deleteRawDiffs: false;
  deleteSecrets: false;
  deleteCustomerPayloads: false;
  deleteGitHubOwnedCheckRuns: false;
  preserveAuditRecord: true;
  auditRecordRetentionDays: number;
  visibleUserMessage: string;
}

export type HostedRetentionAndDeletionCleanupTrigger =
  | HostedDeletionTrigger
  | "retention_expired";

export interface HostedCompactReportRetentionRecord {
  id: string;
  installationId: number;
  repositoryId: number;
  createdAt: string;
  retentionDays?: number;
  expiresAt?: string;
}

export interface HostedWorkerCheckoutCleanupState {
  key: string;
  identity: HostedScanIdentity;
  status?: "active" | "deletion_pending" | "deleted";
}

export interface HostedRetentionAndDeletionCleanupInput {
  trigger: HostedRetentionAndDeletionCleanupTrigger;
  installationId: number;
  repositoryId?: number;
  requestedAt: string;
  compactReports: HostedCompactReportRetentionRecord[];
  jobs: HostedQueueCleanupJobState[];
  workerCheckouts: HostedWorkerCheckoutCleanupState[];
  auditRecordRetentionDays?: number;
  rawSource?: string;
  rawDiff?: string;
  secretValues?: string[];
  customerPayload?: unknown;
}

export interface HostedRetentionAndDeletionCleanupAuditRecord {
  cleanupRequestId: string;
  trigger: HostedRetentionAndDeletionCleanupTrigger;
  status: "planned";
  installationId: number;
  repositoryId?: number;
  requestedAt: string;
}

export interface HostedRetentionAndDeletionCleanupPlan {
  trigger: HostedRetentionAndDeletionCleanupTrigger;
  scope: "repository" | "installation";
  installationId: number;
  repositoryId?: number;
  requestedAt: string;
  idempotencyKey: string;
  idempotent: true;
  deleteCompactReportIds: string[];
  preserveCompactReportIds: string[];
  cancelQueuedJobKeys: string[];
  requestRunningCancellationJobKeys: string[];
  preserveTerminalJobKeys: string[];
  keepUnmatchedJobKeys: string[];
  deleteWorkerCheckoutKeys: string[];
  keepWorkerCheckoutKeys: string[];
  deleteCompactReports: true;
  cancelQueuedJobs: boolean;
  requestRunningCancellation: boolean;
  deleteWorkerCheckouts: boolean;
  shouldFetchRepository: false;
  shouldRequeueScans: false;
  deleteRawSource: false;
  deleteRawDiffs: false;
  deleteSecrets: false;
  deleteCustomerPayloads: false;
  deleteGitHubOwnedCheckRuns: false;
  preserveAuditRecord: true;
  auditRecordRetentionDays: number;
  auditRecord: HostedRetentionAndDeletionCleanupAuditRecord;
  visibleUserMessage: string;
  privacy: {
    includesRawSource: false;
    includesRawDiffs: false;
    includesSecrets: false;
    includesCustomerPayloads: false;
    includesWorkerCheckoutPaths: false;
    includesPrivateUrls: false;
    includesLowLevelCleanupErrors: false;
  };
}

export const HOSTED_OPERATIONAL_RELEASE_GATE_REQUIREMENTS = [
  { id: "clean_ci", priority: "P0", label: "Clean CI" },
  { id: "hosted_contract_tests", priority: "P0", label: "Hosted contract tests" },
  { id: "webhook_replay", priority: "P0", label: "Webhook replay" },
  { id: "workflow_static_checks", priority: "P0", label: "Workflow static checks" },
  { id: "dependency_scan", priority: "P0", label: "Dependency scan" },
  { id: "container_scan", priority: "P0", label: "Container scan" },
  { id: "queue_worker_cleanup", priority: "P0", label: "Queue and worker cleanup" },
  { id: "privacy_retention", priority: "P0", label: "Privacy and retention" },
  { id: "monitoring_alerting", priority: "P0", label: "Monitoring and alerting" },
  { id: "manual_rollback", priority: "P0", label: "Manual rollback" },
  { id: "incident_response", priority: "P0", label: "Incident response" },
  { id: "release_cleanup", priority: "P0", label: "Release cleanup" }
] as const;

export type HostedOperationalReleaseGateRequirementId =
  (typeof HOSTED_OPERATIONAL_RELEASE_GATE_REQUIREMENTS)[number]["id"];

export type HostedOperationalReleaseGateEvidenceStatus =
  | "passed"
  | "failed"
  | "missing"
  | "exception";

export interface HostedOperationalReleaseGateEvidence {
  id: HostedOperationalReleaseGateRequirementId;
  status: HostedOperationalReleaseGateEvidenceStatus;
  collectedAt?: string;
  evidenceUrl?: string;
  note?: string;
  owner?: string;
}

export interface HostedOperationalReleaseGateInput {
  commitSha: string;
  scannerVersion: string;
  deploymentTarget: string;
  evaluatedAt: string;
  evidence: HostedOperationalReleaseGateEvidence[];
  releaseNotes: string;
  containerImageDigest?: string;
  maxEvidenceAgeDays?: number;
  rawSource?: string;
  rawDiff?: string;
  secretValues?: string[];
  customerPayload?: unknown;
}

export interface HostedOperationalReleaseGateDecision {
  commitSha: string;
  scannerVersion: string;
  deploymentTarget: string;
  evaluatedAt: string;
  requiredEvidenceCount: number;
  requiredEvidenceIds: HostedOperationalReleaseGateRequirementId[];
  passedEvidenceIds: HostedOperationalReleaseGateRequirementId[];
  missingEvidenceIds: HostedOperationalReleaseGateRequirementId[];
  failedEvidenceIds: HostedOperationalReleaseGateRequirementId[];
  staleEvidenceIds: HostedOperationalReleaseGateRequirementId[];
  exceptionEvidenceIds: HostedOperationalReleaseGateRequirementId[];
  containerImageDigestRecorded: boolean;
  releaseNotesCompliant: boolean;
  releaseNotesForbiddenClaims: string[];
  shouldExposeHostedEnvironment: boolean;
  blocked: boolean;
  localCliBoundary: {
    localCliUsableWithoutHostedService: true;
    accountRequiredForLocalCli: false;
  };
  visibleUserMessage: string;
  privacy: {
    includesRawSource: false;
    includesRawDiffs: false;
    includesSecrets: false;
    includesCustomerPayloads: false;
    includesPrivateUrls: false;
    modelTraining: "disabled";
  };
}

export const HOSTED_PRIVACY_DEFAULTS = {
  retentionDays: 30,
  auditRecordRetentionDays: 90,
  modelTraining: "disabled",
  deleteWorkerCheckout: "after_scan_completion"
} as const;

const CHECK_RUN_NAME = "AI SaaS Guard";
const DEFAULT_CHECK_RUN_MARKDOWN_CHARS = 4000;
const MAX_CHECK_RUN_ANNOTATIONS = 50;
const severityOrder = ["critical", "high", "medium", "low", "info"] as const;
const severityRanks: Record<HostedCheckRunSeverityThreshold, number> = {
  critical: 5,
  high: 4,
  medium: 3,
  low: 2,
  info: 1
};

export function verifyGitHubWebhook(input: GitHubWebhookInput): GitHubWebhookDecision {
  const { deliveryId, seenDeliveryIds, signatureHeader } = input;

  if (!signatureHeader) {
    return rejectWebhook("missing_signature", deliveryId);
  }

  const parsedSignature = parseSha256Signature(signatureHeader);
  if (!parsedSignature) {
    return rejectWebhook("malformed_signature", deliveryId);
  }

  const expected = createHmac("sha256", input.signingKey).update(input.payload).digest();
  if (!timingSafeEqual(parsedSignature, expected)) {
    return rejectWebhook("invalid_signature", deliveryId);
  }

  if (deliveryId && seenDeliveryIds?.has(deliveryId)) {
    return rejectWebhook("replayed_delivery_id", deliveryId);
  }

  if (deliveryId) {
    seenDeliveryIds?.add(deliveryId);
  }

  return {
    accepted: true,
    shouldQueueScanJob: true,
    shouldFetchRepository: false,
    deliveryId
  };
}

export function planHostedPullRequestWebhookIntake(
  input: HostedPullRequestWebhookIntakeInput
): HostedPullRequestWebhookIntakeDecision {
  const signatureDecision = verifyGitHubWebhook({
    payload: input.payload,
    signatureHeader: input.signatureHeader,
    signingKey: input.signingKey,
    deliveryId: input.deliveryId,
    seenDeliveryIds: input.seenDeliveryIds
  });

  if (!signatureDecision.accepted) {
    return rejectPullRequestWebhookIntake(
      "signature",
      signatureDecision.reason ?? "invalid_signature",
      input.deliveryId
    );
  }

  if (!input.deliveryId) {
    return rejectPullRequestWebhookIntake("event", "missing_delivery_id");
  }

  const payload = parseJsonPayload(input.payload);
  if (!payload) {
    return rejectPullRequestWebhookIntake("payload", "invalid_json", input.deliveryId);
  }

  const eventDecision = parseHostedPullRequestEvent({
    payload,
    scannerVersion: input.scannerVersion,
    allowDraft: input.allowDraft,
    supportedActions: input.supportedActions
  });

  if (!eventDecision.accepted || !eventDecision.identity) {
    return rejectPullRequestWebhookIntake(
      "event",
      eventDecision.reason ?? "missing_required_field",
      input.deliveryId,
      eventDecision.action
    );
  }

  const scopeDecision = authorizeInstallationTokenScope({
    identity: eventDecision.identity,
    installationId: eventDecision.identity.installationId,
    selectedRepositoryIds: input.selectedRepositoryIds,
    removedRepositoryIds: input.removedRepositoryIds
  });

  if (!scopeDecision.authorized) {
    return rejectPullRequestWebhookIntake(
      "installation_scope",
      scopeDecision.reason ?? "repository_not_installed",
      input.deliveryId,
      eventDecision.action,
      eventDecision.identity
    );
  }

  const queueDecision = upsertHostedScanJob(input.queue, {
    identity: eventDecision.identity,
    deliveryId: input.deliveryId,
    manualRerun: input.manualRerun
  });
  const checkRunOnlyQueueDecision = {
    ...queueDecision,
    shouldCreatePrComment: false
  };

  return {
    accepted: true,
    stage: "queue",
    action: eventDecision.action,
    deliveryId: input.deliveryId,
    identity: eventDecision.identity,
    job: checkRunOnlyQueueDecision,
    shouldQueueScanJob: queueDecision.created || input.manualRerun === true,
    shouldFetchRepository: queueDecision.shouldCreateCheckRun,
    shouldCreateCheckRun: queueDecision.shouldCreateCheckRun,
    shouldCreatePrComment: false,
    privacy: hostedWebhookIntakePrivacy()
  };
}

export function buildHostedScanIdentity(input: HostedScanIdentityInput): HostedScanIdentity {
  return {
    installationId: input.installationId,
    repositoryId: input.repositoryId,
    repositoryFullName: input.repositoryFullName,
    pullRequestNumber: input.pullRequestNumber,
    baseSha: input.baseSha,
    headSha: input.headSha,
    scannerVersion: input.scannerVersion
  };
}

export function parseHostedPullRequestEvent(
  input: HostedPullRequestEventInput
): HostedPullRequestEventDecision {
  const supportedActions = input.supportedActions ?? [
    "opened",
    "reopened",
    "synchronize",
    "ready_for_review"
  ];
  const payload = input.payload;

  if (!isRecord(payload)) {
    return rejectPullRequestEvent("missing_required_field");
  }

  const action = valueAsString(payload.action);
  if (!action || !supportedActions.includes(action)) {
    return rejectPullRequestEvent("unsupported_action", action);
  }

  const installation = valueAsRecord(payload.installation);
  const repository = valueAsRecord(payload.repository);
  const pullRequest = valueAsRecord(payload.pull_request);
  const base = valueAsRecord(pullRequest?.base);
  const head = valueAsRecord(pullRequest?.head);

  const installationId = valueAsNumber(installation?.id);
  const repositoryId = valueAsNumber(repository?.id);
  const repositoryFullName = valueAsString(repository?.full_name);
  const pullRequestNumber = valueAsNumber(pullRequest?.number);
  const baseSha = valueAsString(base?.sha);
  const headSha = valueAsString(head?.sha);
  const draft = pullRequest?.draft === true;

  if (
    installationId === undefined ||
    repositoryId === undefined ||
    !repositoryFullName ||
    pullRequestNumber === undefined ||
    !baseSha ||
    !headSha
  ) {
    return rejectPullRequestEvent("missing_required_field", action);
  }

  if (draft && !input.allowDraft) {
    return rejectPullRequestEvent("draft_pull_request", action);
  }

  return {
    accepted: true,
    shouldQueueScanJob: true,
    action,
    identity: buildHostedScanIdentity({
      installationId,
      repositoryId,
      repositoryFullName,
      pullRequestNumber,
      baseSha,
      headSha,
      scannerVersion: input.scannerVersion
    })
  };
}

export function authorizeInstallationTokenScope(
  input: InstallationScopeInput
): InstallationScopeDecision {
  if (input.installationId !== input.identity.installationId) {
    return rejectInstallationScope("installation_mismatch");
  }

  if (input.removedRepositoryIds?.includes(input.identity.repositoryId)) {
    return rejectInstallationScope("repository_removed_from_installation");
  }

  if (!input.selectedRepositoryIds.includes(input.identity.repositoryId)) {
    return rejectInstallationScope("repository_not_installed");
  }

  return {
    authorized: true,
    shouldFetchSource: true
  };
}

export function getHostedScanIdempotencyKey(identity: HostedScanIdentity): string {
  return [
    identity.installationId,
    identity.repositoryId,
    identity.pullRequestNumber,
    identity.headSha,
    identity.scannerVersion
  ].join(":");
}

export function upsertHostedScanJob(
  queue: Map<string, HostedScanJobState>,
  input: HostedScanJobInput
): HostedScanJobDecision {
  const key = getHostedScanIdempotencyKey(input.identity);
  const existing = queue.get(key);

  if (!existing) {
    queue.set(key, {
      key,
      attempt: 1,
      deliveryIds: [input.deliveryId]
    });

    return {
      key,
      created: true,
      reusedExistingReport: false,
      attempt: 1,
      shouldCreateCheckRun: true,
      shouldCreatePrComment: false
    };
  }

  if (!existing.deliveryIds.includes(input.deliveryId)) {
    existing.deliveryIds.push(input.deliveryId);
  }

  if (input.manualRerun) {
    existing.attempt += 1;
  }

  return {
    key,
    created: false,
    reusedExistingReport: true,
    attempt: existing.attempt,
    shouldCreateCheckRun: false,
    shouldCreatePrComment: false
  };
}

export function planHostedScanQueueUpsert(
  input: HostedScanQueueUpsertInput
): HostedScanQueueUpsertDecision {
  const key = getHostedScanIdempotencyKey(input.identity);
  const existing = input.queue.get(key);

  if (!existing) {
    const record: HostedScanQueueRecord = {
      key,
      identity: input.identity,
      status: "queued",
      attempt: 1,
      deliveryIds: [input.deliveryId],
      createdAt: input.requestedAt,
      updatedAt: input.requestedAt
    };
    input.queue.set(key, record);

    return {
      key,
      idempotent: true,
      created: true,
      reusedExistingJob: false,
      attempt: record.attempt,
      queueRecord: { ...record, deliveryIds: [...record.deliveryIds] },
      queuePayload: createHostedScanQueuePayload(record, input.deliveryId, input.requestedAt),
      shouldEnqueueWorker: true,
      shouldReuseCompletedReport: false,
      shouldCreateCheckRun: true,
      shouldCreatePrComment: false,
      privacy: hostedScanQueuePrivacy()
    };
  }

  if (!existing.deliveryIds.includes(input.deliveryId)) {
    existing.deliveryIds.push(input.deliveryId);
  }

  const existingStatus = existing.status;
  if (input.manualRerun) {
    existing.attempt += 1;
    existing.status = "queued";
    existing.updatedAt = input.requestedAt;

    return {
      key,
      idempotent: true,
      created: false,
      reusedExistingJob: false,
      existingStatus,
      attempt: existing.attempt,
      queueRecord: cloneHostedScanQueueRecord(existing),
      queuePayload: createHostedScanQueuePayload(existing, input.deliveryId, input.requestedAt),
      shouldEnqueueWorker: true,
      shouldReuseCompletedReport: false,
      shouldCreateCheckRun: true,
      shouldCreatePrComment: false,
      privacy: hostedScanQueuePrivacy()
    };
  }

  existing.updatedAt = input.requestedAt;

  return {
    key,
    idempotent: true,
    created: false,
    reusedExistingJob: true,
    existingStatus,
    attempt: existing.attempt,
    queueRecord: cloneHostedScanQueueRecord(existing),
    queuePayload: createHostedScanQueuePayload(existing, input.deliveryId, input.requestedAt),
    shouldEnqueueWorker: false,
    shouldReuseCompletedReport: existingStatus === "completed",
    shouldCreateCheckRun: false,
    shouldCreatePrComment: false,
    privacy: hostedScanQueuePrivacy()
  };
}

export function getHostedQueueCleanupIdempotencyKey(input: {
  trigger: HostedQueueCleanupTrigger;
  installationId: number;
  repositoryId?: number;
}): string {
  return ["queue-cleanup", input.trigger, input.installationId, input.repositoryId ?? "all"].join(
    ":"
  );
}

export function createHostedQueueCleanupPlan(
  input: HostedQueueCleanupPlanInput
): HostedQueueCleanupPlan {
  const scope = input.trigger === "installation_deleted" ? "installation" : "repository";
  const matchedJobs = input.jobs.filter((job) => queueCleanupMatches(job, input, scope));
  const unmatchedJobs = input.jobs.filter((job) => !queueCleanupMatches(job, input, scope));

  return {
    trigger: input.trigger,
    scope,
    installationId: input.installationId,
    ...(scope === "repository" && input.repositoryId !== undefined
      ? { repositoryId: input.repositoryId }
      : {}),
    requestedAt: input.requestedAt,
    idempotencyKey: getHostedQueueCleanupIdempotencyKey({
      trigger: input.trigger,
      installationId: input.installationId,
      repositoryId: scope === "repository" ? input.repositoryId : undefined
    }),
    idempotent: true,
    matchedJobKeys: matchedJobs.map((job) => job.key),
    cancelQueuedJobKeys: matchedJobs
      .filter((job) => job.status === "queued")
      .map((job) => job.key),
    requestRunningCancellationJobKeys: matchedJobs
      .filter((job) => job.status === "running")
      .map((job) => job.key),
    preserveTerminalJobKeys: matchedJobs
      .filter((job) => isTerminalQueueStatus(job.status))
      .map((job) => job.key),
    keepUnmatchedJobKeys: unmatchedJobs.map((job) => job.key),
    cancelQueuedJobs: true,
    requestRunningCancellation: true,
    deleteRawSource: false,
    deleteRawDiffs: false,
    deleteSecrets: false,
    deleteCustomerPayloads: false
  };
}

export function planHostedWorkerReadOnlyScan(
  input: HostedWorkerReadOnlyScanInput
): HostedWorkerReadOnlyScanPlan {
  const scopeDecision = authorizeInstallationTokenScope({
    identity: input.identity,
    installationId: input.installationId,
    selectedRepositoryIds: input.selectedRepositoryIds,
    removedRepositoryIds: input.removedRepositoryIds
  });

  if (!scopeDecision.authorized) {
    return rejectHostedWorkerReadOnlyScan(
      input,
      scopeDecision.reason ?? "repository_not_installed"
    );
  }

  if (input.installationTokenPermissions.contents !== "read") {
    return rejectHostedWorkerReadOnlyScan(input, "contents_read_permission_required");
  }

  return {
    accepted: true,
    jobKey: input.jobKey,
    requestedAt: input.requestedAt,
    readOnly: true,
    shouldFetchSource: true,
    shouldRunCli: true,
    shouldPersistRawSource: false,
    shouldPersistRawDiffs: false,
    shouldCreatePrComment: false,
    installationTokenScope: {
      installationId: input.identity.installationId,
      repositoryId: input.identity.repositoryId,
      permissions: { contents: "read" },
      selectedRepositoryOnly: true
    },
    checkout: {
      repositoryId: input.identity.repositoryId,
      repositoryFullName: input.identity.repositoryFullName,
      pullRequestNumber: input.identity.pullRequestNumber,
      baseSha: input.identity.baseSha,
      targetCommitSha: input.identity.headSha,
      directoryScope: "temporary_worker_directory",
      cleanupRequired: true,
      returnsCheckoutPath: false
    },
    cli: {
      command: "ai-saas-guard",
      args: [
        "pr-risk",
        "--root",
        "<worker-checkout>",
        "--base",
        input.identity.baseSha,
        "--json"
      ],
      workingDirectory: "<worker-checkout>",
      networkAccess: "disabled",
      writeMode: "read_only"
    },
    output: {
      compactJsonOnly: true,
      persistRawSource: false,
      persistRawDiffs: false,
      persistSecrets: false,
      persistCustomerPayloads: false
    },
    privacy: hostedWorkerReadOnlyScanPrivacy()
  };
}

export function createHostedWorkerCheckoutCleanupPlan(
  input: HostedWorkerCheckoutCleanupInput
): HostedWorkerCheckoutCleanupPlan {
  const cleanupFailed = input.terminalState === "cleanup_failure";

  return {
    cleanupAction: cleanupFailed ? "record_cleanup_failure" : "delete_checkout",
    shouldDeleteWorkerCheckout: !cleanupFailed,
    shouldRemoveCredentials: !cleanupFailed,
    shouldRemoveRawSource: !cleanupFailed,
    shouldRemoveRawDiffs: !cleanupFailed,
    shouldRemoveGeneratedArtifacts: !cleanupFailed,
    requiresOperatorReview: cleanupFailed,
    preserveAuditRecord: true,
    visibleUserMessage: cleanupFailed
      ? "Worker checkout cleanup failed; manual cleanup review is required without exposing checkout data."
      : "Worker checkout is scheduled for deletion after scan completion.",
    safeMetadata: {
      jobKey: input.jobKey,
      installationId: input.identity.installationId,
      repositoryId: input.identity.repositoryId,
      repositoryFullName: input.identity.repositoryFullName,
      pullRequestNumber: input.identity.pullRequestNumber,
      scannerVersion: input.identity.scannerVersion,
      terminalState: input.terminalState,
      finishedAt: input.finishedAt
    },
    privacy: {
      returnsCheckoutPath: false,
      returnsCleanupError: false,
      returnsRawSource: false,
      returnsRawDiffs: false,
      returnsSecrets: false,
      returnsCustomerPayloads: false
    }
  };
}

export function resolveHostedRetentionDays(input: { teamRequestedDays?: number } = {}): number {
  if (input.teamRequestedDays === undefined) {
    return HOSTED_PRIVACY_DEFAULTS.retentionDays;
  }

  const requestedDays = Math.floor(input.teamRequestedDays);
  return Math.min(HOSTED_PRIVACY_DEFAULTS.retentionDays, Math.max(1, requestedDays));
}

export function createCompactHostedReport(input: CompactHostedReportInput): CompactHostedReport {
  const { identity } = input;
  const ruleIds = [...new Set(input.findings.map((finding) => finding.ruleId))];

  return {
    installationId: identity.installationId,
    repositoryId: identity.repositoryId,
    repositoryFullName: identity.repositoryFullName,
    pullRequestNumber: identity.pullRequestNumber,
    baseSha: identity.baseSha,
    headSha: identity.headSha,
    scannerVersion: identity.scannerVersion,
    summaryCounts: { ...input.summaryCounts },
    ruleIds,
    evidence: input.findings.map((finding) => ({
      ruleId: finding.ruleId,
      severity: finding.severity,
      file: finding.file,
      ...(finding.line === undefined ? {} : { line: finding.line })
    })),
    retentionDays: resolveHostedRetentionDays({ teamRequestedDays: input.retentionDays }),
    modelTraining: HOSTED_PRIVACY_DEFAULTS.modelTraining,
    workerCheckoutDeletion: HOSTED_PRIVACY_DEFAULTS.deleteWorkerCheckout
  };
}

export function createHostedCheckRunSummary(
  input: HostedCheckRunSummaryInput
): HostedCheckRunSummary {
  const { report } = input;
  const totalFindings = getHostedReportFindingTotal(report);
  const localCliCommand = `npx ai-saas-guard@${report.scannerVersion} pr-risk --root .`;
  const conclusion = resolveCheckRunConclusion(report, input.failOnSeverity);
  const launchGate = hostedLaunchGateVerdict(report);

  return {
    name: CHECK_RUN_NAME,
    conclusion,
    output: {
      title: formatCheckRunTitle(totalFindings, conclusion, input.failOnSeverity),
      summary: [
        `Launch-risk gate: ${launchGate}. Launch gate: ${launchGate}.`,
        "Review task: inspect the files below before merge.",
        "Manual proof: prove changed auth, billing, data, deploy, or tests fail closed.",
        "Boundary: selected repository only; not an AI reviewer, pentest, full audit, or certification."
      ].join(" "),
      text: truncateMarkdown(
        formatCheckRunMarkdown(report, conclusion, localCliCommand, launchGate),
        input.maxMarkdownChars
      )
    },
    annotations: report.evidence.slice(0, MAX_CHECK_RUN_ANNOTATIONS).map((finding) => {
      const line = finding.line ?? 1;

      return {
        path: finding.file,
        startLine: line,
        endLine: line,
        annotationLevel: annotationLevelForSeverity(finding.severity),
        title: finding.ruleId,
        message: `${finding.severity} finding. Review locally before launch.`
      };
    }),
    localCliCommand,
    privacy: {
      includesRawSource: false,
      includesRawDiffs: false,
      includesSecrets: false,
      includesCustomerPayloads: false,
      modelTraining: HOSTED_PRIVACY_DEFAULTS.modelTraining
    }
  };
}

export function planHostedCheckRunPublication(
  input: HostedCheckRunPublicationInput
): HostedCheckRunPublicationPlan {
  const scopeDecision = authorizeInstallationTokenScope({
    identity: input.identity,
    installationId: input.installationId,
    selectedRepositoryIds: input.selectedRepositoryIds,
    removedRepositoryIds: input.removedRepositoryIds
  });

  if (!scopeDecision.authorized) {
    return rejectHostedCheckRunPublication(
      input,
      scopeDecision.reason ?? "repository_not_installed"
    );
  }

  if (input.installationTokenPermissions.checks !== "write") {
    return rejectHostedCheckRunPublication(input, "checks_write_permission_required");
  }

  const summary = createHostedCheckRunSummary({
    report: input.report,
    failOnSeverity: input.failOnSeverity,
    maxMarkdownChars: input.maxMarkdownChars
  });

  return {
    accepted: true,
    jobKey: input.jobKey,
    requestedAt: input.requestedAt,
    operation: "create",
    shouldWriteCheckRun: true,
    shouldCreatePrComment: false,
    shouldCallGitHubApi: false,
    installationTokenScope: {
      installationId: input.identity.installationId,
      repositoryId: input.identity.repositoryId,
      permissions: { checks: "write" },
      selectedRepositoryOnly: true
    },
    request: {
      method: "POST",
      endpoint: `/repos/${input.identity.repositoryFullName}/check-runs`,
      payload: {
        name: summary.name,
        head_sha: input.identity.headSha,
        status: "completed",
        conclusion: summary.conclusion,
        external_id: input.jobKey,
        output: {
          ...summary.output,
          annotations: summary.annotations
        }
      }
    },
    privacy: hostedCheckRunPublicationPrivacy()
  };
}

export function createHostedGitHubAppTrialGate(
  input: HostedGitHubAppTrialGateInput
): HostedGitHubAppTrialGate {
  const maxTrialRepositories = input.maxTrialRepositories ?? 3;
  const selectedRepositoryIds = new Set(input.selectedRepositoryIds);
  const blockedReasons: HostedGitHubAppTrialGateBlockedReason[] = [];
  const trialRepositoryLimitExceeded = input.trialRepositoryIds.length > maxTrialRepositories;
  const trialRepositoryNotSelected = input.trialRepositoryIds.some(
    (repositoryId) => !selectedRepositoryIds.has(repositoryId)
  );
  const matchingRuns = input.completedCheckRuns.filter((run) =>
    input.trialRepositoryIds.includes(run.repositoryId)
  );
  const checkRunPublicationMissing =
    matchingRuns.length === 0 || matchingRuns.some((run) => !run.checkRunPublished);
  const compactReportMissing =
    matchingRuns.length === 0 || matchingRuns.some((run) => !run.compactReportStored);
  const workerCleanupMissing =
    matchingRuns.length === 0 || matchingRuns.some((run) => !run.workerCleanupVerified);
  const safeLogBoundaryRejected =
    !input.safeLogBoundary.accepted || input.safeLogBoundary.sampleCount <= 0;

  if (trialRepositoryLimitExceeded) blockedReasons.push("trial_repository_limit_exceeded");
  if (trialRepositoryNotSelected) blockedReasons.push("trial_repository_not_selected");
  if (checkRunPublicationMissing) blockedReasons.push("check_run_publication_missing");
  if (compactReportMissing) blockedReasons.push("compact_report_missing");
  if (workerCleanupMissing) blockedReasons.push("worker_cleanup_missing");
  if (safeLogBoundaryRejected) blockedReasons.push("safe_log_boundary_rejected");

  return {
    readyForTrial: blockedReasons.length === 0,
    blockedReasons,
    requestedAt: input.requestedAt,
    scope: {
      appName: input.appName,
      installationId: input.installationId,
      trialRepositoryIds: [...input.trialRepositoryIds].sort((a, b) => a - b),
      maxTrialRepositories
    },
    checkRunsReady:
      matchingRuns.length > 0 &&
      !checkRunPublicationMissing &&
      !compactReportMissing &&
      !workerCleanupMissing,
    safeLogBoundaryReady: !safeLogBoundaryRejected,
    requiredNextProof: [
      "Install only on selected trial repositories.",
      "Publish one bounded Check Run from compact report data only.",
      "Verify worker checkout cleanup after success and failure.",
      "Sample logs and confirm raw source, raw diffs, secrets, customer payloads, and tokens are absent."
    ],
    privacy: {
      includesRawSource: false,
      includesRawDiffs: false,
      includesSecrets: false,
      includesCustomerPayloads: false,
      claimsCompleteHostedSaas: false
    }
  };
}

export function getHostedDeletionIdempotencyKey(input: {
  trigger: HostedDeletionTrigger;
  installationId: number;
  repositoryId?: number;
}): string {
  return [input.trigger, input.installationId, input.repositoryId ?? "all"].join(":");
}

export function createHostedDeletionPlan(input: HostedDeletionPlanInput): HostedDeletionPlan {
  const scope = input.trigger === "installation_deleted" ? "installation" : "repository";
  const repositoryId = scope === "repository" ? input.repositoryId : undefined;

  return {
    trigger: input.trigger,
    scope,
    installationId: input.installationId,
    ...(repositoryId === undefined ? {} : { repositoryId }),
    requestedAt: input.requestedAt,
    idempotencyKey: getHostedDeletionIdempotencyKey({
      trigger: input.trigger,
      installationId: input.installationId,
      repositoryId
    }),
    idempotent: true,
    deleteCompactReports: true,
    cancelQueuedJobs: true,
    deleteWorkerCheckouts: true,
    deleteRawSource: false,
    deleteRawDiffs: false,
    deleteSecrets: false,
    deleteCustomerPayloads: false,
    deleteGitHubOwnedCheckRuns: false,
    preserveAuditRecord: true,
    auditRecordRetentionDays: resolveHostedAuditRecordRetentionDays(
      input.auditRecordRetentionDays
    ),
    visibleUserMessage:
      "Hosted app-side compact reports and queued work are removed; GitHub-owned check runs remain in GitHub according to repository settings."
  };
}

export function getHostedRetentionAndDeletionCleanupIdempotencyKey(input: {
  trigger: HostedRetentionAndDeletionCleanupTrigger;
  installationId: number;
  repositoryId?: number;
}): string {
  return [
    "retention-cleanup",
    input.trigger,
    input.installationId,
    input.repositoryId ?? "all"
  ].join(":");
}

export function planHostedRetentionAndDeletionCleanup(
  input: HostedRetentionAndDeletionCleanupInput
): HostedRetentionAndDeletionCleanupPlan {
  const retentionOnly = input.trigger === "retention_expired";
  const scope = resolveRetentionAndDeletionCleanupScope(input);
  const repositoryId = scope === "repository" ? input.repositoryId : undefined;
  const idempotencyKey = getHostedRetentionAndDeletionCleanupIdempotencyKey({
    trigger: input.trigger,
    installationId: input.installationId,
    repositoryId
  });
  const reportActions = planHostedCompactReportCleanup(input, scope);
  const queueActions = input.trigger === "retention_expired"
    ? emptyHostedQueueCleanupActions(input.jobs)
    : createHostedQueueCleanupPlan({
        trigger: input.trigger,
        installationId: input.installationId,
        repositoryId,
        requestedAt: input.requestedAt,
        jobs: input.jobs
      });
  const checkoutActions = retentionOnly
    ? emptyHostedWorkerCheckoutCleanupActions(input.workerCheckouts)
    : planHostedWorkerCheckoutCleanup(input, scope);

  return {
    trigger: input.trigger,
    scope,
    installationId: input.installationId,
    ...(repositoryId === undefined ? {} : { repositoryId }),
    requestedAt: input.requestedAt,
    idempotencyKey,
    idempotent: true,
    deleteCompactReportIds: reportActions.deleteIds,
    preserveCompactReportIds: reportActions.preserveIds,
    cancelQueuedJobKeys: queueActions.cancelQueuedJobKeys,
    requestRunningCancellationJobKeys: queueActions.requestRunningCancellationJobKeys,
    preserveTerminalJobKeys: queueActions.preserveTerminalJobKeys,
    keepUnmatchedJobKeys: queueActions.keepUnmatchedJobKeys,
    deleteWorkerCheckoutKeys: checkoutActions.deleteKeys,
    keepWorkerCheckoutKeys: checkoutActions.keepKeys,
    deleteCompactReports: true,
    cancelQueuedJobs: !retentionOnly,
    requestRunningCancellation: !retentionOnly,
    deleteWorkerCheckouts: !retentionOnly,
    shouldFetchRepository: false,
    shouldRequeueScans: false,
    deleteRawSource: false,
    deleteRawDiffs: false,
    deleteSecrets: false,
    deleteCustomerPayloads: false,
    deleteGitHubOwnedCheckRuns: false,
    preserveAuditRecord: true,
    auditRecordRetentionDays: resolveHostedAuditRecordRetentionDays(
      input.auditRecordRetentionDays
    ),
    auditRecord: {
      cleanupRequestId: idempotencyKey,
      trigger: input.trigger,
      status: "planned",
      installationId: input.installationId,
      ...(repositoryId === undefined ? {} : { repositoryId }),
      requestedAt: input.requestedAt
    },
    visibleUserMessage:
      "Hosted app-side compact reports and queued work are removed; GitHub-owned check runs remain in GitHub according to repository settings.",
    privacy: {
      includesRawSource: false,
      includesRawDiffs: false,
      includesSecrets: false,
      includesCustomerPayloads: false,
      includesWorkerCheckoutPaths: false,
      includesPrivateUrls: false,
      includesLowLevelCleanupErrors: false
    }
  };
}

export function evaluateHostedOperationalReleaseGate(
  input: HostedOperationalReleaseGateInput
): HostedOperationalReleaseGateDecision {
  const requiredEvidenceIds = HOSTED_OPERATIONAL_RELEASE_GATE_REQUIREMENTS.map(
    (requirement) => requirement.id
  );
  const evidenceById = new Map(input.evidence.map((evidence) => [evidence.id, evidence]));
  const maxEvidenceAgeDays = input.maxEvidenceAgeDays ?? 14;
  const passedEvidenceIds: HostedOperationalReleaseGateRequirementId[] = [];
  const missingEvidenceIds: HostedOperationalReleaseGateRequirementId[] = [];
  const failedEvidenceIds: HostedOperationalReleaseGateRequirementId[] = [];
  const staleEvidenceIds: HostedOperationalReleaseGateRequirementId[] = [];
  const exceptionEvidenceIds: HostedOperationalReleaseGateRequirementId[] = [];

  for (const evidenceId of requiredEvidenceIds) {
    const evidence = evidenceById.get(evidenceId);

    if (!evidence || evidence.status === "missing" || !hasHostedGateEvidenceReference(evidence)) {
      missingEvidenceIds.push(evidenceId);
      continue;
    }

    if (evidence.status === "failed") {
      failedEvidenceIds.push(evidenceId);
      continue;
    }

    if (evidence.status === "exception") {
      exceptionEvidenceIds.push(evidenceId);
      continue;
    }

    if (!isHostedGateEvidenceFresh(evidence, input.evaluatedAt, maxEvidenceAgeDays)) {
      staleEvidenceIds.push(evidenceId);
      continue;
    }

    passedEvidenceIds.push(evidenceId);
  }

  const releaseNotesForbiddenClaims = findHostedReleaseNoteForbiddenClaims(input.releaseNotes);
  const containerImageDigestRecorded = isHostedContainerImageDigest(input.containerImageDigest);
  const blocked =
    missingEvidenceIds.length > 0 ||
    failedEvidenceIds.length > 0 ||
    staleEvidenceIds.length > 0 ||
    exceptionEvidenceIds.length > 0 ||
    releaseNotesForbiddenClaims.length > 0 ||
    !containerImageDigestRecorded;

  return {
    commitSha: input.commitSha,
    scannerVersion: input.scannerVersion,
    deploymentTarget: input.deploymentTarget,
    evaluatedAt: input.evaluatedAt,
    requiredEvidenceCount: requiredEvidenceIds.length,
    requiredEvidenceIds,
    passedEvidenceIds,
    missingEvidenceIds,
    failedEvidenceIds,
    staleEvidenceIds,
    exceptionEvidenceIds,
    containerImageDigestRecorded,
    releaseNotesCompliant: releaseNotesForbiddenClaims.length === 0,
    releaseNotesForbiddenClaims,
    shouldExposeHostedEnvironment: !blocked,
    blocked,
    localCliBoundary: {
      localCliUsableWithoutHostedService: true,
      accountRequiredForLocalCli: false
    },
    visibleUserMessage: blocked
      ? "Hosted exposure is blocked until every P0 gate has fresh evidence and release notes avoid pentest, certification, and full-audit claims."
      : "Hosted exposure may proceed for this release candidate; keep the local CLI available without the hosted service.",
    privacy: {
      includesRawSource: false,
      includesRawDiffs: false,
      includesSecrets: false,
      includesCustomerPayloads: false,
      includesPrivateUrls: false,
      modelTraining: HOSTED_PRIVACY_DEFAULTS.modelTraining
    }
  };
}

function rejectWebhook(reason: WebhookRejectReason, deliveryId?: string): GitHubWebhookDecision {
  return {
    accepted: false,
    reason,
    shouldQueueScanJob: false,
    shouldFetchRepository: false,
    deliveryId
  };
}

function rejectPullRequestEvent(
  reason: PullRequestEventRejectReason,
  action?: string
): HostedPullRequestEventDecision {
  return {
    accepted: false,
    shouldQueueScanJob: false,
    reason,
    ...(action === undefined ? {} : { action })
  };
}

function rejectInstallationScope(reason: InstallationScopeRejectReason): InstallationScopeDecision {
  return {
    authorized: false,
    shouldFetchSource: false,
    reason
  };
}

function rejectPullRequestWebhookIntake(
  stage: HostedPullRequestWebhookIntakeStage,
  reason: HostedPullRequestWebhookIntakeRejectReason,
  deliveryId?: string,
  action?: string,
  identity?: HostedScanIdentity
): HostedPullRequestWebhookIntakeDecision {
  return {
    accepted: false,
    stage,
    reason,
    ...(deliveryId === undefined ? {} : { deliveryId }),
    ...(action === undefined ? {} : { action }),
    ...(identity === undefined ? {} : { identity }),
    shouldQueueScanJob: false,
    shouldFetchRepository: false,
    shouldCreateCheckRun: false,
    shouldCreatePrComment: false,
    privacy: hostedWebhookIntakePrivacy()
  };
}

function hostedWebhookIntakePrivacy(): HostedPullRequestWebhookIntakeDecision["privacy"] {
  return {
    includesRawWebhookPayload: false,
    includesUntrustedPrText: false,
    includesRawSource: false,
    includesRawDiffs: false,
    includesSecrets: false,
    includesCustomerPayloads: false
  };
}

function createHostedScanQueuePayload(
  record: HostedScanQueueRecord,
  deliveryId: string,
  requestedAt: string
): HostedScanQueuePayload {
  return {
    key: record.key,
    identity: record.identity,
    deliveryId,
    attempt: record.attempt,
    requestedAt,
    source: "github_pull_request"
  };
}

function cloneHostedScanQueueRecord(record: HostedScanQueueRecord): HostedScanQueueRecord {
  return {
    ...record,
    identity: { ...record.identity },
    deliveryIds: [...record.deliveryIds]
  };
}

function hostedScanQueuePrivacy(): HostedScanQueueUpsertDecision["privacy"] {
  return {
    includesRawSource: false,
    includesRawDiffs: false,
    includesSecrets: false,
    includesUntrustedPrText: false,
    includesCustomerPayloads: false
  };
}

function rejectHostedWorkerReadOnlyScan(
  input: HostedWorkerReadOnlyScanInput,
  reason: HostedWorkerReadOnlyScanRejectReason
): HostedWorkerReadOnlyScanPlan {
  return {
    accepted: false,
    reason,
    jobKey: input.jobKey,
    requestedAt: input.requestedAt,
    readOnly: true,
    shouldFetchSource: false,
    shouldRunCli: false,
    shouldPersistRawSource: false,
    shouldPersistRawDiffs: false,
    shouldCreatePrComment: false,
    privacy: hostedWorkerReadOnlyScanPrivacy()
  };
}

function hostedWorkerReadOnlyScanPrivacy(): HostedWorkerReadOnlyScanPlan["privacy"] {
  return {
    returnsCheckoutPath: false,
    includesRawSource: false,
    includesRawDiffs: false,
    includesSecrets: false,
    includesCustomerPayloads: false,
    acceptsRepositoryIdentityFromPrText: false,
    acceptsTokenScopeFromPrText: false,
    acceptsCommandFromPrText: false
  };
}

function rejectHostedCheckRunPublication(
  input: HostedCheckRunPublicationInput,
  reason: HostedCheckRunPublicationRejectReason
): HostedCheckRunPublicationPlan {
  return {
    accepted: false,
    reason,
    jobKey: input.jobKey,
    requestedAt: input.requestedAt,
    shouldWriteCheckRun: false,
    shouldCreatePrComment: false,
    shouldCallGitHubApi: false,
    privacy: hostedCheckRunPublicationPrivacy()
  };
}

function hostedCheckRunPublicationPrivacy(): HostedCheckRunPublicationPlan["privacy"] {
  return {
    includesRawSource: false,
    includesRawDiffs: false,
    includesSecrets: false,
    includesCustomerPayloads: false,
    includesUntrustedPrText: false,
    createsPrComment: false,
    modelTraining: HOSTED_PRIVACY_DEFAULTS.modelTraining
  };
}

function parseJsonPayload(payload: string | Buffer): unknown | undefined {
  try {
    return JSON.parse(Buffer.isBuffer(payload) ? payload.toString("utf8") : payload);
  } catch {
    return undefined;
  }
}

function queueCleanupMatches(
  job: HostedQueueCleanupJobState,
  input: HostedQueueCleanupPlanInput,
  scope: "repository" | "installation"
): boolean {
  if (job.identity.installationId !== input.installationId) {
    return false;
  }

  return scope === "installation" || job.identity.repositoryId === input.repositoryId;
}

function resolveRetentionAndDeletionCleanupScope(
  input: HostedRetentionAndDeletionCleanupInput
): "repository" | "installation" {
  if (input.trigger === "installation_deleted") {
    return "installation";
  }

  if (input.trigger === "retention_expired" && input.repositoryId === undefined) {
    return "installation";
  }

  return "repository";
}

function planHostedCompactReportCleanup(
  input: HostedRetentionAndDeletionCleanupInput,
  scope: "repository" | "installation"
): { deleteIds: string[]; preserveIds: string[] } {
  const deleteIds: string[] = [];
  const preserveIds: string[] = [];

  for (const report of input.compactReports) {
    const matchesScope = retentionCleanupMatchesReport(report, input, scope);
    const shouldDelete =
      matchesScope &&
      (input.trigger !== "retention_expired" ||
        isCompactReportExpired(report, input.requestedAt));

    if (shouldDelete) {
      deleteIds.push(report.id);
    } else {
      preserveIds.push(report.id);
    }
  }

  return { deleteIds, preserveIds };
}

function retentionCleanupMatchesReport(
  report: HostedCompactReportRetentionRecord,
  input: HostedRetentionAndDeletionCleanupInput,
  scope: "repository" | "installation"
): boolean {
  if (report.installationId !== input.installationId) {
    return false;
  }

  return scope === "installation" || report.repositoryId === input.repositoryId;
}

function isCompactReportExpired(
  report: HostedCompactReportRetentionRecord,
  requestedAt: string
): boolean {
  const requestedAtMs = Date.parse(requestedAt);
  if (!Number.isFinite(requestedAtMs)) {
    return false;
  }

  if (report.expiresAt !== undefined) {
    const expiresAtMs = Date.parse(report.expiresAt);
    return Number.isFinite(expiresAtMs) && expiresAtMs <= requestedAtMs;
  }

  const createdAtMs = Date.parse(report.createdAt);
  if (!Number.isFinite(createdAtMs)) {
    return false;
  }

  const retentionDays = resolveHostedRetentionDays({
    teamRequestedDays: report.retentionDays
  });
  return createdAtMs + retentionDays * 24 * 60 * 60 * 1000 <= requestedAtMs;
}

function emptyHostedQueueCleanupActions(
  jobs: HostedQueueCleanupJobState[]
): Pick<
  HostedQueueCleanupPlan,
  | "cancelQueuedJobKeys"
  | "requestRunningCancellationJobKeys"
  | "preserveTerminalJobKeys"
  | "keepUnmatchedJobKeys"
> {
  return {
    cancelQueuedJobKeys: [],
    requestRunningCancellationJobKeys: [],
    preserveTerminalJobKeys: [],
    keepUnmatchedJobKeys: jobs.map((job) => job.key)
  };
}

function planHostedWorkerCheckoutCleanup(
  input: HostedRetentionAndDeletionCleanupInput,
  scope: "repository" | "installation"
): { deleteKeys: string[]; keepKeys: string[] } {
  const deleteKeys: string[] = [];
  const keepKeys: string[] = [];

  for (const checkout of input.workerCheckouts) {
    const matchesScope = retentionCleanupMatchesIdentity(checkout.identity, input, scope);

    if (matchesScope && checkout.status !== "deleted") {
      deleteKeys.push(checkout.key);
    } else {
      keepKeys.push(checkout.key);
    }
  }

  return { deleteKeys, keepKeys };
}

function emptyHostedWorkerCheckoutCleanupActions(
  workerCheckouts: HostedWorkerCheckoutCleanupState[]
): { deleteKeys: string[]; keepKeys: string[] } {
  return {
    deleteKeys: [],
    keepKeys: workerCheckouts.map((checkout) => checkout.key)
  };
}

function retentionCleanupMatchesIdentity(
  identity: HostedScanIdentity,
  input: HostedRetentionAndDeletionCleanupInput,
  scope: "repository" | "installation"
): boolean {
  if (identity.installationId !== input.installationId) {
    return false;
  }

  return scope === "installation" || identity.repositoryId === input.repositoryId;
}

function resolveHostedAuditRecordRetentionDays(requestedDays?: number): number {
  if (requestedDays === undefined) {
    return HOSTED_PRIVACY_DEFAULTS.auditRecordRetentionDays;
  }

  return Math.min(
    HOSTED_PRIVACY_DEFAULTS.auditRecordRetentionDays,
    Math.max(1, Math.floor(requestedDays))
  );
}

function hasHostedGateEvidenceReference(
  evidence: HostedOperationalReleaseGateEvidence
): boolean {
  return Boolean(evidence.evidenceUrl?.trim() || evidence.note?.trim());
}

function isHostedGateEvidenceFresh(
  evidence: HostedOperationalReleaseGateEvidence,
  evaluatedAt: string,
  maxEvidenceAgeDays: number
): boolean {
  if (!evidence.collectedAt) {
    return false;
  }

  const collectedAtMs = Date.parse(evidence.collectedAt);
  const evaluatedAtMs = Date.parse(evaluatedAt);
  if (!Number.isFinite(collectedAtMs) || !Number.isFinite(evaluatedAtMs)) {
    return false;
  }

  const maxAgeMs = Math.max(0, Math.floor(maxEvidenceAgeDays)) * 24 * 60 * 60 * 1000;
  const evidenceAgeMs = evaluatedAtMs - collectedAtMs;
  return evidenceAgeMs >= 0 && evidenceAgeMs <= maxAgeMs;
}

function isHostedContainerImageDigest(digest?: string): boolean {
  return /^sha256:[a-f0-9]{64}$/i.test(digest ?? "");
}

function findHostedReleaseNoteForbiddenClaims(releaseNotes: string): string[] {
  const claims: string[] = [];
  const sentences = releaseNotes.split(/[.!?]\s+/).filter((sentence) => sentence.trim());

  if (
    sentences.some((sentence) =>
      hasPositiveHostedReleaseClaim(sentence, /\b(?:pentest|penetration test)\b/i)
    )
  ) {
    claims.push("pentest_claim");
  }

  if (
    sentences.some((sentence) =>
      hasPositiveHostedReleaseClaim(sentence, /\b(?:certification|certified)\b/i)
    )
  ) {
    claims.push("certification_claim");
  }

  if (
    sentences.some((sentence) =>
      hasPositiveHostedReleaseClaim(sentence, /\bfull(?:\s+security)?\s+audit\b/i)
    )
  ) {
    claims.push("full_audit_claim");
  }

  return claims;
}

function hasPositiveHostedReleaseClaim(sentence: string, termPattern: RegExp): boolean {
  const termRegex = new RegExp(termPattern.source, termPattern.flags.replace("g", ""));
  const termMatch = termRegex.exec(sentence);
  if (!termMatch || termMatch.index === undefined) {
    return false;
  }

  const prefix = sentence.slice(Math.max(0, termMatch.index - 120), termMatch.index);
  const lastClaimVerbIndex = lastRegexMatchIndex(
    prefix,
    /\b(?:is|are|as|provides?|delivers?|offers?|certifies?)\b/gi
  );
  if (lastClaimVerbIndex === -1) {
    return false;
  }

  const lastNegationIndex = lastRegexMatchIndex(
    prefix,
    /\b(?:not|never|does not|do not|is not|are not)\b/gi
  );
  return lastNegationIndex < lastClaimVerbIndex;
}

function lastRegexMatchIndex(value: string, pattern: RegExp): number {
  let lastIndex = -1;
  for (const match of value.matchAll(pattern)) {
    if (match.index !== undefined) {
      lastIndex = match.index;
    }
  }

  return lastIndex;
}

function isTerminalQueueStatus(status: HostedQueueJobStatus): boolean {
  return status === "completed" || status === "failed" || status === "cancelled";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function valueAsRecord(value: unknown): Record<string, unknown> | undefined {
  return isRecord(value) ? value : undefined;
}

function valueAsString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function valueAsNumber(value: unknown): number | undefined {
  return typeof value === "number" && Number.isSafeInteger(value) && value > 0
    ? value
    : undefined;
}

function resolveCheckRunConclusion(
  report: CompactHostedReport,
  failOnSeverity?: HostedCheckRunSeverityThreshold
): HostedCheckRunConclusion {
  if (getHostedReportFindingTotal(report) === 0) {
    return "success";
  }

  if (
    failOnSeverity &&
    report.evidence.some((finding) => severityRank(finding.severity) >= severityRanks[failOnSeverity])
  ) {
    return "failure";
  }

  return "neutral";
}

function getHostedReportFindingTotal(report: CompactHostedReport): number {
  const countedBySeverity = Object.entries(report.summaryCounts).reduce(
    (total, [severity, count]) =>
      severity === "total" ? total : total + (typeof count === "number" ? count : 0),
    0
  );
  const explicitTotal =
    typeof report.summaryCounts.total === "number" ? report.summaryCounts.total : 0;

  return Math.max(countedBySeverity, explicitTotal, report.evidence.length);
}

function hostedLaunchGateVerdict(report: CompactHostedReport): string {
  const summary = report.summaryCounts;
  if ((summary.critical ?? 0) > 0) {
    return "blocked";
  }
  if ((summary.high ?? 0) > 0) {
    return "review required";
  }
  if ((summary.medium ?? 0) > 0) {
    return "check before launch";
  }
  if ((summary.low ?? 0) > 0 || (summary.info ?? 0) > 0) {
    return "low-noise review";
  }
  return "clear from current heuristics";
}

function formatCheckRunTitle(
  totalFindings: number,
  conclusion: HostedCheckRunConclusion,
  failOnSeverity?: HostedCheckRunSeverityThreshold
): string {
  if (totalFindings === 0) {
    return "AI SaaS Guard found no launch-readiness findings";
  }

  if (conclusion === "failure" && failOnSeverity) {
    return `AI SaaS Guard found findings at or above ${failOnSeverity}`;
  }

  return `AI SaaS Guard found ${totalFindings} finding${totalFindings === 1 ? "" : "s"} to review`;
}

function formatCheckRunMarkdown(
  report: CompactHostedReport,
  conclusion: HostedCheckRunConclusion,
  localCliCommand: string,
  launchGate: string
): string {
  const categories = getHostedCheckRunCategories(report);
  const riskAreas = getHostedCheckRunRiskAreas(report);
  const filesToReview = getHostedCheckRunFiles(report);
  const findingLines =
    report.evidence.length === 0
      ? ["No findings in the compact hosted report."]
      : [
          "| Severity | Rule | Evidence |",
          "| --- | --- | --- |",
          ...report.evidence.map(
            (finding) =>
              `| ${escapeMarkdownTableCell(finding.severity)} | ${escapeMarkdownTableCell(
                finding.ruleId
              )} | ${escapeMarkdownTableCell(formatFindingLocation(finding))} |`
          )
        ];

  return [
    "### AI SaaS Guard Launch-risk gate",
    "",
    "Review task: inspect the files below before merge.",
    "Manual proof: prove changed auth, billing, data, deploy, or tests fail closed.",
    "Boundary: selected repository only; not an AI reviewer, pentest, full audit, or certification.",
    "",
    `Launch gate: ${launchGate}`,
    `Conclusion: ${conclusion}`,
    `Local CLI: \`${localCliCommand}\``,
    `Retention: compact report ${report.retentionDays} days; no raw source, diffs, secrets, or customer payloads.`,
    "",
    "Review categories:",
    ...(categories.length === 0 ? ["- None"] : categories.map((category) => `- ${category}`)),
    "",
    "Verification steps:",
    "- Inspect the listed files locally before release or merge.",
    "- Reproduce locally with the CLI command above.",
    "- Prove changed auth, billing, data, deploy, or tests fail closed.",
    "",
    "Risk areas:",
    ...(riskAreas.length === 0
      ? ["- None"]
      : riskAreas.map((area) => `- ${area.name}: ${area.count} finding(s). Proof: ${area.proof}`)),
    "",
    "Launch decision queue:",
    "- Can a real user get access they should not have?",
    "- Can the app claim success when something failed?",
    "- Can launch infrastructure do too much damage?",
    "",
    "Summary:",
    ...severityOrder.map(
      (severity) => `- ${capitalize(severity)}: ${report.summaryCounts[severity] ?? 0}`
    ),
    "",
    "Files to review first:",
    ...(filesToReview.length === 0 ? ["- None"] : filesToReview.map((file) => `- ${file}`)),
    "",
    "Launch-boundary reviewer checklist:",
    "- What changed at the launch boundary?",
    "- Why this auth billing data or deploy decision is safe?",
    "- What manual test proves it fails closed?",
    "",
    "Findings:",
    ...findingLines
  ].join("\n");
}

function truncateMarkdown(markdown: string, maxMarkdownChars?: number): string {
  const maxChars =
    maxMarkdownChars === undefined
      ? DEFAULT_CHECK_RUN_MARKDOWN_CHARS
      : Math.max(1, Math.floor(maxMarkdownChars));

  if (markdown.length <= maxChars) {
    return markdown;
  }

  const suffix =
    "\n\n_Additional findings truncated by hosted check output limit. Run the local CLI for the full report._";
  if (maxChars <= suffix.length) {
    return suffix.slice(0, maxChars);
  }

  return `${markdown.slice(0, maxChars - suffix.length).trimEnd()}${suffix}`;
}

function severityRank(severity: string): number {
  const normalized = severity.toLowerCase();
  return normalized in severityRanks
    ? severityRanks[normalized as HostedCheckRunSeverityThreshold]
    : 0;
}

function annotationLevelForSeverity(severity: string): HostedCheckRunAnnotationLevel {
  const rank = severityRank(severity);
  if (rank >= severityRanks.high) {
    return "failure";
  }

  if (rank >= severityRanks.medium) {
    return "warning";
  }

  return "notice";
}

function formatFindingLocation(finding: CompactHostedFinding): string {
  return `${finding.file}${finding.line === undefined ? "" : `:${finding.line}`}`;
}

function getHostedCheckRunCategories(report: CompactHostedReport): string[] {
  const categories = report.evidence.map((finding) => categoryForRuleId(finding.ruleId));
  return [...new Set(categories)];
}

function getHostedCheckRunRiskAreas(report: CompactHostedReport): Array<{
  key: string;
  name: string;
  proof: string;
  weight: number;
  count: number;
}> {
  const counts = new Map<
    string,
    { key: string; name: string; proof: string; weight: number; count: number }
  >();
  for (const finding of report.evidence) {
    const area = riskAreaForRuleId(finding.ruleId);
    counts.set(area.key, {
      ...area,
      count: (counts.get(area.key)?.count ?? 0) + 1
    });
  }

  return [...counts.values()].sort((a, b) => {
    if (b.weight !== a.weight) return b.weight - a.weight;
    return b.count - a.count;
  });
}

function riskAreaForRuleId(ruleId: string): {
  key: string;
  name: string;
  proof: string;
  weight: number;
} {
  if (/^(auth|api)\./.test(ruleId)) {
    return {
      key: "auth",
      name: "Auth and session",
      proof: "use two accounts and confirm access, session, and ownership checks fail closed",
      weight: 50
    };
  }
  if (/^stripe\./.test(ruleId)) {
    return {
      key: "billing",
      name: "Billing and entitlement",
      proof: "force unsigned, duplicate, failed, and canceled billing events before granting access",
      weight: 50
    };
  }
  if (/^(supabase|data)\./.test(ruleId)) {
    return {
      key: "data",
      name: "Tenant data access",
      proof: "run cross-tenant SELECT, INSERT, UPDATE, and DELETE checks with user A and user B",
      weight: 45
    };
  }
  if (/^(deploy|secrets|mcp|actions)\./.test(ruleId)) {
    return {
      key: "deploy",
      name: "Deploy, secrets, tools, and permissions",
      proof: "confirm production env, workflow permissions, and tool scopes are least privilege",
      weight: 35
    };
  }
  if (/^silent-success\.|weakened-test|test/i.test(ruleId)) {
    return {
      key: "tests",
      name: "Tests and silent success",
      proof: "make the upstream path fail and confirm tests catch an error instead of fake success",
      weight: 40
    };
  }
  return {
    key: "pr",
    name: "PR trust boundary",
    proof: "explain the trust-boundary decision and prove the changed path fails closed",
    weight: 30
  };
}

function categoryForRuleId(ruleId: string): string {
  const prefix = ruleId.split(".")[0] ?? "review";
  const categoryNames: Record<string, string> = {
    api: "API routes",
    deploy: "Deploy config",
    mcp: "MCP tools",
    pr: "Pull request risk",
    "pr-risk": "Pull request risk",
    secrets: "Secrets and env",
    stripe: "Stripe billing",
    supabase: "Supabase data access"
  };

  return categoryNames[prefix] ?? capitalize(prefix);
}

function getHostedCheckRunFiles(report: CompactHostedReport): string[] {
  return [...new Set(report.evidence.map((finding) => finding.file))].slice(0, 10);
}

function escapeMarkdownTableCell(value: string): string {
  return value.replaceAll("\\", "\\\\").replaceAll("|", "\\|").replaceAll("\r", " ").replaceAll("\n", " ");
}

function capitalize(value: string): string {
  return `${value.charAt(0).toUpperCase()}${value.slice(1)}`;
}

function parseSha256Signature(signatureHeader: string): Buffer | undefined {
  const match = /^sha256=([0-9a-f]{64})$/i.exec(signatureHeader.trim());
  if (!match?.[1]) {
    return undefined;
  }

  return Buffer.from(match[1], "hex");
}
