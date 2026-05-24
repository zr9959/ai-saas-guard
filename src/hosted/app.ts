import {
  createHostedServiceRuntime,
  createInMemoryHostedServiceAdapters,
  type HostedCheckRunPublisher,
  type HostedCheckRunRequest,
  type HostedCompactReportStore,
  type HostedCompactReportStoreRecord,
  type HostedServiceQueueAdapter,
  type HostedServiceRuntime,
  type HostedServiceRuntimeOptions,
  type HostedServiceScanRunner,
  type HostedServiceWebhookResult,
  type HostedServiceWorkerResult
} from "./service.js";

export const HOSTED_NODE_CONTAINER_PLATFORM = "node_container";
export const HOSTED_NODE_CONTAINER_ROLES = ["webhook-ingress", "scan-worker"] as const;

type RepositoryIdSource = HostedServiceRuntimeOptions["selectedRepositoryIdsByInstallation"];

export interface HostedAppHttpRequest {
  method: string;
  path: string;
  headers: Record<string, string | string[] | undefined>;
  body: string | Buffer;
}

export interface HostedAppHttpResponse {
  status: number;
  headers: {
    "content-type": "application/json; charset=utf-8";
  };
  body: string;
}

export interface HostedHttpAppOptions {
  runtime: HostedServiceRuntime;
  webhookPath?: string;
  healthPath?: string;
}

export interface HostedHttpApp {
  handleHttpRequest(request: HostedAppHttpRequest): HostedAppHttpResponse;
  runWorkerTick(): Promise<HostedAppWorkerTickResult>;
}

export type HostedAppWorkerTickResult =
  | {
      processed: false;
      reason: "empty_queue";
      platform: typeof HOSTED_NODE_CONTAINER_PLATFORM;
      privacy: HostedAppResponsePrivacy;
    }
  | {
      processed: true;
      status: "completed";
      checkRunPublished: boolean;
      compactReportStored: boolean;
      cleanupPlanned: boolean;
      platform: typeof HOSTED_NODE_CONTAINER_PLATFORM;
      privacy: HostedAppResponsePrivacy;
    }
  | {
      processed: true;
      status: "failed";
      errorClass: "worker_plan_rejected" | "check_run_publication_rejected" | "scan_runner_failed";
      reason?: string;
      cleanupPlanned: boolean;
      platform: typeof HOSTED_NODE_CONTAINER_PLATFORM;
      privacy: HostedAppResponsePrivacy;
    };

export interface HostedAppResponsePrivacy {
  includesRawWebhookPayload: false;
  includesUntrustedPrText: false;
  includesRawSource: false;
  includesRawDiffs: false;
  includesSecrets: false;
  includesCustomerPayloads: false;
  includesPrivateCheckoutPath: false;
  includesInstallationToken: false;
}

export interface InMemoryHostedAppPlatformOptions {
  signingKey: string | Buffer;
  scannerVersion: string;
  selectedRepositoryIdsByInstallation: RepositoryIdSource;
  removedRepositoryIdsByInstallation?: RepositoryIdSource;
  scanRunner: HostedServiceScanRunner;
  now?: () => string;
}

export interface InMemoryHostedAppPlatform {
  app: HostedHttpApp;
  adapters: {
    queue: HostedServiceQueueAdapter;
    compactReportStore: HostedCompactReportStore & { records: HostedCompactReportStoreRecord[] };
    checkRunPublisher: HostedCheckRunPublisher & { requests: HostedCheckRunRequest[] };
  };
  platform: typeof HOSTED_NODE_CONTAINER_PLATFORM;
  roles: typeof HOSTED_NODE_CONTAINER_ROLES;
}

export interface HostedNodeContainerDeploymentSecretRefs {
  githubAppId: string;
  githubAppPrivateKey: string;
  githubWebhookSecret: string;
}

export interface HostedNodeContainerDeploymentInput {
  environment: string;
  publicBaseUrl: string;
  containerImageDigest: string;
  secretRefs: HostedNodeContainerDeploymentSecretRefs;
  queueRef: string;
  compactReportStoreRef: string;
  workerSandboxRef: string;
  checkRunPublisherRef: string;
  rawPrivateKey?: string;
  rawWebhookSecret?: string;
  rawInstallationToken?: string;
  rawSource?: string;
  rawDiff?: string;
  secretValues?: string[];
  customerPayload?: unknown;
}

export interface HostedNodeContainerDeploymentPlan {
  readyToDeploy: boolean;
  blockedReasons: string[];
  platform: typeof HOSTED_NODE_CONTAINER_PLATFORM;
  roles: typeof HOSTED_NODE_CONTAINER_ROLES;
  environment: string;
  containerImageDigest: string;
  endpoints: {
    webhookUrl: string;
    healthUrl: string;
  };
  adapters: {
    secretManager: "platform_secret_manager";
    queue: string;
    compactReportStore: string;
    workerSandbox: string;
    checkRunPublisher: string;
  };
  runtime: {
    httpIngress: "node_http";
    worker: "node_worker";
    localCliNoNetwork: true;
    rawSourcePersistence: false;
    rawDiffPersistence: false;
    secretPersistence: false;
    customerPayloadPersistence: false;
  };
  privacy: {
    includesPrivateKey: false;
    includesWebhookSecret: false;
    includesInstallationToken: false;
    includesRawSource: false;
    includesRawDiffs: false;
    includesSecrets: false;
    includesCustomerPayloads: false;
    includesPrivateUrls: false;
  };
}

export function createHostedHttpApp(options: HostedHttpAppOptions): HostedHttpApp {
  const webhookPath = options.webhookPath ?? "/github/webhook";
  const healthPath = options.healthPath ?? "/healthz";

  return {
    handleHttpRequest(request) {
      if (request.path === healthPath) {
        return request.method.toUpperCase() === "GET"
          ? jsonResponse(200, {
              ok: true,
              platform: HOSTED_NODE_CONTAINER_PLATFORM,
              roles: [...HOSTED_NODE_CONTAINER_ROLES],
              privacy: appResponsePrivacy()
            })
          : jsonResponse(405, methodNotAllowedBody(["GET"]));
      }

      if (request.path !== webhookPath) {
        return jsonResponse(404, {
          accepted: false,
          reason: "not_found",
          platform: HOSTED_NODE_CONTAINER_PLATFORM,
          privacy: appResponsePrivacy()
        });
      }

      if (request.method.toUpperCase() !== "POST") {
        return jsonResponse(405, methodNotAllowedBody(["POST"]));
      }

      const result = options.runtime.handlePullRequestWebhook({
        payload: request.body,
        signatureHeader: headerValue(request.headers, "x-hub-signature-256"),
        deliveryId: headerValue(request.headers, "x-github-delivery"),
        manualRerun: headerValue(request.headers, "x-ai-saas-guard-manual-rerun") === "true"
      });

      return jsonResponse(result.accepted ? 202 : 400, safeWebhookResponse(result));
    },

    async runWorkerTick() {
      return safeWorkerTickResult(await options.runtime.runNextQueuedScan());
    }
  };
}

export function createInMemoryHostedAppPlatform(
  options: InMemoryHostedAppPlatformOptions
): InMemoryHostedAppPlatform {
  const adapters = createInMemoryHostedServiceAdapters();
  const runtime = createHostedServiceRuntime({
    signingKey: options.signingKey,
    scannerVersion: options.scannerVersion,
    selectedRepositoryIdsByInstallation: options.selectedRepositoryIdsByInstallation,
    removedRepositoryIdsByInstallation: options.removedRepositoryIdsByInstallation,
    queue: adapters.queue,
    compactReportStore: adapters.compactReportStore,
    checkRunPublisher: adapters.checkRunPublisher,
    scanRunner: options.scanRunner,
    now: options.now
  });

  return {
    app: createHostedHttpApp({ runtime }),
    adapters,
    platform: HOSTED_NODE_CONTAINER_PLATFORM,
    roles: HOSTED_NODE_CONTAINER_ROLES
  };
}

export function planHostedNodeContainerDeployment(
  input: HostedNodeContainerDeploymentInput
): HostedNodeContainerDeploymentPlan {
  const blockedReasons = [
    ...publicBaseUrlBlockedReasons(input.publicBaseUrl),
    ...containerDigestBlockedReasons(input.containerImageDigest),
    ...secretRefBlockedReasons(input.secretRefs),
    ...adapterRefBlockedReasons(input),
    ...rawInputBlockedReasons(input)
  ];
  const publicBaseUrl = isSafePublicHttpsUrl(input.publicBaseUrl)
    ? normalizePublicBaseUrl(input.publicBaseUrl)
    : "";

  return {
    readyToDeploy: blockedReasons.length === 0,
    blockedReasons,
    platform: HOSTED_NODE_CONTAINER_PLATFORM,
    roles: HOSTED_NODE_CONTAINER_ROLES,
    environment: input.environment,
    containerImageDigest: input.containerImageDigest,
    endpoints: {
      webhookUrl: publicBaseUrl ? `${publicBaseUrl}/github/webhook` : "",
      healthUrl: publicBaseUrl ? `${publicBaseUrl}/healthz` : ""
    },
    adapters: {
      secretManager: "platform_secret_manager",
      queue: safeAdapterRef(input.queueRef, "queue:"),
      compactReportStore: safeAdapterRef(input.compactReportStoreRef, "store:"),
      workerSandbox: safeAdapterRef(input.workerSandboxRef, "sandbox:"),
      checkRunPublisher: safeAdapterRef(input.checkRunPublisherRef, "github-checks:")
    },
    runtime: {
      httpIngress: "node_http",
      worker: "node_worker",
      localCliNoNetwork: true,
      rawSourcePersistence: false,
      rawDiffPersistence: false,
      secretPersistence: false,
      customerPayloadPersistence: false
    },
    privacy: {
      includesPrivateKey: false,
      includesWebhookSecret: false,
      includesInstallationToken: false,
      includesRawSource: false,
      includesRawDiffs: false,
      includesSecrets: false,
      includesCustomerPayloads: false,
      includesPrivateUrls: false
    }
  };
}

function safeWebhookResponse(result: HostedServiceWebhookResult): Record<string, unknown> {
  return {
    accepted: result.accepted,
    stage: result.stage,
    ...(result.reason === undefined ? {} : { reason: result.reason }),
    ...(result.deliveryId === undefined ? {} : { deliveryId: result.deliveryId }),
    queuedWorker: result.queueDecision?.shouldEnqueueWorker ?? false,
    shouldCreateCheckRun: result.shouldCreateCheckRun,
    shouldCreatePrComment: false,
    platform: HOSTED_NODE_CONTAINER_PLATFORM,
    privacy: appResponsePrivacy()
  };
}

function safeWorkerTickResult(result: HostedServiceWorkerResult): HostedAppWorkerTickResult {
  if (!result.processed) {
    return {
      processed: false,
      reason: "empty_queue",
      platform: HOSTED_NODE_CONTAINER_PLATFORM,
      privacy: appResponsePrivacy()
    };
  }

  if (result.status === "completed") {
    return {
      processed: true,
      status: "completed",
      checkRunPublished: result.checkRunPublication.shouldWriteCheckRun,
      compactReportStored: true,
      cleanupPlanned: result.cleanup.shouldDeleteWorkerCheckout,
      platform: HOSTED_NODE_CONTAINER_PLATFORM,
      privacy: appResponsePrivacy()
    };
  }

  return {
    processed: true,
    status: "failed",
    errorClass: result.errorClass,
    ...(result.reason === undefined ? {} : { reason: result.reason }),
    cleanupPlanned: result.cleanup?.shouldDeleteWorkerCheckout ?? false,
    platform: HOSTED_NODE_CONTAINER_PLATFORM,
    privacy: appResponsePrivacy()
  };
}

function jsonResponse(status: number, body: Record<string, unknown>): HostedAppHttpResponse {
  return {
    status,
    headers: {
      "content-type": "application/json; charset=utf-8"
    },
    body: JSON.stringify(body)
  };
}

function methodNotAllowedBody(allowed: string[]): Record<string, unknown> {
  return {
    accepted: false,
    reason: "method_not_allowed",
    allowed,
    platform: HOSTED_NODE_CONTAINER_PLATFORM,
    privacy: appResponsePrivacy()
  };
}

function appResponsePrivacy(): HostedAppResponsePrivacy {
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

function headerValue(
  headers: HostedAppHttpRequest["headers"],
  name: string
): string | undefined {
  const lowerName = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() !== lowerName) {
      continue;
    }

    return Array.isArray(value) ? value[0] : value;
  }

  return undefined;
}

function publicBaseUrlBlockedReasons(publicBaseUrl: string): string[] {
  return isSafePublicHttpsUrl(publicBaseUrl) ? [] : ["invalid_public_base_url"];
}

function containerDigestBlockedReasons(containerImageDigest: string): string[] {
  return /^sha256:[a-f0-9]{64}$/i.test(containerImageDigest)
    ? []
    : ["invalid_container_image_digest"];
}

function secretRefBlockedReasons(secretRefs: HostedNodeContainerDeploymentSecretRefs): string[] {
  const reasons: string[] = [];
  for (const key of ["githubAppId", "githubAppPrivateKey", "githubWebhookSecret"] as const) {
    const ref = secretRefs[key].trim();
    if (!ref) {
      reasons.push(`missing_secret_ref:${key}`);
    } else if (!isValidSecretRef(ref)) {
      reasons.push(`invalid_secret_ref:${key}`);
    }
  }

  return reasons;
}

function adapterRefBlockedReasons(input: HostedNodeContainerDeploymentInput): string[] {
  const adapterRefs = {
    queue: { value: input.queueRef, prefix: "queue:" },
    compactReportStore: { value: input.compactReportStoreRef, prefix: "store:" },
    workerSandbox: { value: input.workerSandboxRef, prefix: "sandbox:" },
    checkRunPublisher: { value: input.checkRunPublisherRef, prefix: "github-checks:" }
  } as const;
  const reasons: string[] = [];

  for (const [key, ref] of Object.entries(adapterRefs)) {
    const value = ref.value.trim();
    if (!value) {
      reasons.push(`missing_adapter_ref:${key}`);
    } else if (!value.startsWith(ref.prefix)) {
      reasons.push(`invalid_adapter_ref:${key}`);
    }
  }

  return reasons;
}

function rawInputBlockedReasons(input: HostedNodeContainerDeploymentInput): string[] {
  const reasons: string[] = [];
  for (const key of ["rawPrivateKey", "rawWebhookSecret", "rawInstallationToken"] as const) {
    if (typeof input[key] === "string" && input[key].trim()) {
      reasons.push(`raw_secret_material:${key}`);
    }
  }
  for (const key of ["rawSource", "rawDiff"] as const) {
    if (typeof input[key] === "string" && input[key].trim()) {
      reasons.push(`raw_source_material:${key}`);
    }
  }
  if (Array.isArray(input.secretValues) && input.secretValues.some((value) => value.trim())) {
    reasons.push("raw_secret_material:secretValues");
  }
  if (input.customerPayload !== undefined && input.customerPayload !== null) {
    reasons.push("raw_customer_payload:customerPayload");
  }

  return reasons;
}

function safeAdapterRef(value: string, prefix: string): string {
  const ref = value.trim();
  return ref.startsWith(prefix) ? ref : "";
}

function isValidSecretRef(value: string): boolean {
  return /^secret:[A-Za-z0-9._:/@-]+$/.test(value);
}

function normalizePublicBaseUrl(publicBaseUrl: string): string {
  return trimTrailingSlashes(publicBaseUrl.trim());
}

function isSafePublicHttpsUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "https:" && !isUnsafeHostedHostname(url.hostname);
  } catch {
    return false;
  }
}

function isUnsafeHostedHostname(hostname: string): boolean {
  const normalized = normalizeHostname(hostname);
  return (
    normalized === "localhost" ||
    normalized.endsWith(".localhost") ||
    isUnsafeIpv4Hostname(normalized) ||
    isUnsafeIpv6Hostname(normalized)
  );
}

function trimTrailingSlashes(value: string): string {
  let end = value.length;
  while (end > 0 && value[end - 1] === "/") {
    end -= 1;
  }
  return value.slice(0, end);
}

function normalizeHostname(hostname: string): string {
  const lower = hostname.toLowerCase().replace(/\.$/, "");
  return lower.startsWith("[") && lower.endsWith("]") ? lower.slice(1, -1) : lower;
}

function isUnsafeIpv4Hostname(hostname: string): boolean {
  const parts = hostname.split(".");
  if (parts.length !== 4 || !parts.every((part) => /^\d+$/.test(part))) {
    return false;
  }

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

function isUnsafeIpv6Hostname(hostname: string): boolean {
  return (
    hostname === "::" ||
    hostname === "::1" ||
    hostname.startsWith("fc") ||
    hostname.startsWith("fd") ||
    hostname.startsWith("fe80:")
  );
}
