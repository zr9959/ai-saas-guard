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

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/healthz")) {
      return jsonResponse(200, createHostedWorkerHealth());
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
};

export function createHostedWorkerHealth() {
  return {
    ok: true,
    service: "ai-saas-guard-hosted",
    mode: "webhook-ingress",
    routes: ["/healthz", "/github/app/manifest-callback", "/github/webhook"],
    storage: "cloudflare_kv",
    checkRunPublisher: "not_configured",
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

function jsonResponse(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: JSON_HEADERS
  });
}
