/**
 * ai-saas-guard staging source-checkout worker (plain Worker, no containers).
 *
 * Staging-only companion to the live webhook-ingress worker
 * (`hosted/cloudflare-worker`, `ai-saas-guard-hosted`). It runs the REAL
 * scanner engine — the identical rule code as the CLI (`classifyPrRisk` plus
 * the full `scan` suite) — over SHA-pinned PR source supplied by the staging
 * orchestrator. The live ingress worker only classifies PR file metadata;
 * this worker executes all 66 deterministic rules over actual file contents.
 *
 * Trust and privacy design:
 * - The worker holds NO GitHub credentials. The staging orchestrator fetches
 *   the unified diff and changed-file contents at the pinned head SHA via the
 *   GitHub API and POSTs them here. Nothing in the worker can mint tokens,
 *   clone repos, or publish Check Runs.
 * - The staging repository allowlist plus full-SHA validation is the trust
 *   boundary: content is addressable by SHA, which is stronger than
 *   branch-name pinning.
 * - Stateless: nothing is persisted. No KV, no Durable Objects, no logs of
 *   request bodies. Cleanup is trivially complete because nothing is stored.
 * - Only compact findings (ruleId, severity, file, line) leave the worker.
 *   Raw source, raw diffs, PR text, matches, and snippets never do.
 */

import { runSourceScan } from "./engine.js";
import {
  ScanJobValidationError,
  STAGING_PRIVACY_FLAGS,
  validateScanJobRequest
} from "./job.js";

interface WorkerEnv {
  SCANNER_VERSION?: string;
  SCAN_SECRET?: string;
}

const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };

function jsonResponse(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: JSON_HEADERS });
}

function bearerToken(header: string | null): string | undefined {
  if (typeof header !== "string") return undefined;
  const match = /^Bearer (.+)$/.exec(header.trim());
  return match ? match[1] : undefined;
}

function constantTimeEqual(left: string, right: string): boolean {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return mismatch === 0;
}

function authorized(request: Request, env: WorkerEnv): boolean {
  const secret = env.SCAN_SECRET;
  if (!secret) return false;
  const presented = bearerToken(request.headers.get("authorization"));
  return typeof presented === "string" && constantTimeEqual(presented, secret);
}

function healthPayload(env: WorkerEnv): Record<string, unknown> {
  return {
    ok: true,
    service: "ai-saas-guard-source-checkout-staging",
    mode: "source-checkout-worker-staging",
    roles: ["scan-worker"],
    scannerEngine: "cli-identical",
    scannerVersion: env.SCANNER_VERSION || "0.43.3",
    stagingOnly: true,
    stateless: true,
    privacy: STAGING_PRIVACY_FLAGS
  };
}

async function handleScan(request: Request, env: WorkerEnv): Promise<Response> {
  if (!env.SCAN_SECRET) {
    return jsonResponse(503, { ok: false, reason: "scan_not_configured", privacy: STAGING_PRIVACY_FLAGS });
  }
  if (!authorized(request, env)) {
    return jsonResponse(401, { ok: false, reason: "unauthorized", privacy: STAGING_PRIVACY_FLAGS });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonResponse(400, { ok: false, reason: "invalid_json", privacy: STAGING_PRIVACY_FLAGS });
  }

  let job;
  try {
    job = validateScanJobRequest((body as Record<string, unknown>) ?? {});
  } catch (error) {
    const code = error instanceof ScanJobValidationError ? error.code : "invalid_job";
    return jsonResponse(400, { ok: false, reason: code, privacy: STAGING_PRIVACY_FLAGS });
  }

  try {
    const result = await runSourceScan(job, { scannerVersion: env.SCANNER_VERSION || "0.43.3" });
    return jsonResponse(200, { ok: true, result, privacy: STAGING_PRIVACY_FLAGS });
  } catch (error) {
    return jsonResponse(500, {
      ok: false,
      reason: "scan_failed",
      detail: error instanceof Error ? error.message.slice(0, 200) : "unknown",
      jobKey: job.jobKey,
      privacy: STAGING_PRIVACY_FLAGS
    });
  }
}

export default {
  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === "GET" && (url.pathname === "/" || url.pathname === "/healthz")) {
      return jsonResponse(200, healthPayload(env));
    }

    if (request.method === "POST" && url.pathname === "/scan") {
      return handleScan(request, env);
    }

    return jsonResponse(404, { ok: false, reason: "not_found", privacy: STAGING_PRIVACY_FLAGS });
  }
};
