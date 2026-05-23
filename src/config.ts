import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { summarizeFindings, sortFindings } from "./report/findings.js";
import { getRuleMetadata } from "./rules/catalog.js";
import type { BaseReport, Severity } from "./types.js";

export const defaultConfigFileName = ".ai-saas-guard.json";

export type RuleConfigValue = "off" | Severity;

export interface GuardConfig {
  sourcePath?: string;
  failOn?: Severity | "none";
  rules: Record<string, RuleConfigValue>;
}

export async function loadGuardConfig(rootDir: string, explicitPath?: string): Promise<GuardConfig> {
  const sourcePath = explicitPath ? resolve(explicitPath) : resolve(rootDir, defaultConfigFileName);
  let content: string;

  try {
    content = await readFile(sourcePath, "utf8");
  } catch (error) {
    if (!explicitPath && isNotFoundError(error)) return { rules: {} };
    throw new Error(`Could not read config file ${sourcePath}: ${errorMessage(error)}`);
  }

  return parseGuardConfig(content, sourcePath);
}

export function applyGuardConfig<T extends BaseReport>(report: T, config: GuardConfig): T {
  const configuredRuleIds = Object.keys(config.rules);
  if (configuredRuleIds.length === 0) return report;

  const findings = sortFindings(
    report.findings.flatMap((finding) => {
      const ruleConfig = config.rules[finding.ruleId];
      if (!ruleConfig) return [finding];
      if (ruleConfig === "off") return [];
      return [{ ...finding, severity: ruleConfig }];
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

  return {
    sourcePath,
    failOn,
    rules
  };
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
