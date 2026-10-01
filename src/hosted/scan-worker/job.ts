/**
 * Pure scan-job validation for the staging source-checkout worker.
 *
 * Cloud-independent: no `cloudflare:workers` imports, safe under node:test.
 * The worker receives PR source from the staging orchestrator (which fetches
 * SHA-pinned file contents and the unified diff via the GitHub API). The
 * worker never holds GitHub credentials and never touches the network for
 * source: the trust boundary is the pinned head/base SHA pair plus the
 * staging repository allowlist.
 */

export interface SourceFileInput {
  path: string;
  content: string;
}

export interface ScanJobRequestBody {
  repositoryFullName?: unknown;
  pullRequestNumber?: unknown;
  baseSha?: unknown;
  headSha?: unknown;
  diffText?: unknown;
  files?: unknown;
}

export interface ValidatedScanJob {
  jobKey: string;
  repositoryFullName: string;
  pullRequestNumber: number;
  baseSha: string;
  headSha: string;
  diffText: string;
  files: SourceFileInput[];
}

export const STAGING_ALLOWED_REPOSITORIES: ReadonlySet<string> = new Set(["zr9959/ai-saas-guard"]);

export const SCAN_JOB_LIMITS = {
  maxFiles: 300,
  maxFileBytes: 256 * 1024,
  maxTotalBytes: 2 * 1024 * 1024,
  maxDiffBytes: 2 * 1024 * 1024,
  jobKeyMaxLength: 160
} as const;

export const STAGING_PRIVACY_FLAGS = {
  includesRawWebhookPayload: false,
  includesUntrustedPrText: false,
  includesRawSource: false,
  includesRawDiffs: false,
  includesSecrets: false,
  includesCustomerPayloads: false,
  includesPrivateCheckoutPath: false,
  includesInstallationToken: false,
  checkRunPublishedByWorker: false,
  persistsScanRecords: false
} as const;

const SHA_RE = /^[a-f0-9]{40}$/i;
const REPO_RE = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const JOB_KEY_RE = /^[A-Za-z0-9:_\-.]{1,160}$/;

const textEncoder = new TextEncoder();

function utf8Bytes(value: string): number {
  return textEncoder.encode(value).length;
}

export class ScanJobValidationError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = "ScanJobValidationError";
    this.code = code;
  }
}

export function buildScanJobKey(input: {
  repositoryFullName: string;
  pullRequestNumber: number;
  headSha: string;
}): string {
  const [owner, repo] = input.repositoryFullName.split("/");
  return `scan:staging:${owner}:${repo}:${input.pullRequestNumber}:${input.headSha}`;
}

function asNonEmptyString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function validateSha(label: string, value: unknown): string {
  const text = asNonEmptyString(value);
  if (!text || !SHA_RE.test(text)) {
    throw new ScanJobValidationError("invalid_sha", `${label} must be a 40-character hex SHA`);
  }
  return text.toLowerCase();
}

export function validateScanJobRequest(body: ScanJobRequestBody): ValidatedScanJob {
  const repositoryFullName = asNonEmptyString(body?.repositoryFullName);
  if (!repositoryFullName || !REPO_RE.test(repositoryFullName)) {
    throw new ScanJobValidationError("invalid_repository", "repositoryFullName must look like owner/repo");
  }
  if (!STAGING_ALLOWED_REPOSITORIES.has(repositoryFullName)) {
    throw new ScanJobValidationError("repository_not_allowed", "repository is not in the staging allowlist");
  }

  const pullRequestNumber = body?.pullRequestNumber;
  if (typeof pullRequestNumber !== "number" || !Number.isInteger(pullRequestNumber) || pullRequestNumber <= 0) {
    throw new ScanJobValidationError("invalid_pr_number", "pullRequestNumber must be a positive integer");
  }

  const baseSha = validateSha("baseSha", body?.baseSha);
  const headSha = validateSha("headSha", body?.headSha);

  const diffText = asNonEmptyString(body?.diffText);
  if (!diffText) {
    throw new ScanJobValidationError("diff_required", "diffText (unified diff) is required");
  }
  if (utf8Bytes(diffText) > SCAN_JOB_LIMITS.maxDiffBytes) {
    throw new ScanJobValidationError("diff_too_large", "diffText exceeds the staging size cap");
  }

  if (!Array.isArray(body?.files) || body.files.length === 0) {
    throw new ScanJobValidationError("files_required", "files (changed-file contents at head SHA) is required");
  }
  if (body.files.length > SCAN_JOB_LIMITS.maxFiles) {
    throw new ScanJobValidationError("too_many_files", `files exceeds the staging cap of ${SCAN_JOB_LIMITS.maxFiles}`);
  }

  const files: SourceFileInput[] = [];
  let totalBytes = 0;
  for (const entry of body.files) {
    const path = asNonEmptyString((entry as { path?: unknown })?.path);
    const content = typeof (entry as { content?: unknown })?.content === "string" ? (entry as { content: string }).content : undefined;
    if (!path || content === undefined) {
      throw new ScanJobValidationError("invalid_file_entry", "every file entry needs { path, content }");
    }
    if (path.startsWith("/") || path.includes("..")) {
      throw new ScanJobValidationError("invalid_file_path", "file paths must be repo-relative without traversal");
    }
    const bytes = utf8Bytes(content);
    if (bytes > SCAN_JOB_LIMITS.maxFileBytes) {
      throw new ScanJobValidationError("file_too_large", `file ${path} exceeds the per-file staging cap`);
    }
    totalBytes += bytes;
    if (totalBytes > SCAN_JOB_LIMITS.maxTotalBytes) {
      throw new ScanJobValidationError("total_too_large", "combined file contents exceed the staging cap");
    }
    files.push({ path, content });
  }

  const jobKey = buildScanJobKey({ repositoryFullName, pullRequestNumber, headSha });
  if (!JOB_KEY_RE.test(jobKey) || jobKey.length > SCAN_JOB_LIMITS.jobKeyMaxLength) {
    throw new ScanJobValidationError("invalid_job_key", "derived job key failed the charset check");
  }

  return { jobKey, repositoryFullName, pullRequestNumber, baseSha, headSha, diffText, files };
}
