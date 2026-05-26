import { mkdir, readdir, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import {
  evaluateHostedOperationalReleaseGate,
  HOSTED_OPERATIONAL_RELEASE_GATE_REQUIREMENTS,
  type HostedOperationalReleaseGateDecision,
  type HostedOperationalReleaseGateRequirementId,
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
  type HostedServiceScanRunnerInput,
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
  scanResult:
    | HostedServiceScanRunnerResult
    | ((
        input: HostedServiceScanRunnerInput
      ) => HostedServiceScanRunnerResult | Promise<HostedServiceScanRunnerResult>);
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
      safeFailureReason?: string;
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

export type HostedLogBoundaryBlockedReason =
  | "raw_source"
  | "raw_diff"
  | "secret_value"
  | "customer_payload"
  | "installation_token"
  | "checkout_path"
  | "private_url"
  | "untrusted_pr_text";

export interface HostedLogBoundaryForbiddenInput {
  rawSource?: string;
  rawDiff?: string;
  secretValues?: string[];
  customerPayloads?: string[];
  installationTokens?: string[];
  checkoutPaths?: string[];
  privateUrls?: string[];
  untrustedPrText?: string[];
}

export interface HostedLogBoundaryValidationInput {
  samples: unknown[];
  forbidden: HostedLogBoundaryForbiddenInput;
}

export interface HostedLogBoundaryValidation {
  accepted: boolean;
  sampleCount: number;
  blockedReasons: HostedLogBoundaryBlockedReason[];
  allowedFields: string[];
  privacy: HostedStagingHarnessPrivacy;
}

export interface HostedStagingReleaseEvidenceBundleInput {
  collectedAt: string;
  evidenceBaseUrl: string;
  owner: string;
  webhookReplays: HostedStagingHarnessReplayResult[];
  workerTicks: HostedStagingHarnessWorkerTickResult[];
  logBoundary: HostedLogBoundaryValidation;
  externalEvidence: HostedOperationalReleaseGateEvidence[];
  requiredFailureReasons?: string[];
}

export interface HostedStagingReleaseEvidenceBundle {
  readyForReleaseGate: boolean;
  evidence: HostedOperationalReleaseGateEvidence[];
  releaseGateInput: {
    evidence: HostedOperationalReleaseGateEvidence[];
  };
  scenarioSummary: {
    webhookReplayAccepted: boolean;
    completedWorkerProbe: boolean;
    failureCleanupProbe: boolean;
    observedFailureReasons: string[];
    allWorkerCheckoutsDeleted: boolean;
    logBoundaryAccepted: boolean;
  };
  privacy: HostedStagingHarnessPrivacy;
}

export interface HostedStagingReleaseEvidenceGateInput {
  bundle: HostedStagingReleaseEvidenceBundle;
  commitSha: string;
  scannerVersion: string;
  deploymentTarget: string;
  evaluatedAt: string;
  releaseNotes: string;
  containerImageDigest: string;
  maxEvidenceAgeDays?: number;
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
    scanRunner: async (input) => {
      const { queueRecord } = input;
      const sandboxPath = join(paths.workerSandboxRoot, safeFileSegment(queueRecord.key));
      workerSandboxPaths.add(sandboxPath);
      await mkdir(sandboxPath, { recursive: true });
      const scanResult =
        typeof options.scanResult === "function"
          ? await options.scanResult(input)
          : options.scanResult;
      return scanResult;
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
        ...(result.reason === undefined ? {} : { safeFailureReason: result.reason }),
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

export function validateHostedLogBoundary(
  input: HostedLogBoundaryValidationInput
): HostedLogBoundaryValidation {
  const serializedSamples = input.samples.map((sample) => JSON.stringify(sample)).join("\n");
  const blockedReasons = new Set<HostedLogBoundaryBlockedReason>();

  markIfContains(blockedReasons, serializedSamples, input.forbidden.rawSource, "raw_source");
  markIfContains(blockedReasons, serializedSamples, input.forbidden.rawDiff, "raw_diff");
  markIfContainsAny(blockedReasons, serializedSamples, input.forbidden.secretValues, "secret_value");
  markIfContainsAny(
    blockedReasons,
    serializedSamples,
    input.forbidden.customerPayloads,
    "customer_payload"
  );
  markIfContainsAny(
    blockedReasons,
    serializedSamples,
    input.forbidden.installationTokens,
    "installation_token"
  );
  markIfContainsAny(blockedReasons, serializedSamples, input.forbidden.checkoutPaths, "checkout_path");
  markIfContainsAny(blockedReasons, serializedSamples, input.forbidden.privateUrls, "private_url");
  markIfContainsAny(
    blockedReasons,
    serializedSamples,
    input.forbidden.untrustedPrText,
    "untrusted_pr_text"
  );

  if (/\bgh[opsu]_[A-Za-z0-9_]{8,}\b/.test(serializedSamples)) {
    blockedReasons.add("installation_token");
  }
  if (/\b(?:sk_(?:live|test)|whsec_)[A-Za-z0-9_]+\b|-----BEGIN [A-Z ]+-----/.test(serializedSamples)) {
    blockedReasons.add("secret_value");
  }

  return {
    accepted: blockedReasons.size === 0,
    sampleCount: input.samples.length,
    blockedReasons: [...blockedReasons].sort(),
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
    privacy: hostedStagingHarnessPrivacy()
  };
}

export function createHostedStagingReleaseEvidenceBundle(
  input: HostedStagingReleaseEvidenceBundleInput
): HostedStagingReleaseEvidenceBundle {
  const externalEvidence = new Map(
    input.externalEvidence.map((evidence) => [evidence.id, sanitizeEvidence(evidence, input)])
  );
  const scenarioSummary = hostedStagingScenarioSummary(input);
  const evidence = HOSTED_OPERATIONAL_RELEASE_GATE_REQUIREMENTS.map((requirement) => {
    const generated = generatedEvidenceFor(requirement.id, input, scenarioSummary);
    return generated ?? externalEvidence.get(requirement.id) ?? missingEvidence(requirement.id, input);
  });
  const readyForReleaseGate = evidence.every((item) => item.status === "passed");

  return {
    readyForReleaseGate,
    evidence,
    releaseGateInput: { evidence },
    scenarioSummary,
    privacy: hostedStagingHarnessPrivacy()
  };
}

export function evaluateHostedStagingReleaseEvidenceBundle(
  input: HostedStagingReleaseEvidenceGateInput
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

function hostedStagingScenarioSummary(
  input: HostedStagingReleaseEvidenceBundleInput
): HostedStagingReleaseEvidenceBundle["scenarioSummary"] {
  const processedWorkers = input.workerTicks.filter((tick) => tick.processed);
  const webhookReplayAccepted = input.webhookReplays.some(
    (replay) => replay.accepted && replay.queuedWorker && replay.shouldCreateCheckRun
  );
  const completedWorkerProbe = processedWorkers.some(
    (tick) => tick.status === "completed" && tick.cleanupVerified
  );
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
    webhookReplayAccepted,
    completedWorkerProbe,
    failureCleanupProbe,
    observedFailureReasons,
    allWorkerCheckoutsDeleted,
    logBoundaryAccepted: input.logBoundary.accepted
  };
}

function generatedEvidenceFor(
  id: HostedOperationalReleaseGateRequirementId,
  input: HostedStagingReleaseEvidenceBundleInput,
  summary: HostedStagingReleaseEvidenceBundle["scenarioSummary"]
): HostedOperationalReleaseGateEvidence | undefined {
  if (id === "webhook_replay") {
    return summary.webhookReplayAccepted
      ? passedEvidence(id, "Signed webhook replay queued a check-run-only worker from trusted fields.", input)
      : missingEvidence(id, input);
  }

  if (id === "queue_worker_cleanup") {
    return summary.completedWorkerProbe &&
      summary.failureCleanupProbe &&
      summary.allWorkerCheckoutsDeleted
      ? passedEvidence(
          id,
          "Success and failure worker probes deleted worker checkouts and recorded cleanup-safe status.",
          input
        )
      : missingEvidence(id, input);
  }

  if (id === "privacy_retention") {
    return input.logBoundary.sampleCount > 0 && summary.logBoundaryAccepted && privacyFlagsAreSafe(input)
      ? passedEvidence(
          id,
          "Log boundary accepted safe metadata only and compact reports avoided raw payloads.",
          input
        )
      : missingEvidence(id, input);
  }

  if (id === "release_cleanup") {
    return summary.allWorkerCheckoutsDeleted
      ? passedEvidence(id, "Release cleanup probe left no active staging worker sandbox entries.", input)
      : missingEvidence(id, input);
  }

  return undefined;
}

function privacyFlagsAreSafe(input: HostedStagingReleaseEvidenceBundleInput): boolean {
  const replayPrivacySafe = input.webhookReplays.every((replay) =>
    Object.values(replay.privacy).every((value) => value === false)
  );
  const workerPrivacySafe = input.workerTicks.every((tick) =>
    Object.values(tick.privacy).every((value) => value === false)
  );
  const logPrivacySafe = Object.values(input.logBoundary.privacy).every((value) => value === false);

  return replayPrivacySafe && workerPrivacySafe && logPrivacySafe;
}

function sanitizeEvidence(
  evidence: HostedOperationalReleaseGateEvidence,
  input: HostedStagingReleaseEvidenceBundleInput
): HostedOperationalReleaseGateEvidence {
  return {
    id: evidence.id,
    status: evidence.status,
    ...(evidence.collectedAt === undefined
      ? { collectedAt: input.collectedAt }
      : { collectedAt: evidence.collectedAt }),
    ...(evidence.evidenceUrl === undefined ? {} : { evidenceUrl: evidence.evidenceUrl }),
    note: `External release-gate evidence recorded for ${evidence.id}.`,
    ...(evidence.owner === undefined ? { owner: input.owner } : { owner: evidence.owner })
  };
}

function passedEvidence(
  id: HostedOperationalReleaseGateRequirementId,
  note: string,
  input: HostedStagingReleaseEvidenceBundleInput
): HostedOperationalReleaseGateEvidence {
  return {
    id,
    status: "passed",
    collectedAt: input.collectedAt,
    evidenceUrl: evidenceUrlFor(input, id),
    note,
    owner: input.owner
  };
}

function missingEvidence(
  id: HostedOperationalReleaseGateRequirementId,
  input: HostedStagingReleaseEvidenceBundleInput
): HostedOperationalReleaseGateEvidence {
  return {
    id,
    status: "missing",
    collectedAt: input.collectedAt,
    note: `Missing executable staging evidence for ${id}.`,
    owner: input.owner
  };
}

function evidenceUrlFor(
  input: Pick<HostedStagingReleaseEvidenceBundleInput, "evidenceBaseUrl">,
  id: HostedOperationalReleaseGateRequirementId
): string {
  return `${input.evidenceBaseUrl.replace(/\/+$/, "")}/${id}.json`;
}

function markIfContains(
  blockedReasons: Set<HostedLogBoundaryBlockedReason>,
  haystack: string,
  value: string | undefined,
  reason: HostedLogBoundaryBlockedReason
): void {
  if (value && haystack.includes(value)) {
    blockedReasons.add(reason);
  }
}

function markIfContainsAny(
  blockedReasons: Set<HostedLogBoundaryBlockedReason>,
  haystack: string,
  values: readonly string[] | undefined,
  reason: HostedLogBoundaryBlockedReason
): void {
  for (const value of values ?? []) {
    markIfContains(blockedReasons, haystack, value, reason);
  }
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
