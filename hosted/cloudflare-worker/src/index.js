export const HOSTED_WORKER_PRIVACY = {
  includesRawWebhookPayload: false,
  includesUntrustedPrText: false,
  includesRawSource: false,
  includesRawDiffs: false,
  includesSecrets: false,
  includesCustomerPayloads: false,
  includesPrivateCheckoutPath: false,
  includesInstallationToken: false
};

const ALLOWED_PULL_REQUEST_ACTIONS = new Set(["opened", "reopened", "synchronize", "ready_for_review"]);
const JSON_HEADERS = {
  "content-type": "application/json; charset=utf-8"
};
const EVENT_TTL_SECONDS = 60 * 60 * 24 * 30;
export const MAX_WEBHOOK_PAYLOAD_BYTES = 1024 * 1024;
const MAX_PR_FILES_PAGES = 3;
const MAX_PATCH_CHARS_PER_FILE = 20_000;
const DEFAULT_RATE_LIMIT_WINDOW_SECONDS = 60;
const HOSTED_PROCESSING_PAUSED_KEY = "control:hosted_processing_paused";
const HOSTED_APP_PERMISSIONS = {
  checks: "write",
  contents: "read",
  metadata: "read",
  pull_requests: "read"
};
const HOSTED_APP_EVENTS = ["pull_request", "installation", "installation_repositories"];

const CATEGORY_WEIGHTS = {
  "auth/session": 30,
  "billing/subscription": 30,
  "database schema/migration": 24,
  "RLS/policy": 35,
  "API contract": 16,
  "env/secrets/deploy": 24,
  "permissions/storage": 20,
  "tests removed or weakened": 28,
  "large AI-generated/refactor-like diff": 18
};

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/healthz")) {
      return jsonResponse(200, createHostedWorkerHealth(env, {
        processingPaused: await isHostedProcessingPaused(env, env?.HOSTED_EVENTS)
      }));
    }

    if (request.method === "GET" && url.pathname === "/github/app/install-info") {
      return jsonResponse(200, createHostedInstallInfo(env));
    }

    if (request.method === "GET" && url.pathname === "/github/app/manifest-callback") {
      return jsonResponse(200, createGitHubAppManifestCallback(url));
    }

    if (url.pathname !== "/github/webhook") {
      return jsonResponse(404, {
        accepted: false,
        reason: "not_found",
        privacy: HOSTED_WORKER_PRIVACY
      });
    }

    if (request.method !== "POST") {
      return jsonResponse(405, {
        accepted: false,
        reason: "method_not_allowed",
        allowedMethods: ["POST"],
        privacy: HOSTED_WORKER_PRIVACY
      });
    }

    if (!env?.WEBHOOK_SECRET || !env?.HOSTED_EVENTS) {
      return jsonResponse(503, {
        accepted: false,
        stage: "configuration",
        reason: "missing_worker_binding",
        privacy: HOSTED_WORKER_PRIVACY
      });
    }

    if (isPayloadTooLarge(request.headers.get("content-length"))) {
      return jsonResponse(413, {
        accepted: false,
        stage: "payload",
        reason: "payload_too_large",
        maxBytes: MAX_WEBHOOK_PAYLOAD_BYTES,
        privacy: HOSTED_WORKER_PRIVACY
      });
    }

    const payload = await request.text();
    if (new TextEncoder().encode(payload).byteLength > MAX_WEBHOOK_PAYLOAD_BYTES) {
      return jsonResponse(413, {
        accepted: false,
        stage: "payload",
        reason: "payload_too_large",
        maxBytes: MAX_WEBHOOK_PAYLOAD_BYTES,
        privacy: HOSTED_WORKER_PRIVACY
      });
    }

    const signatureHeader = request.headers.get("x-hub-signature-256") ?? "";
    const deliveryId = request.headers.get("x-github-delivery") ?? "";
    const eventName = request.headers.get("x-github-event") ?? "";

    const signatureAccepted = await verifyGitHubWebhookSignature({
      payload,
      signatureHeader,
      secret: env.WEBHOOK_SECRET
    });
    if (!signatureAccepted) {
      return jsonResponse(400, {
        accepted: false,
        stage: "signature",
        reason: "invalid_signature",
        deliveryId: deliveryId || undefined,
        privacy: HOSTED_WORKER_PRIVACY
      });
    }

    if (!deliveryId) {
      return jsonResponse(400, {
        accepted: false,
        stage: "event",
        reason: "missing_delivery_id",
        privacy: HOSTED_WORKER_PRIVACY
      });
    }

    const deliveryKey = `delivery:${deliveryId}`;
    const existingDelivery = await env.HOSTED_EVENTS.get(deliveryKey);
    if (existingDelivery) {
      return jsonResponse(202, {
        accepted: true,
        stage: "duplicate_delivery",
        deliveryId,
        shouldCreateCheckRun: false,
        privacy: HOSTED_WORKER_PRIVACY
      });
    }

    if (eventName === "installation" || eventName === "installation_repositories") {
      let installationPayload;
      try {
        installationPayload = JSON.parse(payload);
      } catch {
        return jsonResponse(400, {
          accepted: false,
          stage: "payload",
          reason: "invalid_json",
          deliveryId,
          privacy: HOSTED_WORKER_PRIVACY
        });
      }

      const cleanup = await handleInstallationCleanupEvent({
        kv: env.HOSTED_EVENTS,
        deliveryKey,
        deliveryId,
        eventName,
        payload: installationPayload
      });
      return jsonResponse(202, {
        accepted: true,
        stage: cleanup.cleaned ? "cleanup" : "ignored",
        reason: cleanup.reason,
        deliveryId,
        deletedRecords: cleanup.deletedRecords,
        shouldCreateCheckRun: false,
        privacy: HOSTED_WORKER_PRIVACY
      });
    }

    if (eventName !== "pull_request") {
      await storeJson(env.HOSTED_EVENTS, deliveryKey, {
        deliveryId,
        eventName,
        accepted: false,
        reason: "unsupported_event",
        receivedAt: new Date().toISOString()
      });
      return jsonResponse(202, {
        accepted: true,
        stage: "ignored",
        reason: "unsupported_event",
        deliveryId,
        shouldCreateCheckRun: false,
        privacy: HOSTED_WORKER_PRIVACY
      });
    }

    let parsedPayload;
    try {
      parsedPayload = JSON.parse(payload);
    } catch {
      return jsonResponse(400, {
        accepted: false,
        stage: "payload",
        reason: "invalid_json",
        deliveryId,
        privacy: HOSTED_WORKER_PRIVACY
      });
    }

    const identity = parsePullRequestWebhookIdentity(parsedPayload);
    if (!identity) {
      return jsonResponse(400, {
        accepted: false,
        stage: "event",
        reason: "missing_required_identity",
        deliveryId,
        privacy: HOSTED_WORKER_PRIVACY
      });
    }

    if (!configuredInstallationMatches(env, identity.installationId)) {
      return jsonResponse(403, {
        accepted: false,
        stage: "event",
        reason: "installation_mismatch",
        deliveryId,
        privacy: HOSTED_WORKER_PRIVACY
      });
    }

    if (identity.draft || !ALLOWED_PULL_REQUEST_ACTIONS.has(identity.action)) {
      await storeJson(env.HOSTED_EVENTS, deliveryKey, {
        deliveryId,
        eventName,
        accepted: false,
        reason: identity.draft ? "draft_pull_request" : "unsupported_pull_request_action",
        identity,
        receivedAt: new Date().toISOString()
      });
      return jsonResponse(202, {
        accepted: true,
        stage: "ignored",
        reason: identity.draft ? "draft_pull_request" : "unsupported_pull_request_action",
        deliveryId,
        shouldCreateCheckRun: false,
        privacy: HOSTED_WORKER_PRIVACY
      });
    }

    if (await isHostedProcessingPaused(env, env.HOSTED_EVENTS)) {
      return jsonResponse(202, {
        accepted: true,
        stage: "paused",
        reason: "hosted_processing_paused",
        deliveryId,
        shouldCreateCheckRun: false,
        privacy: HOSTED_WORKER_PRIVACY
      });
    }

    const rateLimit = await checkRepositoryRateLimit({
      env,
      identity,
      kv: env.HOSTED_EVENTS
    });
    if (!rateLimit.allowed) {
      return jsonResponse(429, {
        accepted: false,
        stage: "rate_limit",
        reason: "repository_rate_limited",
        deliveryId,
        retryAfterSeconds: rateLimit.retryAfterSeconds,
        shouldCreateCheckRun: false,
        privacy: HOSTED_WORKER_PRIVACY
      });
    }

    const scannerVersion = env.SCANNER_VERSION || "unknown";
    const scanKey = [
      "scan",
      identity.installationId,
      identity.repositoryId,
      identity.pullRequestNumber,
      identity.headSha,
      scannerVersion
    ].join(":");

    await storeJson(env.HOSTED_EVENTS, deliveryKey, {
      deliveryId,
      eventName,
      accepted: true,
      scanKey,
      identity,
      receivedAt: new Date().toISOString()
    });
    await storeJson(env.HOSTED_EVENTS, scanKey, {
      key: scanKey,
      status: "queued",
      identity,
      scannerVersion,
      deliveryIds: [deliveryId],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      privacy: HOSTED_WORKER_PRIVACY
    });

    if (!hasGitHubCheckRunConfig(env)) {
      return jsonResponse(202, {
        accepted: true,
        stage: "queued",
        deliveryId,
        scanKey,
        shouldCreateCheckRun: false,
        worker: "not_configured",
        privacy: HOSTED_WORKER_PRIVACY
      });
    }

    const processing = runHostedPrRiskCheck({ env, identity, scanKey, scannerVersion });
    if (ctx?.waitUntil) {
      ctx.waitUntil(processing);
      return jsonResponse(202, {
        accepted: true,
        stage: "queued",
        deliveryId,
        scanKey,
        shouldCreateCheckRun: true,
        worker: "scheduled",
        privacy: HOSTED_WORKER_PRIVACY
      });
    }

    const result = await processing;
    return jsonResponse(202, {
      accepted: true,
      stage: "processed",
      deliveryId,
      scanKey,
      shouldCreateCheckRun: true,
      worker: result.status,
      checkRunConclusion: result.conclusion,
      checkRunId: result.checkRunId,
      privacy: HOSTED_WORKER_PRIVACY
    });
  }
};

export function createHostedWorkerHealth(env = {}, state = {}) {
  return {
    ok: true,
    service: "ai-saas-guard-hosted",
    mode: "webhook-ingress",
    routes: ["/healthz", "/github/app/install-info", "/github/app/manifest-callback", "/github/webhook"],
    storage: "cloudflare_kv",
    checkRunPublisher: hasGitHubCheckRunConfig(env) ? "configured" : "not_configured",
    rateLimit: getRepositoryRateLimitConfig(env) ? "configured" : "not_configured",
    abuseKillSwitch: "configured",
    processingPaused: state.processingPaused ?? booleanFlag(env.HOSTED_PROCESSING_PAUSED),
    scannerVersion: env.SCANNER_VERSION || "unknown",
    privacy: HOSTED_WORKER_PRIVACY
  };
}

export function createHostedInstallInfo(env = {}) {
  const slug = stringValue(env.GITHUB_APP_SLUG) ?? "ai-saas-guard-hosted";

  return {
    ok: true,
    service: "ai-saas-guard-hosted",
    installUrl: `https://github.com/apps/${encodeURIComponent(slug)}/installations/new`,
    permissions: HOSTED_APP_PERMISSIONS,
    events: HOSTED_APP_EVENTS,
    boundary:
      "Install on selected repositories only. The hosted check turns PR trust-boundary changes into a review queue; it is not an AI reviewer, pentest, full audit, or certification.",
    uninstall:
      "Uninstall or repository removal deletes compact records for that installation or repository when GitHub sends the signed event. Local CLI use does not depend on hosted installation.",
    scannerVersion: env.SCANNER_VERSION || "unknown",
    privacy: HOSTED_WORKER_PRIVACY
  };
}

export function createGitHubAppManifestCallback(url) {
  return {
    ok: true,
    service: "ai-saas-guard-hosted",
    stage: "github_app_manifest_callback",
    manifestCodeReceived: url.searchParams.has("code"),
    storesManifestCode: false,
    nextStep: "exchange_code_server_side",
    privacy: HOSTED_WORKER_PRIVACY
  };
}

export async function verifyGitHubWebhookSignature({ payload, signatureHeader, secret }) {
  if (!payload || !signatureHeader || !secret || !signatureHeader.startsWith("sha256=")) {
    return false;
  }

  const expected = await hmacSha256Header(payload, secret);
  return constantTimeEqual(expected, signatureHeader);
}

export function parsePullRequestWebhookIdentity(payload) {
  const installationId = integerValue(payload?.installation?.id);
  const repositoryId = integerValue(payload?.repository?.id);
  const repositoryFullName = stringValue(payload?.repository?.full_name);
  const pullRequestNumber = integerValue(payload?.pull_request?.number);
  const baseSha = shaValue(payload?.pull_request?.base?.sha);
  const headSha = shaValue(payload?.pull_request?.head?.sha);
  const action = stringValue(payload?.action);

  if (
    installationId === undefined ||
    repositoryId === undefined ||
    repositoryFullName === undefined ||
    pullRequestNumber === undefined ||
    baseSha === undefined ||
    headSha === undefined ||
    action === undefined
  ) {
    return null;
  }

  return {
    action,
    installationId,
    repositoryId,
    repositoryFullName,
    repositoryPrivate: Boolean(payload?.repository?.private),
    pullRequestNumber,
    baseSha,
    headSha,
    draft: Boolean(payload?.pull_request?.draft)
  };
}

async function hmacSha256Header(payload, secret) {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(payload));
  return `sha256=${bufferToHex(signature)}`;
}

function constantTimeEqual(left, right) {
  if (left.length !== right.length) return false;

  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return mismatch === 0;
}

function bufferToHex(buffer) {
  return [...new Uint8Array(buffer)].map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

function integerValue(value) {
  return Number.isSafeInteger(value) ? value : undefined;
}

function stringValue(value) {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function shaValue(value) {
  return typeof value === "string" && /^[a-f0-9]{40}$/i.test(value) ? value : undefined;
}

function isPayloadTooLarge(contentLength) {
  if (contentLength === null) return false;
  const parsed = Number(contentLength);
  return Number.isFinite(parsed) && parsed > MAX_WEBHOOK_PAYLOAD_BYTES;
}

async function storeJson(kv, key, value) {
  await kv.put(key, JSON.stringify(value), { expirationTtl: EVENT_TTL_SECONDS });
}

async function checkRepositoryRateLimit({ env, identity, kv }) {
  const config = getRepositoryRateLimitConfig(env);
  if (!config) {
    return { allowed: true };
  }

  const key = `rate:pull_request:${identity.installationId}:${identity.repositoryId}`;
  const now = Date.now();
  const windowMs = config.windowSeconds * 1000;
  const existing = await readJson(kv, key);
  const current =
    existing && existing.resetAtEpochMs > now
      ? {
          count: safeNonNegativeInteger(existing.count),
          resetAtEpochMs: existing.resetAtEpochMs
        }
      : {
          count: 0,
          resetAtEpochMs: now + windowMs
        };

  if (current.count >= config.maxEvents) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((current.resetAtEpochMs - now) / 1000))
    };
  }

  await storeRateLimitCounter(kv, key, {
    count: current.count + 1,
    resetAtEpochMs: current.resetAtEpochMs,
    windowSeconds: config.windowSeconds,
    maxEvents: config.maxEvents
  });
  return { allowed: true };
}

async function readJson(kv, key) {
  const value = await kv.get(key);
  if (!value) return null;
  try {
    return JSON.parse(value);
  } catch {
    return null;
  }
}

async function storeRateLimitCounter(kv, key, value) {
  await kv.put(key, JSON.stringify(value), { expirationTtl: value.windowSeconds });
}

function getRepositoryRateLimitConfig(env = {}) {
  const maxEvents = positiveIntegerValue(env.RATE_LIMIT_MAX_EVENTS_PER_REPOSITORY_PER_MINUTE);
  if (maxEvents === undefined) return null;

  return {
    maxEvents,
    windowSeconds: positiveIntegerValue(env.RATE_LIMIT_WINDOW_SECONDS) ?? DEFAULT_RATE_LIMIT_WINDOW_SECONDS
  };
}

function positiveIntegerValue(value) {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : undefined;
}

function safeNonNegativeInteger(value) {
  return Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

async function isHostedProcessingPaused(env, kv) {
  if (booleanFlag(env.HOSTED_PROCESSING_PAUSED)) {
    return true;
  }

  if (typeof kv?.get !== "function") {
    return false;
  }

  return booleanFlag(await kv.get(HOSTED_PROCESSING_PAUSED_KEY));
}

function booleanFlag(value) {
  if (typeof value !== "string") return false;
  return ["1", "true", "yes", "on", "paused"].includes(value.trim().toLowerCase());
}

async function handleInstallationCleanupEvent({ kv, deliveryKey, deliveryId, eventName, payload }) {
  const cleanup = resolveInstallationCleanup(payload, eventName);
  await storeJson(kv, deliveryKey, {
    deliveryId,
    eventName,
    accepted: true,
    reason: cleanup.reason,
    installationId: cleanup.installationId,
    repositoryIds: cleanup.repositoryIds,
    receivedAt: new Date().toISOString()
  });

  if (!cleanup.cleaned || cleanup.installationId === undefined) {
    return { ...cleanup, deletedRecords: 0 };
  }

  const deletedRecords = await deleteCompactRecordsForInstallation({
    kv,
    installationId: cleanup.installationId,
    repositoryIds: cleanup.repositoryIds
  });
  return { ...cleanup, deletedRecords };
}

function resolveInstallationCleanup(payload, eventName) {
  const installationId = integerValue(payload?.installation?.id);
  if (installationId === undefined) {
    return {
      cleaned: false,
      reason: "missing_installation_id",
      installationId,
      repositoryIds: []
    };
  }

  if (eventName === "installation" && payload?.action === "deleted") {
    return {
      cleaned: true,
      reason: "installation_deleted",
      installationId,
      repositoryIds: []
    };
  }

  if (eventName === "installation_repositories" && payload?.action === "removed") {
    const repositoryIds = Array.isArray(payload?.repositories_removed)
      ? payload.repositories_removed.map((repo) => integerValue(repo?.id)).filter((id) => id !== undefined)
      : [];
    return {
      cleaned: repositoryIds.length > 0,
      reason: repositoryIds.length > 0 ? "repositories_removed" : "no_removed_repositories",
      installationId,
      repositoryIds
    };
  }

  return {
    cleaned: false,
    reason: "installation_event_ignored",
    installationId,
    repositoryIds: []
  };
}

async function deleteCompactRecordsForInstallation({ kv, installationId, repositoryIds }) {
  if (typeof kv?.list !== "function" || typeof kv?.delete !== "function") {
    return 0;
  }

  let deleted = 0;
  const prefixes =
    repositoryIds.length > 0
      ? repositoryIds.map((repositoryId) => `scan:${installationId}:${repositoryId}:`)
      : [`scan:${installationId}:`];

  for (const prefix of prefixes) {
    let cursor;
    do {
      const page = await kv.list({ prefix, cursor });
      for (const key of page.keys ?? []) {
        if (typeof key?.name !== "string") continue;
        await kv.delete(key.name);
        deleted += 1;
      }
      cursor = page.list_complete === false ? page.cursor : undefined;
    } while (cursor);
  }

  return deleted;
}

async function runHostedPrRiskCheck({ env, identity, scanKey, scannerVersion }) {
  try {
    await storeJson(env.HOSTED_EVENTS, scanKey, {
      key: scanKey,
      status: "running",
      identity,
      scannerVersion,
      updatedAt: new Date().toISOString(),
      privacy: HOSTED_WORKER_PRIVACY
    });

    const installationToken = await requestGitHubInstallationToken({ env, identity });
    const pullRequestFiles = await fetchPullRequestFiles({ env, identity, installationToken });
    const report = classifyPullRequestFiles(pullRequestFiles);
    const checkRun = await createGitHubCheckRun({ env, identity, installationToken, scannerVersion, report });

    const completed = {
      key: scanKey,
      status: "completed",
      identity,
      scannerVersion,
      checkRunId: checkRun.id,
      checkRunUrl: checkRun.url,
      conclusion: checkRun.conclusion,
      summary: report.summary,
      categories: report.categories,
      topRiskyFiles: report.topRiskyFiles,
      updatedAt: new Date().toISOString(),
      privacy: HOSTED_WORKER_PRIVACY
    };
    await storeJson(env.HOSTED_EVENTS, scanKey, completed);
    return {
      status: "completed",
      conclusion: checkRun.conclusion,
      checkRunId: checkRun.id
    };
  } catch (error) {
    const safeReason = safeErrorReason(error);
    await storeJson(env.HOSTED_EVENTS, scanKey, {
      key: scanKey,
      status: "failed",
      identity,
      scannerVersion,
      reason: safeReason,
      updatedAt: new Date().toISOString(),
      privacy: HOSTED_WORKER_PRIVACY
    });
    return {
      status: "failed",
      conclusion: "neutral",
      reason: safeReason
    };
  }
}

async function requestGitHubInstallationToken({ env, identity }) {
  const githubFetch = getGitHubFetch(env);
  const jwt = await createGitHubAppJwt({
    appId: env.GITHUB_APP_ID,
    privateKeyPem: env.GITHUB_APP_PRIVATE_KEY
  });
  const response = await githubFetch(
    `${githubApiBaseUrl(env)}/app/installations/${identity.installationId}/access_tokens`,
    {
      method: "POST",
      headers: githubHeaders(`Bearer ${jwt}`),
      body: JSON.stringify({
        repository_ids: [identity.repositoryId],
        permissions: {
          checks: "write",
          contents: "read",
          pull_requests: "read"
        }
      })
    }
  );

  if (!response.ok) {
    throw createGitHubApiError("installation_token", response.status);
  }

  const body = await response.json();
  if (typeof body?.token !== "string" || body.token.length === 0) {
    throw createGitHubApiError("installation_token", "missing_token");
  }
  return body.token;
}

async function fetchPullRequestFiles({ env, identity, installationToken }) {
  const repository = splitRepositoryFullName(identity.repositoryFullName);
  if (!repository) throw createGitHubApiError("pull_request_files", "invalid_repository");

  const githubFetch = getGitHubFetch(env);
  const files = [];
  let truncated = false;

  for (let page = 1; page <= MAX_PR_FILES_PAGES; page += 1) {
    const url = new URL(
      `${githubApiBaseUrl(env)}/repos/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.repo)}/pulls/${identity.pullRequestNumber}/files`
    );
    url.searchParams.set("per_page", "100");
    url.searchParams.set("page", String(page));

    const response = await githubFetch(url.toString(), {
      method: "GET",
      headers: githubHeaders(`Bearer ${installationToken}`)
    });
    if (!response.ok) {
      throw createGitHubApiError("pull_request_files", response.status);
    }

    const pageFiles = await response.json();
    if (!Array.isArray(pageFiles)) throw createGitHubApiError("pull_request_files", "invalid_response");

    for (const file of pageFiles) {
      const filename = stringValue(file?.filename);
      if (!filename) continue;
      files.push({
        path: filename,
        additions: integerValue(file?.additions) ?? 0,
        deletions: integerValue(file?.deletions) ?? 0,
        patch: truncatePatch(stringValue(file?.patch) ?? "")
      });
    }

    if (pageFiles.length < 100) break;
    if (page === MAX_PR_FILES_PAGES) truncated = true;
  }

  return { files, truncated };
}

async function createGitHubCheckRun({ env, identity, installationToken, scannerVersion, report }) {
  const repository = splitRepositoryFullName(identity.repositoryFullName);
  if (!repository) throw createGitHubApiError("check_run", "invalid_repository");

  const conclusion = report.summary.high > 0 || report.summary.medium > 0 ? "neutral" : "success";
  const payload = {
    name: "ai-saas-guard PR risk",
    head_sha: identity.headSha,
    status: "completed",
    conclusion,
    completed_at: new Date().toISOString(),
    output: {
      title: "AI SaaS Guard PR risk",
      summary: renderCheckRunSummary({ identity, report, scannerVersion })
    }
  };

  const response = await getGitHubFetch(env)(
    `${githubApiBaseUrl(env)}/repos/${encodeURIComponent(repository.owner)}/${encodeURIComponent(repository.repo)}/check-runs`,
    {
      method: "POST",
      headers: githubHeaders(`Bearer ${installationToken}`),
      body: JSON.stringify(payload)
    }
  );
  if (!response.ok) {
    throw createGitHubApiError("check_run", response.status);
  }

  const body = await response.json();
  return {
    id: integerValue(body?.id),
    url: stringValue(body?.html_url),
    conclusion
  };
}

function classifyPullRequestFiles({ files, truncated }) {
  const categories = new Set();
  const topRiskyFiles = files
    .map((file) => {
      const fileCategories = classifyPrFile(file);
      for (const category of fileCategories) categories.add(category);
      return {
        path: file.path,
        categories: fileCategories,
        added: file.additions,
        removed: file.deletions,
        score:
          fileCategories.reduce((total, category) => total + CATEGORY_WEIGHTS[category], 0) +
          Math.min(30, Math.ceil((file.additions + file.deletions) / 20)) +
          (/^(app\/api|pages\/api)\//.test(file.path) ? 24 : 0)
      };
    })
    .filter((file) => file.categories.length > 0 && file.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  if (truncated) categories.add("large AI-generated/refactor-like diff");

  const findings = topRiskyFiles.slice(0, 5).map((file) => ({
    ruleId: "pr-risk.sensitive-surface",
    title: `Review first: ${file.path}`,
    severity: file.score >= 70 ? "high" : "medium",
    evidence: [{ file: file.path, match: file.categories.join(", ") }],
    why: "AI-generated PRs often bury trust-boundary changes inside larger diffs; this file touches sensitive surfaces.",
    suggestedVerification: `Review this file for ${file.categories.join(", ")} and confirm tests cover the changed behavior.`,
    suggestedFix: "Split unrelated UI/refactor work away from trust-boundary changes and add focused tests before merge."
  }));

  const categoryList = [...categories].sort((a, b) => CATEGORY_WEIGHTS[b] - CATEGORY_WEIGHTS[a]);
  const summary = summarizeFindings(findings);

  return {
    findings,
    summary,
    categories: categoryList,
    topRiskyFiles: topRiskyFiles.map(({ path, score, categories: fileCategories, added, removed }) => ({
      path,
      score,
      categories: fileCategories,
      added,
      removed
    })),
    truncated
  };
}

function classifyPrFile(file) {
  const changedText = file.patch
    .split(/\r?\n/)
    .filter((line) => (line.startsWith("+") && !line.startsWith("+++")) || (line.startsWith("-") && !line.startsWith("---")))
    .map((line) => line.slice(1))
    .join("\n");
  const searchableText = `${file.path}\n${changedText}`;
  const categories = new Set();

  if (isGitHubAutomationFile(file.path)) {
    categories.add("env/secrets/deploy");
    if (/\b(permissions?|storage|contents|actions|security-events|id-token)\b/i.test(searchableText)) {
      categories.add("permissions/storage");
    }
  } else if (!isTestFile(file.path)) {
    if (isAuthSurface(file.path) || (isAppSurface(file.path) && /\b(auth|session|jwt|cookie|middleware|login|user_id|owner_id|tenant_id)\b/i.test(changedText))) {
      categories.add("auth/session");
    }
    if (
      isBillingSurface(file.path) ||
      (isAppSurface(file.path) && /\b(stripe|billing|subscription|invoice|payment|webhook|entitlement)\b|checkout\.session/i.test(changedText))
    ) {
      categories.add("billing/subscription");
    }
    if (isDatabaseSurface(file.path) || /^\s*(create|alter)\s+table\b/im.test(changedText)) categories.add("database schema/migration");
    if (isRlsSurface(file.path) && /(row level security|create policy|using\s*\(\s*true\s*\)|\brls\b|policy)/i.test(changedText)) {
      categories.add("RLS/policy");
    }
    if (isApiSurface(file.path) || (isAppSurface(file.path) && /\b(Request|Response|Response\.json|NextRequest|NextResponse)\b/.test(changedText))) {
      categories.add("API contract");
    }
    if (isEnvDeploySurface(file.path) || /\b(process\.env|import\.meta\.env)\b/.test(changedText)) categories.add("env/secrets/deploy");
    if (isPermissionSurface(file.path) || /^\s*(grant|revoke)\b/im.test(changedText)) categories.add("permissions/storage");
  }

  if (isRemovedOrWeakenedTest(file.path, file.patch)) {
    categories.add("tests removed or weakened");
  }
  if (file.additions + file.deletions > 400 || /(^|\/)(__generated__|generated)(\/|\.|-|$)/i.test(file.path)) {
    categories.add("large AI-generated/refactor-like diff");
  }

  return [...categories];
}

function summarizeFindings(findings) {
  const summary = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    info: 0,
    total: findings.length
  };
  for (const item of findings) {
    if (Object.hasOwn(summary, item.severity)) summary[item.severity] += 1;
  }
  return summary;
}

function renderCheckRunSummary({ identity, report, scannerVersion }) {
  const riskAreas = summarizeHostedRiskAreas(report.topRiskyFiles);
  const lines = [
    `Launch-risk gate: ${report.summary.total} PR risk signal(s) for ${identity.repositoryFullName}#${identity.pullRequestNumber}.`,
    "Review task: inspect risk areas and files before merge.",
    "Manual proof: prove changed auth, billing, data, deploy, or tests fail closed.",
    "",
    "Risk areas:",
    ...(riskAreas.length === 0
      ? ["- None"]
      : riskAreas.slice(0, 5).map((area) => `- ${area.name}: ${area.count} file(s). Proof: ${area.proof}`)),
    "",
    "Review queue:"
  ];

  if (report.topRiskyFiles.length > 0) {
    for (const file of report.topRiskyFiles.slice(0, 5)) {
      lines.push(`- ${file.path}: ${file.categories.join(", ")} (${file.added}+/${file.removed}-)`);
    }
    lines.push(
      "",
      "Reviewer checklist:",
      "- What trust boundary changed?",
      "- Why is this auth, billing, data, deploy, or test decision safe?",
      "- What manual proof shows it fails closed?"
    );
  } else {
    lines.push("- None");
  }

  lines.push(
    "",
    `Boundary: selected repository only; scanner ${scannerVersion}; not an AI reviewer, pentest, full audit, or certification.`,
    "Privacy: compact file/category signals only; no webhook bodies, PR text, source, diffs, secrets, checkout paths, or installation tokens."
  );

  if (report.truncated) {
    lines.push("", "Note: PR file pagination was capped; run the local CLI for a complete review.");
  }

  return lines.join("\n").slice(0, 6_000);
}

function summarizeHostedRiskAreas(files) {
  const counts = new Map();
  for (const file of files) {
    for (const category of file.categories) {
      const area = hostedRiskAreaForCategory(category);
      counts.set(area.key, {
        ...area,
        count: (counts.get(area.key)?.count ?? 0) + 1
      });
    }
  }

  return [...counts.values()].sort((a, b) => {
    if (b.weight !== a.weight) return b.weight - a.weight;
    return b.count - a.count;
  });
}

function hostedRiskAreaForCategory(category) {
  if (category === "auth/session") {
    return {
      key: "auth",
      name: "Auth and session",
      weight: 50,
      proof: "use two accounts and confirm access, session, and ownership checks fail closed"
    };
  }
  if (category === "billing/subscription") {
    return {
      key: "billing",
      name: "Billing and entitlement",
      weight: 50,
      proof: "force unsigned, duplicate, failed, and canceled billing events before granting access"
    };
  }
  if (category === "database schema/migration" || category === "RLS/policy") {
    return {
      key: "data",
      name: "Tenant data access",
      weight: 45,
      proof: "run cross-tenant SELECT, INSERT, UPDATE, and DELETE checks with user A and user B"
    };
  }
  if (category === "env/secrets/deploy" || category === "permissions/storage") {
    return {
      key: "deploy",
      name: "Deploy, secrets, and permissions",
      weight: 35,
      proof: "confirm production env, workflow permissions, and storage scopes are least privilege"
    };
  }
  if (category === "tests removed or weakened") {
    return {
      key: "tests",
      name: "Tests and silent success",
      weight: 40,
      proof: "make the upstream path fail and confirm tests catch an error instead of fake success"
    };
  }
  if (category === "API contract") {
    return {
      key: "api",
      name: "API contract",
      weight: 30,
      proof: "exercise invalid, unauthorized, and failed upstream requests against changed routes"
    };
  }
  return {
    key: "large-diff",
    name: "Large AI diff",
    weight: 20,
    proof: "split unrelated UI, refactor, and trust-boundary changes before review"
  };
}

async function createGitHubAppJwt({ appId, privateKeyPem }) {
  if (!appId || !privateKeyPem) throw createGitHubApiError("jwt", "missing_config");

  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlEncodeJson({ alg: "RS256", typ: "JWT" });
  const payload = base64UrlEncodeJson({
    iat: now - 60,
    exp: now + 9 * 60,
    iss: String(appId)
  });
  const signingInput = `${header}.${payload}`;
  const key = await importRsaPrivateKey(privateKeyPem);
  const signature = await crypto.subtle.sign(
    { name: "RSASSA-PKCS1-v1_5" },
    key,
    new TextEncoder().encode(signingInput)
  );
  return `${signingInput}.${base64UrlEncodeBytes(new Uint8Array(signature))}`;
}

async function importRsaPrivateKey(privateKeyPem) {
  const { label, der } = parsePem(privateKeyPem);
  const pkcs8Der = label === "RSA PRIVATE KEY" ? wrapPkcs1RsaPrivateKey(der) : der;
  return crypto.subtle.importKey(
    "pkcs8",
    pkcs8Der,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"]
  );
}

function parsePem(pem) {
  const normalized = String(pem).trim().replace(/\\n/g, "\n");
  const match = /-----BEGIN ([A-Z ]+)-----([\s\S]+?)-----END \1-----/.exec(normalized);
  if (!match || !["PRIVATE KEY", "RSA PRIVATE KEY"].includes(match[1])) {
    throw createGitHubApiError("jwt", "invalid_private_key");
  }
  return {
    label: match[1],
    der: base64ToBytes(match[2].replace(/\s+/g, ""))
  };
}

function wrapPkcs1RsaPrivateKey(pkcs1Der) {
  const algorithmIdentifier = derSequence(
    new Uint8Array([0x06, 0x09, 0x2a, 0x86, 0x48, 0x86, 0xf7, 0x0d, 0x01, 0x01, 0x01]),
    new Uint8Array([0x05, 0x00])
  );
  return derSequence(
    new Uint8Array([0x02, 0x01, 0x00]),
    algorithmIdentifier,
    derOctetString(pkcs1Der)
  );
}

function derSequence(...parts) {
  return derWrap(0x30, concatBytes(...parts));
}

function derOctetString(bytes) {
  return derWrap(0x04, bytes);
}

function derWrap(tag, value) {
  return concatBytes(new Uint8Array([tag]), derLength(value.length), value);
}

function derLength(length) {
  if (length < 128) return new Uint8Array([length]);
  const bytes = [];
  let remaining = length;
  while (remaining > 0) {
    bytes.unshift(remaining & 0xff);
    remaining >>= 8;
  }
  return new Uint8Array([0x80 | bytes.length, ...bytes]);
}

function concatBytes(...parts) {
  const totalLength = parts.reduce((total, part) => total + part.length, 0);
  const output = new Uint8Array(totalLength);
  let offset = 0;
  for (const part of parts) {
    output.set(part, offset);
    offset += part.length;
  }
  return output;
}

function base64UrlEncodeJson(value) {
  return base64UrlEncodeBytes(new TextEncoder().encode(JSON.stringify(value)));
}

function base64UrlEncodeBytes(bytes) {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 8192) {
    binary += String.fromCharCode(...bytes.slice(index, index + 8192));
  }
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
}

function base64ToBytes(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function hasGitHubCheckRunConfig(env = {}) {
  return Boolean(env.GITHUB_APP_ID && env.GITHUB_APP_PRIVATE_KEY && env.GITHUB_APP_INSTALLATION_ID);
}

function configuredInstallationMatches(env = {}, installationId) {
  if (!env.GITHUB_APP_INSTALLATION_ID) return true;
  return String(env.GITHUB_APP_INSTALLATION_ID) === String(installationId);
}

function getGitHubFetch(env = {}) {
  return typeof env.GITHUB_FETCH === "function" ? env.GITHUB_FETCH : fetch;
}

function githubApiBaseUrl(env = {}) {
  return String(env.GITHUB_API_BASE_URL || "https://api.github.com").replace(/\/+$/g, "");
}

function githubHeaders(authorization) {
  return {
    accept: "application/vnd.github+json",
    authorization,
    "content-type": "application/json",
    "github-api-version": "2022-11-28",
    "user-agent": "ai-saas-guard-hosted"
  };
}

function splitRepositoryFullName(fullName) {
  const match = /^([^/\s]+)\/([^/\s]+)$/.exec(fullName);
  return match ? { owner: match[1], repo: match[2] } : null;
}

function truncatePatch(patch) {
  return patch.length > MAX_PATCH_CHARS_PER_FILE ? patch.slice(0, MAX_PATCH_CHARS_PER_FILE) : patch;
}

function createGitHubApiError(stage, reason) {
  const error = new Error(`${stage}:${reason}`);
  error.stage = stage;
  error.safeReason = `${stage}_${reason}`;
  return error;
}

function safeErrorReason(error) {
  return typeof error?.safeReason === "string" ? error.safeReason : "github_check_run_failed";
}

function isGitHubAutomationFile(filePath) {
  return filePath === "action.yml" || filePath === "action.yaml" || filePath.startsWith(".github/workflows/") || filePath.startsWith(".github/actions/");
}

function isTestFile(filePath) {
  return /(^|\/)(__tests__|tests?|specs?)\//i.test(filePath) || /\.(test|spec)\.[cm]?[jt]sx?$/i.test(filePath);
}

function isAppSurface(filePath) {
  return /^(app|pages|src\/app|src\/pages)\//.test(filePath) || /(^|\/)(api|server|routes?)\//i.test(filePath) || /(^|\/)(route|middleware)\.[cm]?[jt]sx?$/i.test(filePath);
}

function isApiSurface(filePath) {
  return /^(app|pages|src\/app|src\/pages)\/api\//.test(filePath) || /(^|\/)(api|routes?)\//i.test(filePath) || /(^|\/)route\.[cm]?[jt]sx?$/i.test(filePath);
}

function isAuthSurface(filePath) {
  return /(^|\/)(auth|session|middleware)(\/|\.|-|$)/i.test(filePath);
}

function isBillingSurface(filePath) {
  return /(^|\/)(stripe|billing|subscription|invoice|payment|webhook|entitlement)(\/|\.|-|$)/i.test(filePath);
}

function isDatabaseSurface(filePath) {
  return /(^|\/)(migrations?|schema\.prisma|db\/schema)|\.sql$/i.test(filePath);
}

function isRlsSurface(filePath) {
  return /(^|\/)(supabase|migrations?|policies?)\//i.test(filePath) || /\.sql$/i.test(filePath);
}

function isEnvDeploySurface(filePath) {
  return /(^|\/)(\.env|\.env\.[^/]+|vercel\.json|netlify\.toml|Dockerfile|docker-compose|wrangler\.(toml|jsonc?)|next\.config\.[cm]?[jt]s)$/i.test(filePath);
}

function isPermissionSurface(filePath) {
  return /(^|\/)(storage|roles?|permissions?)\//i.test(filePath);
}

function isRemovedOrWeakenedTest(filePath, patch) {
  const lines = patch.split(/\r?\n/);
  const hasRemovedLine = lines.some((line) => line.startsWith("-") && !line.startsWith("---"));
  if (!hasRemovedLine) return false;
  return (
    lines.some((line) => /^deleted file mode\b/.test(line)) ||
    isTestFile(filePath) ||
    lines.some((line) => /^-\s*(test|describe)\s*\(/i.test(line) || /^-\s*(expect|assert)\b/i.test(line))
  );
}

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: JSON_HEADERS
  });
}
