import {
  authorizeInstallationTokenScope,
  createCompactHostedReport,
  createHostedWorkerCheckoutCleanupPlan,
  parseHostedPullRequestEvent,
  planHostedCheckRunPublication,
  planHostedScanQueueUpsert,
  planHostedWorkerReadOnlyScan,
  verifyGitHubWebhook,
  type CompactHostedFinding,
  type CompactHostedReport,
  type HostedCheckRunPublicationPlan,
  type HostedScanQueueRecord,
  type HostedScanQueueUpsertDecision,
  type HostedWorkerCheckoutCleanupPlan,
  type HostedWorkerReadOnlyScanPlan,
  type WebhookRejectReason
} from "./contracts.js";

type RepositoryIdSource = Record<number, number[]> | Map<number, number[]>;

export interface HostedServiceWebhookRequest {
  payload: string | Buffer;
  signatureHeader?: string;
  deliveryId?: string;
  manualRerun?: boolean;
  allowDraft?: boolean;
}

export type HostedServiceWebhookStage =
  | "signature"
  | "payload"
  | "event"
  | "installation_scope"
  | "queue";

export interface HostedServiceWebhookResult {
  accepted: boolean;
  stage: HostedServiceWebhookStage;
  reason?: string;
  deliveryId?: string;
  queueDecision?: HostedScanQueueUpsertDecision;
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

export interface HostedServiceQueueAdapter {
  records: Map<string, HostedScanQueueRecord>;
}

export interface HostedCompactReportStoreRecord {
  id: string;
  jobKey: string;
  createdAt: string;
  report: CompactHostedReport;
}

export interface HostedCompactReportStore {
  records?: HostedCompactReportStoreRecord[];
  save(record: HostedCompactReportStoreRecord): Promise<void> | void;
}

export interface HostedCheckRunRequest {
  method: "POST";
  endpoint: string;
  payload: NonNullable<HostedCheckRunPublicationPlan["request"]>["payload"];
}

export interface HostedCheckRunPublisher {
  requests?: HostedCheckRunRequest[];
  publish(request: HostedCheckRunRequest): Promise<void> | void;
}

export interface HostedServiceScanRunnerResult {
  summaryCounts: Record<string, number>;
  findings: CompactHostedFinding[];
  retentionDays?: number;
  rawSource?: string;
  rawDiff?: string;
  secretValues?: string[];
  customerPayload?: unknown;
}

export interface HostedServiceScanRunnerInput {
  plan: HostedWorkerReadOnlyScanPlan & { accepted: true };
  queueRecord: HostedScanQueueRecord;
}

export type HostedServiceScanRunner = (
  input: HostedServiceScanRunnerInput
) => Promise<HostedServiceScanRunnerResult> | HostedServiceScanRunnerResult;

export interface HostedServiceRuntimeOptions {
  signingKey: string | Buffer;
  scannerVersion: string;
  selectedRepositoryIdsByInstallation: RepositoryIdSource;
  removedRepositoryIdsByInstallation?: RepositoryIdSource;
  queue: HostedServiceQueueAdapter;
  compactReportStore: HostedCompactReportStore;
  checkRunPublisher: HostedCheckRunPublisher;
  scanRunner: HostedServiceScanRunner;
  now?: () => string;
}

export interface HostedServiceRuntime {
  handlePullRequestWebhook(request: HostedServiceWebhookRequest): HostedServiceWebhookResult;
  runNextQueuedScan(): Promise<HostedServiceWorkerResult>;
}

export type HostedServiceWorkerResult =
  | {
      processed: false;
      reason: "empty_queue";
    }
  | {
      processed: true;
      status: "completed";
      queueRecord: HostedScanQueueRecord;
      workerPlan: HostedWorkerReadOnlyScanPlan & { accepted: true };
      report: CompactHostedReport;
      checkRunPublication: HostedCheckRunPublicationPlan;
      cleanup: HostedWorkerCheckoutCleanupPlan;
    }
  | {
      processed: true;
      status: "failed";
      queueRecord: HostedScanQueueRecord;
      reason?: string;
      errorClass: "worker_plan_rejected" | "check_run_publication_rejected" | "scan_runner_failed";
      workerPlan?: HostedWorkerReadOnlyScanPlan;
      checkRunPublication?: HostedCheckRunPublicationPlan;
      cleanup?: HostedWorkerCheckoutCleanupPlan;
    };

export interface InMemoryHostedServiceAdapters {
  queue: HostedServiceQueueAdapter;
  compactReportStore: HostedCompactReportStore & { records: HostedCompactReportStoreRecord[] };
  checkRunPublisher: HostedCheckRunPublisher & { requests: HostedCheckRunRequest[] };
}

export function createInMemoryHostedServiceAdapters(): InMemoryHostedServiceAdapters {
  const compactReportRecords: HostedCompactReportStoreRecord[] = [];
  const checkRunRequests: HostedCheckRunRequest[] = [];

  return {
    queue: { records: new Map() },
    compactReportStore: {
      records: compactReportRecords,
      save(record) {
        compactReportRecords.push(record);
      }
    },
    checkRunPublisher: {
      requests: checkRunRequests,
      publish(request) {
        checkRunRequests.push(request);
      }
    }
  };
}

export function createHostedServiceRuntime(
  options: HostedServiceRuntimeOptions
): HostedServiceRuntime {
  const seenDeliveryIds = new Set<string>();
  const now = options.now ?? (() => new Date().toISOString());

  return {
    handlePullRequestWebhook(request) {
      const signatureDecision = verifyGitHubWebhook({
        payload: request.payload,
        signatureHeader: request.signatureHeader,
        signingKey: options.signingKey,
        deliveryId: request.deliveryId,
        seenDeliveryIds
      });

      if (!signatureDecision.accepted) {
        return rejectWebhookRequest(
          "signature",
          signatureDecision.reason ?? "invalid_signature",
          request.deliveryId
        );
      }

      if (!request.deliveryId) {
        return rejectWebhookRequest("event", "missing_delivery_id");
      }

      const parsedPayload = parseWebhookPayload(request.payload);
      if (!parsedPayload) {
        return rejectWebhookRequest("payload", "invalid_json", request.deliveryId);
      }

      const eventDecision = parseHostedPullRequestEvent({
        payload: parsedPayload,
        scannerVersion: options.scannerVersion,
        allowDraft: request.allowDraft
      });

      if (!eventDecision.accepted || !eventDecision.identity) {
        return rejectWebhookRequest(
          "event",
          eventDecision.reason ?? "missing_required_field",
          request.deliveryId
        );
      }

      const selectedRepositoryIds = repositoryIdsFor(
        options.selectedRepositoryIdsByInstallation,
        eventDecision.identity.installationId
      );
      const removedRepositoryIds = repositoryIdsFor(
        options.removedRepositoryIdsByInstallation,
        eventDecision.identity.installationId
      );
      const scopeDecision = authorizeInstallationTokenScope({
        identity: eventDecision.identity,
        installationId: eventDecision.identity.installationId,
        selectedRepositoryIds,
        removedRepositoryIds
      });

      if (!scopeDecision.authorized) {
        return rejectWebhookRequest(
          "installation_scope",
          scopeDecision.reason ?? "repository_not_installed",
          request.deliveryId
        );
      }

      const queueDecision = planHostedScanQueueUpsert({
        identity: eventDecision.identity,
        deliveryId: request.deliveryId,
        requestedAt: now(),
        queue: options.queue.records,
        manualRerun: request.manualRerun
      });

      return {
        accepted: true,
        stage: "queue",
        deliveryId: request.deliveryId,
        queueDecision,
        shouldFetchRepository: queueDecision.shouldEnqueueWorker,
        shouldCreateCheckRun: queueDecision.shouldCreateCheckRun,
        shouldCreatePrComment: false,
        privacy: hostedServiceWebhookPrivacy()
      };
    },

    async runNextQueuedScan() {
      const queuedRecord = nextQueuedRecord(options.queue.records);
      if (!queuedRecord) {
        return { processed: false, reason: "empty_queue" };
      }

      const requestedAt = now();
      queuedRecord.status = "running";
      queuedRecord.updatedAt = requestedAt;
      const selectedRepositoryIds = repositoryIdsFor(
        options.selectedRepositoryIdsByInstallation,
        queuedRecord.identity.installationId
      );
      const removedRepositoryIds = repositoryIdsFor(
        options.removedRepositoryIdsByInstallation,
        queuedRecord.identity.installationId
      );

      const workerPlan = planHostedWorkerReadOnlyScan({
        identity: queuedRecord.identity,
        jobKey: queuedRecord.key,
        requestedAt,
        installationId: queuedRecord.identity.installationId,
        selectedRepositoryIds,
        removedRepositoryIds,
        installationTokenPermissions: { contents: "read" }
      });

      if (!workerPlan.accepted) {
        queuedRecord.status = "failed";
        queuedRecord.updatedAt = now();
        return {
          processed: true,
          status: "failed",
          queueRecord: cloneQueueRecord(queuedRecord),
          reason: workerPlan.reason,
          errorClass: "worker_plan_rejected",
          workerPlan
        };
      }

      const acceptedWorkerPlan = workerPlan as HostedWorkerReadOnlyScanPlan & { accepted: true };

      try {
        const scanResult = await options.scanRunner({
          plan: acceptedWorkerPlan,
          queueRecord: cloneQueueRecord(queuedRecord)
        });
        const report = createCompactHostedReport({
          identity: queuedRecord.identity,
          summaryCounts: scanResult.summaryCounts,
          findings: scanResult.findings,
          retentionDays: scanResult.retentionDays,
          rawDiff: scanResult.rawDiff,
          secretValues: scanResult.secretValues,
          customerPayload: scanResult.customerPayload
        });
        const reportId = `${queuedRecord.key}:${queuedRecord.attempt}`;
        await options.compactReportStore.save({
          id: reportId,
          jobKey: queuedRecord.key,
          createdAt: now(),
          report
        });

        const checkRunPublication = planHostedCheckRunPublication({
          identity: queuedRecord.identity,
          report,
          jobKey: queuedRecord.key,
          requestedAt: now(),
          installationId: queuedRecord.identity.installationId,
          selectedRepositoryIds,
          removedRepositoryIds,
          installationTokenPermissions: { checks: "write" }
        });

        if (!checkRunPublication.accepted || !checkRunPublication.request) {
          queuedRecord.status = "failed";
          queuedRecord.updatedAt = now();
          return {
            processed: true,
            status: "failed",
            queueRecord: cloneQueueRecord(queuedRecord),
            reason: checkRunPublication.reason,
            errorClass: "check_run_publication_rejected",
            workerPlan: acceptedWorkerPlan,
            checkRunPublication
          };
        }

        await options.checkRunPublisher.publish(checkRunPublication.request);
        const cleanup = createHostedWorkerCheckoutCleanupPlan({
          identity: queuedRecord.identity,
          jobKey: queuedRecord.key,
          terminalState: "success",
          finishedAt: now()
        });
        queuedRecord.status = "completed";
        queuedRecord.reportId = reportId;
        queuedRecord.updatedAt = now();

        return {
          processed: true,
          status: "completed",
          queueRecord: cloneQueueRecord(queuedRecord),
          workerPlan: acceptedWorkerPlan,
          report,
          checkRunPublication,
          cleanup
        };
      } catch (error) {
        const cleanup = createHostedWorkerCheckoutCleanupPlan({
          identity: queuedRecord.identity,
          jobKey: queuedRecord.key,
          terminalState: "failure",
          finishedAt: now()
        });
        queuedRecord.status = "failed";
        queuedRecord.updatedAt = now();

        return {
          processed: true,
          status: "failed",
          queueRecord: cloneQueueRecord(queuedRecord),
          reason: safeScanRunnerFailureReason(error),
          errorClass: "scan_runner_failed",
          workerPlan: acceptedWorkerPlan,
          cleanup
        };
      }
    }
  };
}

function safeScanRunnerFailureReason(error: unknown): string {
  if (
    typeof error === "object" &&
    error !== null &&
    "safeReason" in error &&
    typeof error.safeReason === "string" &&
    /^[a-z][a-z0-9_]{1,80}$/.test(error.safeReason)
  ) {
    return error.safeReason;
  }

  return "scan_runner_failed";
}

function rejectWebhookRequest(
  stage: HostedServiceWebhookStage,
  reason: WebhookRejectReason | string,
  deliveryId?: string
): HostedServiceWebhookResult {
  return {
    accepted: false,
    stage,
    reason,
    ...(deliveryId === undefined ? {} : { deliveryId }),
    shouldFetchRepository: false,
    shouldCreateCheckRun: false,
    shouldCreatePrComment: false,
    privacy: hostedServiceWebhookPrivacy()
  };
}

function hostedServiceWebhookPrivacy(): HostedServiceWebhookResult["privacy"] {
  return {
    includesRawWebhookPayload: false,
    includesUntrustedPrText: false,
    includesRawSource: false,
    includesRawDiffs: false,
    includesSecrets: false,
    includesCustomerPayloads: false
  };
}

function parseWebhookPayload(payload: string | Buffer): unknown | undefined {
  try {
    return JSON.parse(Buffer.isBuffer(payload) ? payload.toString("utf8") : payload);
  } catch {
    return undefined;
  }
}

function repositoryIdsFor(source: RepositoryIdSource | undefined, installationId: number): number[] {
  if (!source) {
    return [];
  }

  if (source instanceof Map) {
    return source.get(installationId) ?? [];
  }

  return source[installationId] ?? [];
}

function nextQueuedRecord(
  records: Map<string, HostedScanQueueRecord>
): HostedScanQueueRecord | undefined {
  for (const record of records.values()) {
    if (record.status === "queued") {
      return record;
    }
  }

  return undefined;
}

function cloneQueueRecord(record: HostedScanQueueRecord): HostedScanQueueRecord {
  return {
    ...record,
    identity: { ...record.identity },
    deliveryIds: [...record.deliveryIds]
  };
}
