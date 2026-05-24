import { execFile } from "node:child_process";
import { chmod, mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import {
  HOSTED_WORKER_DEFAULT_TIMEOUT_MS,
  HOSTED_WORKER_MAX_OUTPUT_BYTES,
  HOSTED_WORKER_MAX_TIMEOUT_MS
} from "./production-adapters.js";
import type {
  HostedServiceScanRunner,
  HostedServiceScanRunnerInput,
  HostedServiceScanRunnerResult
} from "./service.js";
import type { CompactHostedFinding } from "./contracts.js";

const execFileAsync = promisify(execFile);
const DEFAULT_GITHUB_CLONE_BASE_URL = "https://github.com";
const DEFAULT_FETCH_DEPTH = 100;
const MAX_FETCH_DEPTH = 1_000;
const MAX_COMPACT_FINDINGS = 200;

export type HostedReadOnlyCheckoutCommandStage =
  | "git_init"
  | "git_remote_add"
  | "git_fetch_head"
  | "git_fetch_base"
  | "git_checkout"
  | "cli_scan";

export interface HostedReadOnlyCheckoutCommand {
  stage: HostedReadOnlyCheckoutCommandStage;
  command: string;
  args: string[];
  cwd: string;
  env: Record<string, string>;
  timeoutMs: number;
  maxOutputBytes: number;
  shell: false;
}

export interface HostedReadOnlyCheckoutCommandResult {
  stdout: string;
}

export type HostedReadOnlyCheckoutCommandRunner = (
  command: HostedReadOnlyCheckoutCommand
) => Promise<HostedReadOnlyCheckoutCommandResult> | HostedReadOnlyCheckoutCommandResult;

export type HostedInstallationTokenProvider = (
  input: HostedServiceScanRunnerInput
) => Promise<string> | string;

export interface HostedReadOnlyCheckoutScanRunnerOptions {
  checkoutRoot?: string;
  githubCloneBaseUrl?: string;
  gitCommand?: string;
  cliCommand?: string;
  fetchDepth?: number;
  timeoutMs?: number;
  maxOutputBytes?: number;
  installationTokenProvider: HostedInstallationTokenProvider;
  commandRunner?: HostedReadOnlyCheckoutCommandRunner;
}

export type HostedReadOnlyCheckoutScanSafeReason =
  | "invalid_worker_plan"
  | "invalid_repository_full_name"
  | "invalid_clone_base_url"
  | "missing_installation_token"
  | "git_init_failed"
  | "git_remote_add_failed"
  | "git_fetch_head_failed"
  | "git_fetch_base_failed"
  | "git_checkout_failed"
  | "cli_scan_failed"
  | "invalid_cli_output"
  | "cleanup_failed";

export class HostedReadOnlyCheckoutScanError extends Error {
  readonly safeReason: HostedReadOnlyCheckoutScanSafeReason;
  readonly privacy = {
    includesTemporaryCheckoutRoot: false,
    includesRawSource: false,
    includesRawDiffs: false,
    includesSecrets: false,
    includesCustomerPayloads: false,
    includesInstallationToken: false
  } as const;

  constructor(safeReason: HostedReadOnlyCheckoutScanSafeReason) {
    super(`hosted_read_only_checkout_scan_failed:${safeReason}`);
    this.name = "HostedReadOnlyCheckoutScanError";
    this.safeReason = safeReason;
  }
}

export function createHostedReadOnlyCheckoutScanRunner(
  options: HostedReadOnlyCheckoutScanRunnerOptions
): HostedServiceScanRunner {
  return (input) => runHostedReadOnlyCheckoutScan(input, options);
}

export async function runHostedReadOnlyCheckoutScan(
  input: HostedServiceScanRunnerInput,
  options: HostedReadOnlyCheckoutScanRunnerOptions
): Promise<HostedServiceScanRunnerResult> {
  const { plan } = input;
  const { checkout, cli } = plan;
  if (!plan.accepted || !plan.readOnly || !checkout || !cli || cli.writeMode !== "read_only") {
    throw new HostedReadOnlyCheckoutScanError("invalid_worker_plan");
  }
  if (!isTrustedFixedReadOnlyPlan(input)) {
    throw new HostedReadOnlyCheckoutScanError("invalid_worker_plan");
  }

  const repository = parseRepositoryFullName(checkout.repositoryFullName);
  if (!repository) {
    throw new HostedReadOnlyCheckoutScanError("invalid_repository_full_name");
  }

  const cloneBaseUrl = normalizeSafeCloneBaseUrl(
    options.githubCloneBaseUrl ?? DEFAULT_GITHUB_CLONE_BASE_URL
  );
  const cloneUrl = `${cloneBaseUrl}/${repository.owner}/${repository.repo}.git`;
  const timeoutMs = clampPositiveInteger(
    options.timeoutMs,
    HOSTED_WORKER_DEFAULT_TIMEOUT_MS,
    HOSTED_WORKER_MAX_TIMEOUT_MS
  );
  const maxOutputBytes = clampPositiveInteger(
    options.maxOutputBytes,
    HOSTED_WORKER_MAX_OUTPUT_BYTES,
    HOSTED_WORKER_MAX_OUTPUT_BYTES
  );
  const fetchDepth = clampPositiveInteger(options.fetchDepth, DEFAULT_FETCH_DEPTH, MAX_FETCH_DEPTH);
  const checkoutRoot = options.checkoutRoot ?? join(tmpdir(), "ai-saas-guard-hosted-checkouts");
  const token = await options.installationTokenProvider(input);
  if (typeof token !== "string" || token.trim().length === 0) {
    throw new HostedReadOnlyCheckoutScanError("missing_installation_token");
  }

  await mkdir(checkoutRoot, { recursive: true, mode: 0o700 });
  const checkoutDir = await mkdtemp(join(checkoutRoot, "job-"));
  let terminalError: HostedReadOnlyCheckoutScanError | undefined;

  try {
    await chmod(checkoutDir, 0o700);
    const askpassPath = join(checkoutDir, ".git-askpass.sh");
    await writeFile(
      askpassPath,
      [
        "#!/bin/sh",
        "case \"$1\" in",
        "*Username*) printf '%s' 'x-access-token' ;;",
        "*Password*) printf '%s' \"$AI_SAAS_GUARD_GITHUB_TOKEN\" ;;",
        "*) printf '%s' '' ;;",
        "esac",
        ""
      ].join("\n"),
      { mode: 0o700 }
    );

    const gitEnv = safeWorkerEnv(checkoutDir, {
      GIT_ASKPASS: askpassPath,
      GIT_TERMINAL_PROMPT: "0",
      GIT_CONFIG_NOSYSTEM: "1",
      GIT_CONFIG_GLOBAL: "/dev/null"
    });
    const gitSecretEnv = { AI_SAAS_GUARD_GITHUB_TOKEN: token };
    const gitCommand = options.gitCommand ?? "git";

    await runCommand(
      options,
      gitSecretEnv,
      commandSpec("git_init", gitCommand, ["init"], checkoutDir, gitEnv, timeoutMs, maxOutputBytes)
    );
    await runCommand(
      options,
      gitSecretEnv,
      commandSpec(
        "git_remote_add",
        gitCommand,
        ["remote", "add", "origin", cloneUrl],
        checkoutDir,
        gitEnv,
        timeoutMs,
        maxOutputBytes
      )
    );
    await runCommand(
      options,
      gitSecretEnv,
      commandSpec(
        "git_fetch_head",
        gitCommand,
        ["fetch", "--no-tags", "--depth", String(fetchDepth), "origin", checkout.targetCommitSha],
        checkoutDir,
        gitEnv,
        timeoutMs,
        maxOutputBytes
      )
    );
    await runCommand(
      options,
      gitSecretEnv,
      commandSpec(
        "git_fetch_base",
        gitCommand,
        ["fetch", "--no-tags", "--depth", String(fetchDepth), "origin", checkout.baseSha],
        checkoutDir,
        gitEnv,
        timeoutMs,
        maxOutputBytes
      )
    );
    await runCommand(
      options,
      gitSecretEnv,
      commandSpec(
        "git_checkout",
        gitCommand,
        ["checkout", "--detach", checkout.targetCommitSha],
        checkoutDir,
        gitEnv,
        timeoutMs,
        maxOutputBytes
      )
    );

    await rm(askpassPath, { force: true });
    const cliEnv = safeWorkerEnv(checkoutDir);
    const cliArgs = cli.args.map((arg) =>
      arg === "<worker-checkout>" ? checkoutDir : arg
    );
    const cliResult = await runCommand(
      options,
      {},
      commandSpec(
        "cli_scan",
        options.cliCommand ?? cli.command,
        cliArgs,
        checkoutDir,
        cliEnv,
        timeoutMs,
        maxOutputBytes
      )
    );

    return compactScanRunnerResult(cliResult.stdout);
  } catch (error) {
    terminalError =
      error instanceof HostedReadOnlyCheckoutScanError
        ? error
        : new HostedReadOnlyCheckoutScanError("cli_scan_failed");
    throw terminalError;
  } finally {
    try {
      await rm(checkoutDir, { recursive: true, force: true });
    } catch {
      if (!terminalError) {
        throw new HostedReadOnlyCheckoutScanError("cleanup_failed");
      }
    }
  }
}

function commandSpec(
  stage: HostedReadOnlyCheckoutCommandStage,
  command: string,
  args: string[],
  cwd: string,
  env: Record<string, string>,
  timeoutMs: number,
  maxOutputBytes: number
): HostedReadOnlyCheckoutCommand {
  return {
    stage,
    command,
    args,
    cwd,
    env,
    timeoutMs,
    maxOutputBytes,
    shell: false
  };
}

async function runCommand(
  options: HostedReadOnlyCheckoutScanRunnerOptions,
  secretEnv: Record<string, string>,
  command: HostedReadOnlyCheckoutCommand
): Promise<HostedReadOnlyCheckoutCommandResult> {
  try {
    if (options.commandRunner) {
      return await options.commandRunner(command);
    }

    const { stdout } = await execFileAsync(command.command, command.args, {
      cwd: command.cwd,
      env: { ...command.env, ...secretEnv },
      timeout: command.timeoutMs,
      maxBuffer: command.maxOutputBytes,
      encoding: "utf8",
      shell: false
    });
    return { stdout };
  } catch {
    throw new HostedReadOnlyCheckoutScanError(
      `${command.stage}_failed` as HostedReadOnlyCheckoutScanSafeReason
    );
  }
}

function compactScanRunnerResult(stdout: string): HostedServiceScanRunnerResult {
  try {
    const report = JSON.parse(stdout) as Record<string, unknown>;
    const findings = Array.isArray(report.findings) ? report.findings : [];

    return {
      summaryCounts: normalizeSummaryCounts(report.summary),
      findings: findings.slice(0, MAX_COMPACT_FINDINGS).flatMap(compactFinding)
    };
  } catch {
    throw new HostedReadOnlyCheckoutScanError("invalid_cli_output");
  }
}

function isTrustedFixedReadOnlyPlan(input: HostedServiceScanRunnerInput): boolean {
  const { plan, queueRecord } = input;
  const { checkout, cli, installationTokenScope, output } = plan;
  const identity = queueRecord.identity;
  if (!checkout || !cli || !installationTokenScope || !output) return false;

  const expectedCliArgs = [
    "pr-risk",
    "--root",
    "<worker-checkout>",
    "--base",
    identity.baseSha,
    "--json"
  ];

  return (
    plan.jobKey === queueRecord.key &&
    plan.readOnly === true &&
    plan.shouldFetchSource === true &&
    plan.shouldRunCli === true &&
    plan.shouldPersistRawSource === false &&
    plan.shouldPersistRawDiffs === false &&
    plan.shouldCreatePrComment === false &&
    installationTokenScope.installationId === identity.installationId &&
    installationTokenScope.repositoryId === identity.repositoryId &&
    installationTokenScope.permissions.contents === "read" &&
    installationTokenScope.selectedRepositoryOnly === true &&
    checkout.repositoryId === identity.repositoryId &&
    checkout.repositoryFullName === identity.repositoryFullName &&
    checkout.pullRequestNumber === identity.pullRequestNumber &&
    checkout.baseSha === identity.baseSha &&
    checkout.targetCommitSha === identity.headSha &&
    checkout.directoryScope === "temporary_worker_directory" &&
    checkout.cleanupRequired === true &&
    checkout.returnsCheckoutPath === false &&
    cli.command === "ai-saas-guard" &&
    cli.workingDirectory === "<worker-checkout>" &&
    cli.networkAccess === "disabled" &&
    cli.writeMode === "read_only" &&
    arraysEqual(cli.args, expectedCliArgs) &&
    output.compactJsonOnly === true &&
    output.persistRawSource === false &&
    output.persistRawDiffs === false &&
    output.persistSecrets === false &&
    output.persistCustomerPayloads === false
  );
}

function arraysEqual(left: readonly string[], right: readonly string[]): boolean {
  return left.length === right.length && left.every((value, index) => value === right[index]);
}

function compactFinding(value: unknown): CompactHostedFinding[] {
  if (!isRecord(value)) return [];
  const ruleId = stringValue(value.ruleId);
  const severity = stringValue(value.severity);
  const evidence = Array.isArray(value.evidence) ? value.evidence.find(isRecord) : undefined;
  const file = stringValue(evidence?.file) ?? stringValue(value.file);
  if (!ruleId || !severity || !file) return [];

  const line = integerValue(evidence?.line) ?? integerValue(value.line);
  return [
    {
      ruleId,
      severity,
      file,
      ...(line === undefined ? {} : { line })
    }
  ];
}

function normalizeSummaryCounts(value: unknown): Record<string, number> {
  const record = isRecord(value) ? value : {};
  const summary: Record<string, number> = {
    critical: numberValue(record.critical),
    high: numberValue(record.high),
    medium: numberValue(record.medium),
    low: numberValue(record.low),
    info: numberValue(record.info)
  };
  summary.total = numberValue(
    record.total,
    summary.critical + summary.high + summary.medium + summary.low + summary.info
  );
  return summary;
}

function safeWorkerEnv(
  checkoutDir: string,
  extra: Record<string, string> = {}
): Record<string, string> {
  return {
    PATH: process.env.PATH ?? "/usr/bin:/bin",
    HOME: checkoutDir,
    TMPDIR: checkoutDir,
    CI: "true",
    NO_COLOR: "1",
    ...extra
  };
}

function parseRepositoryFullName(value: string): { owner: string; repo: string } | undefined {
  const match = /^([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+)$/.exec(value);
  if (!match) return undefined;
  return {
    owner: match[1],
    repo: match[2]
  };
}

function normalizeSafeCloneBaseUrl(value: string): string {
  try {
    const url = new URL(value);
    if (
      url.protocol !== "https:" ||
      url.username ||
      url.password ||
      url.search ||
      url.hash ||
      hasNonSlashPath(url.pathname) ||
      isUnsafeHostedHostname(url.hostname)
    ) {
      throw new HostedReadOnlyCheckoutScanError("invalid_clone_base_url");
    }
    return `${url.protocol}//${url.host}`;
  } catch (error) {
    if (error instanceof HostedReadOnlyCheckoutScanError) throw error;
    throw new HostedReadOnlyCheckoutScanError("invalid_clone_base_url");
  }
}

function hasNonSlashPath(pathname: string): boolean {
  for (const character of pathname) {
    if (character !== "/") return true;
  }
  return false;
}

function isUnsafeHostedHostname(hostname: string): boolean {
  const normalized = hostname.toLowerCase().replace(/\.$/, "");
  return (
    normalized === "localhost" ||
    normalized.endsWith(".localhost") ||
    isUnsafeIpv4Hostname(normalized) ||
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe80:")
  );
}

function isUnsafeIpv4Hostname(hostname: string): boolean {
  const parts = hostname.split(".");
  if (parts.length !== 4 || !parts.every((part) => /^\d+$/.test(part))) return false;
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

function clampPositiveInteger(
  value: number | undefined,
  fallback: number,
  maximum: number
): number {
  if (value === undefined || !Number.isFinite(value)) return fallback;
  return Math.min(maximum, Math.max(1, Math.floor(value)));
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function integerValue(value: unknown): number | undefined {
  return typeof value === "number" && Number.isSafeInteger(value) ? value : undefined;
}

function numberValue(value: unknown, fallback = 0): number {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback;
}
