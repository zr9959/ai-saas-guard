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
      shouldCreatePrComment: true
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

function rejectInstallationScope(reason: InstallationScopeRejectReason): InstallationScopeDecision {
  return {
    authorized: false,
    shouldFetchSource: false,
    reason
  };
}

function parseSha256Signature(signatureHeader: string): Buffer | undefined {
  const match = /^sha256=([0-9a-f]{64})$/i.exec(signatureHeader.trim());
  if (!match?.[1]) {
    return undefined;
  }

  return Buffer.from(match[1], "hex");
}
