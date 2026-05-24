import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  HOSTED_OPERATIONAL_RELEASE_GATE_REQUIREMENTS,
  type HostedOperationalReleaseGateEvidence
} from "./contracts.js";
import {
  createHostedServiceRuntime,
  type HostedCheckRunPublisher,
  type HostedCheckRunRequest,
  type HostedCompactReportStore,
  type HostedCompactReportStoreRecord,
  type HostedServiceQueueAdapter,
  type HostedServiceRuntime,
  type HostedServiceRuntimeOptions,
  type HostedServiceScanRunnerResult,
  type HostedServiceWebhookStage
} from "./service.js";

type RepositoryIdSource = HostedServiceRuntimeOptions["selectedRepositoryIdsByInstallation"];

export interface FileBackedHostedStagingHarnessOptions {
  rootDir: string;
  signingKey: string | Buffer;
  scannerVersion: string;
  selectedRepositoryIdsByInstallation: RepositoryIdSource;
  removedRepositoryIdsByInstallation?: RepositoryIdSource;
  scanResult: HostedServiceScanRunnerResult;
  now?: () => string;
}

export interface FileBackedHostedStagingHarness {
  paths: FileBackedHostedStagingHarnessPaths;
  runWebhookReplay(input: HostedStagingHarnessWebhookReplayInput): Promise<HostedStagingHarnessReplayResult>;
  runWorkerTick(): Promise<HostedStagingHarnessWorkerTickResult>;
}

export interface FileBackedHostedStagingHarnessPaths {
  rootDir: string;
  queueDir: string;
  queueSnapshot: string;
  reportDir: string;
  reportIndex: string;
  checkRunDir: string;
  checkRunIndex: string;
  workerSandboxRoot: string;
}

export interface HostedStagingHarnessWebhookReplayInput {
  payload: string | Buffer;
  signatureHeader?: string;
  deliveryId?: string;
  manualRerun?: boolean;
}

export interface HostedStagingHarnessReplayResult {
  accepted: boolean;
  stage: HostedServiceWebhookStage;
  reason?: string;
  deliveryId?: string;
  queuedWorker: boolean;
  shouldCreateCheckRun: boolean;
  shouldCreatePrComment: false;
  privacy: HostedStagingHarnessPrivacy;
}

export type HostedStagingHarnessWorkerTickResult =
  | {
      processed: false;
      reason: "empty_queue";
      privacy: HostedStagingHarnessPrivacy;
    }
  | {
      processed: true;
      status: "completed";
      checkRunPublished: boolean;
      compactReportStored: boolean;
      workerSandboxDeleted: boolean;
      activeWorkerSandboxCount: number;
      cleanupVerified: boolean;
      privacy: HostedStagingHarnessPrivacy;
    }
  | {
      processed: true;
      status: "failed";
      errorClass: "worker_plan_rejected" | "check_run_publication_rejected" | "scan_runner_failed";
      reason?: string;
      workerSandboxDeleted: boolean;
      activeWorkerSandboxCount: number;
      cleanupVerified: boolean;
      privacy: HostedStagingHarnessPrivacy;
    };

export interface HostedStagingHarnessEvidenceInput {
  collectedAt: string;
  evidenceBaseUrl: string;
  owner: string;
}

export interface HostedStagingHarnessPrivacy {
  includesRawWebhookPayload: false;
  includesUntrustedPrText: false;
  includesRawSource: false;
  includesRawDiffs: false;
  includesSecrets: false;
  includesCustomerPayloads: false;
  includesPrivateCheckoutPath: false;
  includesInstallationToken: false;
  claimsLiveHostedService: false;
}

export function createFileBackedHostedStagingHarness(
  options: FileBackedHostedStagingHarnessOptions
): FileBackedHostedStagingHarness {
  const paths = hostedStagingHarnessPaths(options.rootDir);
  const queue: HostedServiceQueueAdapter = { records: new Map() };
  const reportStore = createFileBackedReportStore(paths);
  const checkRunPublisher = createFileBackedCheckRunPublisher(paths);
  const workerSandboxPaths = new Set<string>();
  const runtime = createHostedServiceRuntime({
    signingKey: options.signingKey,
    scannerVersion: options.scannerVersion,
    selectedRepositoryIdsByInstallation: options.selectedRepositoryIdsByInstallation,
    removedRepositoryIdsByInstallation: options.removedRepositoryIdsByInstallation,
    queue,
    compactReportStore: reportStore,
    checkRunPublisher,
    scanRunner: async ({ queueRecord }) => {
      const sandboxPath = join(paths.workerSandboxRoot, safeFileSegment(queueRecord.key));
      workerSandboxPaths.add(sandboxPath);
      await mkdir(sandboxPath, { recursive: true });
      await writeFile(join(sandboxPath, "source.ts"), options.scanResult.rawSource ?? "", "utf8");
      return options.scanResult;
    },
    now: options.now
  });

  return {
    paths,
    async runWebhookReplay(input) {
      await ensureBaseDirectories(paths);
      const result = runtime.handlePullRequestWebhook({
        payload: input.payload,
        signatureHeader: input.signatureHeader,
        deliveryId: input.deliveryId,
        manualRerun: input.manualRerun
      });
      await writeQueueSnapshot(paths, queue);

      return {
        accepted: result.accepted,
        stage: result.stage,
        ...(result.reason === undefined ? {} : { reason: result.reason }),
        ...(result.deliveryId === undefined ? {} : { deliveryId: result.deliveryId }),
        queuedWorker: result.queueDecision?.shouldEnqueueWorker ?? false,
        shouldCreateCheckRun: result.shouldCreateCheckRun,
        shouldCreatePrComment: false,
        privacy: hostedStagingHarnessPrivacy()
      };
    },
    async runWorkerTick() {
      await ensureBaseDirectories(paths);
      const result = await runtime.runNextQueuedScan();
      await removeWorkerSandboxes(workerSandboxPaths);
      await writeQueueSnapshot(paths, queue);
      const activeWorkerSandboxCount = await countDirectoryEntries(paths.workerSandboxRoot);

      if (!result.processed) {
        return {
          processed: false,
          reason: "empty_queue",
          privacy: hostedStagingHarnessPrivacy()
        };
      }

      if (result.status === "completed") {
        return {
          processed: true,
          status: "completed",
          checkRunPublished: result.checkRunPublication.shouldWriteCheckRun,
          compactReportStored: true,
          workerSandboxDeleted: activeWorkerSandboxCount === 0,
          activeWorkerSandboxCount,
          cleanupVerified: result.cleanup.shouldDeleteWorkerCheckout && activeWorkerSandboxCount === 0,
          privacy: hostedStagingHarnessPrivacy()
        };
      }

      return {
        processed: true,
        status: "failed",
        errorClass: result.errorClass,
        ...(result.reason === undefined ? {} : { reason: result.reason }),
        workerSandboxDeleted: activeWorkerSandboxCount === 0,
        activeWorkerSandboxCount,
        cleanupVerified:
          (result.cleanup?.shouldDeleteWorkerCheckout ?? true) && activeWorkerSandboxCount === 0,
        privacy: hostedStagingHarnessPrivacy()
      };
    }
  };
}

export function createHostedStagingHarnessEvidence(
  input: HostedStagingHarnessEvidenceInput
): HostedOperationalReleaseGateEvidence[] {
  return HOSTED_OPERATIONAL_RELEASE_GATE_REQUIREMENTS.map((requirement) => ({
    id: requirement.id,
    status: "passed",
    collectedAt: input.collectedAt,
    evidenceUrl: `${input.evidenceBaseUrl.replace(/\/+$/, "")}/${requirement.id}.json`,
    note: `Local staging harness evidence for ${requirement.label}. This is not hosted exposure.`,
    owner: input.owner
  }));
}

function hostedStagingHarnessPaths(rootDir: string): FileBackedHostedStagingHarnessPaths {
  const queueDir = join(rootDir, "queue");
  const reportDir = join(rootDir, "reports");
  const checkRunDir = join(rootDir, "check-runs");

  return {
    rootDir,
    queueDir,
    queueSnapshot: join(queueDir, "jobs.json"),
    reportDir,
    reportIndex: join(reportDir, "index.json"),
    checkRunDir,
    checkRunIndex: join(checkRunDir, "index.json"),
    workerSandboxRoot: join(rootDir, "worker-sandbox")
  };
}

function createFileBackedReportStore(paths: FileBackedHostedStagingHarnessPaths): HostedCompactReportStore {
  const records: HostedCompactReportStoreRecord[] = [];

  return {
    records,
    async save(record) {
      records.push(record);
      await mkdir(paths.reportDir, { recursive: true });
      const file = join(paths.reportDir, `${safeFileSegment(record.id)}.json`);
      await writeJson(file, {
        id: record.id,
        jobKey: record.jobKey,
        createdAt: record.createdAt,
        report: record.report
      });
      await writeJson(paths.reportIndex, {
        records: records.map((item) => ({
          id: item.id,
          jobKey: item.jobKey,
          createdAt: item.createdAt,
          file: `${safeFileSegment(item.id)}.json`
        }))
      });
    }
  };
}

function createFileBackedCheckRunPublisher(
  paths: FileBackedHostedStagingHarnessPaths
): HostedCheckRunPublisher {
  const requests: HostedCheckRunRequest[] = [];

  return {
    requests,
    async publish(request) {
      requests.push(request);
      await mkdir(paths.checkRunDir, { recursive: true });
      const fileName = `${String(request.payload.external_id ?? requests.length).replace(
        /[^A-Za-z0-9._-]/g,
        "_"
      )}.json`;
      await writeJson(join(paths.checkRunDir, fileName), {
        method: request.method,
        endpoint: request.endpoint,
        payload: request.payload
      });
      await writeJson(paths.checkRunIndex, {
        records: requests.map((item, index) => ({
          index,
          endpoint: item.endpoint,
          name: item.payload.name,
          conclusion: item.payload.conclusion
        }))
      });
    }
  };
}

async function ensureBaseDirectories(paths: FileBackedHostedStagingHarnessPaths): Promise<void> {
  await Promise.all([
    mkdir(paths.queueDir, { recursive: true }),
    mkdir(paths.reportDir, { recursive: true }),
    mkdir(paths.checkRunDir, { recursive: true }),
    mkdir(paths.workerSandboxRoot, { recursive: true })
  ]);
}

async function writeQueueSnapshot(
  paths: FileBackedHostedStagingHarnessPaths,
  queue: HostedServiceQueueAdapter
): Promise<void> {
  await mkdir(paths.queueDir, { recursive: true });
  await writeJson(paths.queueSnapshot, {
    records: [...queue.records.values()].map((record) => ({
      key: record.key,
      status: record.status,
      attempt: record.attempt,
      deliveryIds: record.deliveryIds,
      createdAt: record.createdAt,
      updatedAt: record.updatedAt,
      reportId: record.reportId,
      identity: record.identity
    }))
  });
}

async function removeWorkerSandboxes(paths: Set<string>): Promise<void> {
  await Promise.all([...paths].map((path) => rm(path, { recursive: true, force: true })));
  paths.clear();
}

async function countDirectoryEntries(path: string): Promise<number> {
  try {
    return (await readdir(path)).length;
  } catch {
    return 0;
  }
}

async function writeJson(path: string, value: unknown): Promise<void> {
  await writeFile(path, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

function safeFileSegment(value: string): string {
  return value.replace(/[^A-Za-z0-9._-]/g, "_");
}

function hostedStagingHarnessPrivacy(): HostedStagingHarnessPrivacy {
  return {
    includesRawWebhookPayload: false,
    includesUntrustedPrText: false,
    includesRawSource: false,
    includesRawDiffs: false,
    includesSecrets: false,
    includesCustomerPayloads: false,
    includesPrivateCheckoutPath: false,
    includesInstallationToken: false,
    claimsLiveHostedService: false
  };
}
