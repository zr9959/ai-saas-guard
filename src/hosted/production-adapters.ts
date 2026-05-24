import { createSign, type KeyObject } from "node:crypto";
import {
  createHostedWorkerCheckoutCleanupPlan,
  planHostedWorkerReadOnlyScan,
  type HostedScanIdentity,
  type HostedWorkerCheckoutCleanupPlan,
  type HostedWorkerReadOnlyScanPlan
} from "./contracts.js";

export const HOSTED_GITHUB_API_VERSION = "2026-03-10";
export const HOSTED_GITHUB_APP_JWT_MAX_TTL_SECONDS = 600;
export const HOSTED_GITHUB_APP_JWT_CLOCK_SKEW_SECONDS = 60;
export const HOSTED_WORKER_MAX_TIMEOUT_MS = 600_000;
export const HOSTED_WORKER_DEFAULT_TIMEOUT_MS = 300_000;
export const HOSTED_WORKER_MAX_OUTPUT_BYTES = 1_048_576;

export type HostedGitHubInstallationTokenPurpose =
  | "worker_checkout"
  | "check_run_publication"
  | "first_slice";

export interface HostedGitHubAppJwtInput {
  appId: string | number;
  privateKey: string | Buffer | KeyObject;
  nowSeconds?: number;
  ttlSeconds?: number;
  clockSkewSeconds?: number;
}

export interface HostedGitHubAppJwt {
  token: string;
  algorithm: "RS256";
  issuer: string;
  issuedAt: number;
  expiresAt: number;
  maxTtlSeconds: typeof HOSTED_GITHUB_APP_JWT_MAX_TTL_SECONDS;
  privacy: {
    includesPrivateKey: false;
  };
}

export interface HostedGitHubInstallationTokenRequestInput {
  installationId: number;
  repositoryId: number;
  purpose: HostedGitHubInstallationTokenPurpose;
  requestedAt: string;
  apiBaseUrl?: string;
  apiVersion?: string;
  appJwt?: string;
  rawPrivateKey?: string;
  rawInstallationToken?: string;
}

export interface HostedGitHubInstallationTokenRequestPlan {
  readyToRequestToken: boolean;
  blockedReasons: string[];
  purpose: HostedGitHubInstallationTokenPurpose;
  requestedAt: string;
  request: {
    method: "POST";
    url: string;
    endpoint: string;
    headers: {
      accept: "application/vnd.github+json";
      "x-github-api-version": string;
    };
    authorization: "runtime_bearer_app_jwt";
    body: {
      repository_ids: number[];
      permissions: Record<string, "read" | "write">;
    };
  };
  responseHandling: {
    tokenType: "installation_access_token";
    persistToken: false;
    cacheUntilExpiresAt: true;
    redactTokenInLogs: true;
  };
  privacy: {
    includesAppJwt: false;
    includesInstallationToken: false;
    includesPrivateKey: false;
    includesCustomerPayloads: false;
  };
}

export interface HostedProductionWorkerExecutionInput {
  identity: HostedScanIdentity;
  jobKey: string;
  requestedAt: string;
  selectedRepositoryIds: number[];
  removedRepositoryIds?: number[];
  temporaryCheckoutRoot?: string;
  workerTimeoutMs?: number;
  maxOutputBytes?: number;
  rawSource?: string;
  rawDiff?: string;
  secretValues?: string[];
  customerPayload?: unknown;
}

export interface HostedProductionWorkerExecutionPlan {
  readyToRunWorker: boolean;
  blockedReasons: string[];
  jobKey: string;
  requestedAt: string;
  workerPlan: HostedWorkerReadOnlyScanPlan;
  checkoutTokenRequest: HostedGitHubInstallationTokenRequestPlan;
  checkRunTokenRequest: HostedGitHubInstallationTokenRequestPlan;
  execution: {
    commandSource: "trusted_runtime_plan";
    timeoutMs: number;
    maxOutputBytes: number;
    cancellation: "supported";
    networkAccess: "disabled";
    writeMode: "read_only";
    shell: "disabled";
  };
  output: {
    compactJsonOnly: true;
    persistRawSource: false;
    persistRawDiffs: false;
    persistSecrets: false;
    persistCustomerPayloads: false;
  };
  cleanup: {
    success: HostedWorkerCheckoutCleanupPlan;
    failure: HostedWorkerCheckoutCleanupPlan;
    timeout: HostedWorkerCheckoutCleanupPlan;
    cancellation: HostedWorkerCheckoutCleanupPlan;
  };
  privacy: {
    includesTemporaryCheckoutRoot: false;
    includesRawSource: false;
    includesRawDiffs: false;
    includesSecrets: false;
    includesCustomerPayloads: false;
    includesAppJwt: false;
    includesInstallationToken: false;
    acceptsCommandFromPrText: false;
  };
}

export interface HostedProductionSecretProvider {
  getSecret(ref: string): Promise<string>;
}

export interface HostedProductionInstallationTokenRequester {
  requestInstallationToken(
    plan: HostedGitHubInstallationTokenRequestPlan,
    appJwt: HostedGitHubAppJwt
  ): Promise<{
    token: string;
    expiresAt: string;
  }>;
}

export interface HostedProductionWorkerAdapter {
  runReadOnlyCli(plan: HostedProductionWorkerExecutionPlan): Promise<{
    stdout: string;
    exitCode: number;
  }>;
}

export function createHostedGitHubAppJwt(input: HostedGitHubAppJwtInput): HostedGitHubAppJwt {
  const nowSeconds = normalizeUnixSeconds(input.nowSeconds, Math.floor(Date.now() / 1000));
  const ttlSeconds = clampPositiveInteger(
    input.ttlSeconds,
    HOSTED_GITHUB_APP_JWT_MAX_TTL_SECONDS,
    HOSTED_GITHUB_APP_JWT_MAX_TTL_SECONDS
  );
  const clockSkewSeconds = clampPositiveInteger(
    input.clockSkewSeconds,
    HOSTED_GITHUB_APP_JWT_CLOCK_SKEW_SECONDS,
    HOSTED_GITHUB_APP_JWT_CLOCK_SKEW_SECONDS
  );
  const issuedAt = nowSeconds - clockSkewSeconds;
  const expiresAt = nowSeconds + ttlSeconds;
  const issuer = String(input.appId);
  const header = { typ: "JWT", alg: "RS256" };
  const payload = { iat: issuedAt, exp: expiresAt, iss: issuer };
  const signingInput = `${base64UrlJson(header)}.${base64UrlJson(payload)}`;
  const signature = createSign("RSA-SHA256")
    .update(signingInput)
    .end()
    .sign(input.privateKey)
    .toString("base64url");

  return {
    token: `${signingInput}.${signature}`,
    algorithm: "RS256",
    issuer,
    issuedAt,
    expiresAt,
    maxTtlSeconds: HOSTED_GITHUB_APP_JWT_MAX_TTL_SECONDS,
    privacy: {
      includesPrivateKey: false
    }
  };
}

export function planHostedGitHubInstallationTokenRequest(
  input: HostedGitHubInstallationTokenRequestInput
): HostedGitHubInstallationTokenRequestPlan {
  const blockedReasons = [
    ...installationTokenInputBlockedReasons(input),
    ...safeApiUrlBlockedReasons(input.apiBaseUrl)
  ];
  const apiBaseUrl = normalizeApiBaseUrl(input.apiBaseUrl);
  const endpoint = `/app/installations/${input.installationId}/access_tokens`;

  return {
    readyToRequestToken: blockedReasons.length === 0,
    blockedReasons,
    purpose: input.purpose,
    requestedAt: input.requestedAt,
    request: {
      method: "POST",
      url: `${apiBaseUrl}${endpoint}`,
      endpoint,
      headers: {
        accept: "application/vnd.github+json",
        "x-github-api-version": input.apiVersion?.trim() || HOSTED_GITHUB_API_VERSION
      },
      authorization: "runtime_bearer_app_jwt",
      body: {
        repository_ids: [input.repositoryId],
        permissions: permissionsForPurpose(input.purpose)
      }
    },
    responseHandling: {
      tokenType: "installation_access_token",
      persistToken: false,
      cacheUntilExpiresAt: true,
      redactTokenInLogs: true
    },
    privacy: {
      includesAppJwt: false,
      includesInstallationToken: false,
      includesPrivateKey: false,
      includesCustomerPayloads: false
    }
  };
}

export function planHostedProductionWorkerExecution(
  input: HostedProductionWorkerExecutionInput
): HostedProductionWorkerExecutionPlan {
  const workerPlan = planHostedWorkerReadOnlyScan({
    identity: input.identity,
    jobKey: input.jobKey,
    requestedAt: input.requestedAt,
    installationId: input.identity.installationId,
    selectedRepositoryIds: input.selectedRepositoryIds,
    removedRepositoryIds: input.removedRepositoryIds,
    installationTokenPermissions: { contents: "read" }
  });
  const checkoutTokenRequest = planHostedGitHubInstallationTokenRequest({
    installationId: input.identity.installationId,
    repositoryId: input.identity.repositoryId,
    purpose: "worker_checkout",
    requestedAt: input.requestedAt
  });
  const checkRunTokenRequest = planHostedGitHubInstallationTokenRequest({
    installationId: input.identity.installationId,
    repositoryId: input.identity.repositoryId,
    purpose: "check_run_publication",
    requestedAt: input.requestedAt
  });
  const blockedReasons = [
    ...workerPlanBlockedReasons(workerPlan),
    ...prefixBlockedReasons("checkout_token", checkoutTokenRequest.blockedReasons),
    ...prefixBlockedReasons("check_run_token", checkRunTokenRequest.blockedReasons)
  ];

  return {
    readyToRunWorker: blockedReasons.length === 0,
    blockedReasons,
    jobKey: input.jobKey,
    requestedAt: input.requestedAt,
    workerPlan,
    checkoutTokenRequest,
    checkRunTokenRequest,
    execution: {
      commandSource: "trusted_runtime_plan",
      timeoutMs: clampPositiveInteger(
        input.workerTimeoutMs,
        HOSTED_WORKER_DEFAULT_TIMEOUT_MS,
        HOSTED_WORKER_MAX_TIMEOUT_MS
      ),
      maxOutputBytes: clampPositiveInteger(
        input.maxOutputBytes,
        HOSTED_WORKER_MAX_OUTPUT_BYTES,
        HOSTED_WORKER_MAX_OUTPUT_BYTES
      ),
      cancellation: "supported",
      networkAccess: "disabled",
      writeMode: "read_only",
      shell: "disabled"
    },
    output: {
      compactJsonOnly: true,
      persistRawSource: false,
      persistRawDiffs: false,
      persistSecrets: false,
      persistCustomerPayloads: false
    },
    cleanup: {
      success: cleanupPlan(input, "success"),
      failure: cleanupPlan(input, "failure"),
      timeout: cleanupPlan(input, "timeout"),
      cancellation: cleanupPlan(input, "cancellation")
    },
    privacy: {
      includesTemporaryCheckoutRoot: false,
      includesRawSource: false,
      includesRawDiffs: false,
      includesSecrets: false,
      includesCustomerPayloads: false,
      includesAppJwt: false,
      includesInstallationToken: false,
      acceptsCommandFromPrText: false
    }
  };
}

function base64UrlJson(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

function normalizeUnixSeconds(value: number | undefined, fallback: number): number {
  if (value === undefined || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.max(0, Math.floor(value));
}

function clampPositiveInteger(
  value: number | undefined,
  fallback: number,
  maximum: number
): number {
  if (value === undefined || !Number.isFinite(value)) {
    return fallback;
  }

  return Math.min(maximum, Math.max(1, Math.floor(value)));
}

function installationTokenInputBlockedReasons(
  input: HostedGitHubInstallationTokenRequestInput
): string[] {
  const reasons: string[] = [];

  if (typeof input.appJwt === "string" && input.appJwt.trim()) {
    reasons.push("raw_secret_material:appJwt");
  }

  if (typeof input.rawPrivateKey === "string" && input.rawPrivateKey.trim()) {
    reasons.push("raw_secret_material:rawPrivateKey");
  }

  if (typeof input.rawInstallationToken === "string" && input.rawInstallationToken.trim()) {
    reasons.push("raw_secret_material:rawInstallationToken");
  }

  if (!Number.isSafeInteger(input.installationId) || input.installationId <= 0) {
    reasons.push("invalid_installation_id");
  }

  if (!Number.isSafeInteger(input.repositoryId) || input.repositoryId <= 0) {
    reasons.push("invalid_repository_id");
  }

  return reasons;
}

function safeApiUrlBlockedReasons(apiBaseUrl?: string): string[] {
  if (!apiBaseUrl) {
    return [];
  }

  try {
    const url = new URL(apiBaseUrl);
    return url.protocol === "https:" ? [] : ["invalid_github_api_url"];
  } catch {
    return ["invalid_github_api_url"];
  }
}

function normalizeApiBaseUrl(apiBaseUrl?: string): string {
  const value = apiBaseUrl?.trim() || "https://api.github.com";
  return value.replace(/\/+$/, "");
}

function permissionsForPurpose(
  purpose: HostedGitHubInstallationTokenPurpose
): Record<string, "read" | "write"> {
  if (purpose === "worker_checkout") {
    return {
      contents: "read",
      pull_requests: "read"
    };
  }

  if (purpose === "check_run_publication") {
    return {
      checks: "write"
    };
  }

  return {
    contents: "read",
    pull_requests: "read",
    checks: "write"
  };
}

function workerPlanBlockedReasons(plan: HostedWorkerReadOnlyScanPlan): string[] {
  return plan.accepted ? [] : [`worker_plan_rejected:${plan.reason ?? "unknown"}`];
}

function prefixBlockedReasons(prefix: string, reasons: string[]): string[] {
  return reasons.map((reason) => `${prefix}:${reason}`);
}

function cleanupPlan(
  input: HostedProductionWorkerExecutionInput,
  terminalState: "success" | "failure" | "timeout" | "cancellation"
): HostedWorkerCheckoutCleanupPlan {
  return createHostedWorkerCheckoutCleanupPlan({
    identity: input.identity,
    jobKey: input.jobKey,
    terminalState,
    finishedAt: input.requestedAt
  });
}
