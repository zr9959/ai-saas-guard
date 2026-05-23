import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { summarizeFindings, sortFindings } from "./report/findings.js";
import { getRuleMetadata } from "./rules/catalog.js";
import type { BaseReport, Severity } from "./types.js";

export const defaultConfigFileName = ".ai-saas-guard.json";

export type RuleConfigValue = "off" | Severity;

export interface FindingSuppression {
  ruleId: string;
  paths: string[];
  reason?: string;
}

export interface GuardConfig {
  sourcePath?: string;
  failOn?: Severity | "none";
  rules: Record<string, RuleConfigValue>;
  suppressions?: FindingSuppression[];
}

export async function loadGuardConfig(rootDir: string, explicitPath?: string): Promise<GuardConfig> {
  const sourcePath = explicitPath ? resolve(explicitPath) : resolve(rootDir, defaultConfigFileName);
  let content: string;

  try {
    content = await readFile(sourcePath, "utf8");
  } catch (error) {
    if (!explicitPath && isNotFoundError(error)) return { rules: {}, suppressions: [] };
    throw new Error(`Could not read config file ${sourcePath}: ${errorMessage(error)}`);
  }

  return parseGuardConfig(content, sourcePath);
}

export function applyGuardConfig<T extends BaseReport>(report: T, config: GuardConfig): T {
  const configuredRuleIds = Object.keys(config.rules);
  const suppressions = config.suppressions ?? [];
  if (configuredRuleIds.length === 0 && suppressions.length === 0) return report;

  const findings = sortFindings(
    report.findings.flatMap((finding) => {
      const ruleConfig = config.rules[finding.ruleId];
      if (ruleConfig === "off") return [];
      const configuredFinding = ruleConfig ? { ...finding, severity: ruleConfig } : finding;
      return isSuppressed(configuredFinding, suppressions) ? [] : [configuredFinding];
    })
  );

  return {
    ...report,
    findings,
    summary: summarizeFindings(findings)
  };
}

function parseGuardConfig(content: string, sourcePath: string): GuardConfig {
  let parsed: unknown;
  try {
    parsed = JSON.parse(content);
  } catch (error) {
    throw new Error(`Invalid JSON in config file ${sourcePath}: ${errorMessage(error)}`);
  }

  if (!isPlainObject(parsed)) {
    throw new Error(`Invalid config file ${sourcePath}: expected a JSON object`);
  }

  const failOn = parsed.failOn;
  if (failOn !== undefined && !isFailOnValue(failOn)) {
    throw new Error("Invalid config failOn: expected critical, high, medium, low, info, or none");
  }

  const rawRules = parsed.rules ?? {};
  if (!isPlainObject(rawRules)) {
    throw new Error("Invalid config rules: expected an object keyed by rule ID");
  }

  const rules: Record<string, RuleConfigValue> = {};
  for (const [ruleId, value] of Object.entries(rawRules)) {
    if (!getRuleMetadata(ruleId)) {
      throw new Error(`Unknown rule ID in config: ${ruleId}`);
    }

    if (!isRuleConfigValue(value)) {
      throw new Error(
        `Invalid config for rule ${ruleId}: expected off, critical, high, medium, low, or info`
      );
    }

    rules[ruleId] = value;
  }

  const rawSuppressions = parsed.suppressions ?? [];
  if (!Array.isArray(rawSuppressions)) {
    throw new Error("Invalid config suppressions: expected an array");
  }

  const suppressions = rawSuppressions.map((value, index) => parseSuppression(value, index));

  return {
    sourcePath,
    failOn,
    rules,
    suppressions
  };
}

function parseSuppression(value: unknown, index: number): FindingSuppression {
  if (!isPlainObject(value)) {
    throw new Error(`Invalid config suppressions[${index}]: expected an object`);
  }

  const ruleId = value.ruleId;
  if (typeof ruleId !== "string" || ruleId.length === 0) {
    throw new Error(`Invalid config suppressions[${index}].ruleId: expected a rule ID`);
  }

  if (!getRuleMetadata(ruleId)) {
    throw new Error(`Unknown rule ID in suppression: ${ruleId}`);
  }

  const paths = value.paths;
  if (!Array.isArray(paths) || paths.length === 0 || !paths.every((path) => typeof path === "string" && path.length > 0)) {
    throw new Error(`Invalid config suppressions[${index}].paths: expected a non-empty array of path globs`);
  }

  const reason = value.reason;
  if (reason !== undefined && typeof reason !== "string") {
    throw new Error(`Invalid config suppressions[${index}].reason: expected a string`);
  }

  return {
    ruleId,
    paths,
    reason
  };
}

function isSuppressed(finding: BaseReport["findings"][number], suppressions: FindingSuppression[]): boolean {
  return suppressions.some(
    (suppression) =>
      suppression.ruleId === finding.ruleId &&
      finding.evidence.some((evidence) => suppression.paths.some((pattern) => pathMatches(pattern, evidence.file)))
  );
}

function pathMatches(pattern: string, filePath: string): boolean {
  return globToRegExp(normalizeConfigPath(pattern)).test(normalizeConfigPath(filePath));
}

function normalizeConfigPath(path: string): string {
  return path.replace(/\\/g, "/").replace(/^\.\//, "");
}

function globToRegExp(pattern: string): RegExp {
  let expression = "^";

  for (let index = 0; index < pattern.length; index += 1) {
    const char = pattern[index];
    if (char === "*") {
      const next = pattern[index + 1];
      const afterNext = pattern[index + 2];
      if (next === "*" && afterNext === "/") {
        expression += "(?:.*/)?";
        index += 2;
      } else if (next === "*") {
        expression += ".*";
        index += 1;
      } else {
        expression += "[^/]*";
      }
    } else if (char === "?") {
      expression += "[^/]";
    } else {
      expression += escapeRegExp(char);
    }
  }

  return new RegExp(`${expression}$`);
}

function escapeRegExp(value: string): string {
  return value.replace(/[|\\{}()[\]^$+?.]/g, "\\$&");
}

function isRuleConfigValue(value: unknown): value is RuleConfigValue {
  return value === "off" || isSeverity(value);
}

function isFailOnValue(value: unknown): value is Severity | "none" {
  return value === "none" || isSeverity(value);
}

function isSeverity(value: unknown): value is Severity {
  return value === "critical" || value === "high" || value === "medium" || value === "low" || value === "info";
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNotFoundError(error: unknown): boolean {
  return isPlainObject(error) && error.code === "ENOENT";
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
