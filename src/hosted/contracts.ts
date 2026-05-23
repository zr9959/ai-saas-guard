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

  return {
    name: CHECK_RUN_NAME,
    conclusion,
    output: {
      title: formatCheckRunTitle(totalFindings, conclusion, input.failOnSeverity),
      summary:
        "Review first: verify this launch-readiness signal before release; it is not a full security audit, pentest, or certification.",
      text: truncateMarkdown(
        formatCheckRunMarkdown(report, conclusion, localCliCommand),
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
    auditRecordRetentionDays:
      input.auditRecordRetentionDays ?? HOSTED_PRIVACY_DEFAULTS.auditRecordRetentionDays,
    visibleUserMessage:
      "Hosted app-side compact reports and queued work are removed; GitHub-owned check runs remain in GitHub according to repository settings."
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
  localCliCommand: string
): string {
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
    "### AI SaaS Guard",
    "",
    "Review first: verify findings locally before launch. This hosted check is not a full security audit, pentest, or certification.",
    "",
    `Conclusion: ${conclusion}`,
    `Local CLI: \`${localCliCommand}\``,
    `Retention: compact report ${report.retentionDays} days; raw source, raw diffs, secrets, and customer payloads are not retained.`,
    "",
    "Summary:",
    ...severityOrder.map(
      (severity) => `- ${capitalize(severity)}: ${report.summaryCounts[severity] ?? 0}`
    ),
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

function escapeMarkdownTableCell(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
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
