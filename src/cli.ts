#!/usr/bin/env node

import { resolve } from "node:path";
import { applyGuardConfig, loadGuardConfig } from "./config.js";
import { checkActions, checkMcp, checkStripe, checkSupabase, classifyPrRisk, runShowcase, scanRepository } from "./index.js";
import { formatJsonReport } from "./report/json.js";
import { formatMarkdownReport } from "./report/markdown.js";
import { formatSarifReport } from "./report/sarif.js";
import { formatSummaryReport } from "./report/summary.js";
import { formatTerminalReport } from "./report/terminal.js";
import type { BaseReport, CommandName, Severity } from "./types.js";

interface ParsedArgs {
  command?: CommandName | "help";
  rootDir: string;
  format: "terminal" | "json" | "sarif" | "markdown" | "summary";
  base?: string;
  failOn?: Severity | "none";
  configPath?: string;
  doctor?: boolean;
  policyTemplate?: boolean;
}

async function main(argv: string[]): Promise<number> {
  const args = parseArgs(argv);
  if (!args.command || args.command === "help") {
    process.stdout.write(helpText());
    return 0;
  }

  if (args.command === "demo") {
    const report = await runShowcase();
    process.stdout.write(formatReport(report, args.format));
    return 0;
  }

  const config = await loadGuardConfig(args.rootDir, args.configPath);
  let report: BaseReport;
  switch (args.command) {
    case "scan":
      report = await scanRepository({ rootDir: args.rootDir });
      break;
    case "check-supabase":
      report = await checkSupabase({ rootDir: args.rootDir, doctor: args.doctor });
      break;
    case "check-stripe":
      report = await checkStripe({ rootDir: args.rootDir });
      break;
    case "check-mcp":
      report = await checkMcp({ rootDir: args.rootDir, policyTemplate: args.policyTemplate });
      break;
    case "check-actions":
      report = await checkActions({ rootDir: args.rootDir });
      break;
    case "pr-risk":
      report = await classifyPrRisk({ rootDir: args.rootDir, base: args.base });
      break;
    default:
      process.stderr.write(`Unknown command: ${String(args.command)}\n\n${helpText()}`);
      return 2;
  }

  report = applyGuardConfig(report, config);
  process.stdout.write(formatReport(report, args.format));

  const failOn = args.failOn ?? config.failOn;
  if (shouldFail(report, failOn)) {
    process.stderr.write(`Failing because findings met --fail-on ${failOn}\n`);
    return 1;
  }

  return 0;
}

function parseArgs(argv: string[]): ParsedArgs {
  const result: ParsedArgs = {
    rootDir: process.cwd(),
    format: "terminal"
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (index === 0 && !arg.startsWith("-")) {
      result.command = arg as ParsedArgs["command"];
      continue;
    }

    if (arg === "--json") {
      result.format = "json";
      continue;
    }

    if (arg === "--sarif") {
      result.format = "sarif";
      continue;
    }

    if (arg === "--markdown") {
      result.format = "markdown";
      continue;
    }

    if (arg === "--summary") {
      result.format = "summary";
      continue;
    }

    if (arg === "--format") {
      const value = argv[index + 1];
      if (value !== "terminal" && value !== "json" && value !== "sarif" && value !== "markdown" && value !== "summary") {
        throw new Error("--format requires terminal, json, sarif, markdown, or summary");
      }
      result.format = value;
      index += 1;
      continue;
    }

    if (arg === "--root" || arg === "--path") {
      const value = argv[index + 1];
      if (!value) throw new Error(`${arg} requires a path`);
      result.rootDir = resolve(value);
      index += 1;
      continue;
    }

    if (arg === "--fail-on") {
      const value = argv[index + 1];
      if (!isFailOnValue(value)) throw new Error("--fail-on requires critical, high, medium, low, info, or none");
      result.failOn = value;
      index += 1;
      continue;
    }

    if (arg === "--config") {
      const value = argv[index + 1];
      if (!value) throw new Error("--config requires a path");
      result.configPath = resolve(value);
      index += 1;
      continue;
    }

    if (arg === "--base") {
      const value = argv[index + 1];
      if (!value) throw new Error("--base requires a branch or ref");
      result.base = value;
      index += 1;
      continue;
    }

    if (arg === "--doctor") {
      result.doctor = true;
      continue;
    }

    if (arg === "--policy-template") {
      result.policyTemplate = true;
      continue;
    }

    if (arg === "-h" || arg === "--help") {
      result.command = "help";
      continue;
    }

    if (!result.command) {
      result.command = arg as ParsedArgs["command"];
      continue;
    }

    throw new Error(`Unknown argument: ${arg}`);
  }

  result.rootDir = resolve(result.rootDir);
  return result;
}

function formatReport(report: BaseReport, format: ParsedArgs["format"]): string {
  if (format === "json") return formatJsonReport(report);
  if (format === "sarif") return formatSarifReport(report);
  if (format === "markdown") return formatMarkdownReport(report);
  if (format === "summary") return `${formatSummaryReport(report)}\n`;
  return `${formatTerminalReport(report)}\n`;
}

function shouldFail(report: BaseReport, failOn: ParsedArgs["failOn"]): boolean {
  if (!failOn || failOn === "none") return false;
  const threshold = severityRank(failOn);
  return report.findings.some((finding) => severityRank(finding.severity) <= threshold);
}

function severityRank(severity: Severity): number {
  return {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
    info: 4
  }[severity];
}

function isFailOnValue(value: string | undefined): value is Severity | "none" {
  return value === "critical" || value === "high" || value === "medium" || value === "low" || value === "info" || value === "none";
}

function helpText(): string {
  return `ai-saas-guard

Repo-local launch-readiness scanner for AI-built SaaS apps.

Usage:
  ai-saas-guard scan [--root <repo>] [--config <file>] [--json|--sarif|--summary] [--fail-on <severity>]
  ai-saas-guard demo [--json|--markdown|--summary]
  ai-saas-guard check-supabase [--root <repo>] [--config <file>] [--doctor] [--json|--sarif|--summary] [--fail-on <severity>]
  ai-saas-guard check-stripe [--root <repo>] [--config <file>] [--json|--sarif|--summary] [--fail-on <severity>]
  ai-saas-guard check-mcp [--root <repo>] [--config <file>] [--policy-template] [--json|--sarif|--summary] [--fail-on <severity>]
  ai-saas-guard check-actions [--root <repo>] [--config <file>] [--json|--sarif|--summary] [--fail-on <severity>]
  ai-saas-guard pr-risk [--root <repo>] [--config <file>] [--base <branch>] [--json|--sarif|--markdown|--summary] [--fail-on <severity>]

Defaults:
  - read-only
  - no network calls
  - no account or login required
  - demo uses packaged public fixtures and ignores project config/fail thresholds
  - terminal output by default, JSON with --json
  - SARIF output for GitHub code scanning with --sarif
  - PR-focused markdown summary with --markdown
  - first-run launch summary with --summary
  - project config auto-loaded from .ai-saas-guard.json when present
`;
}

main(process.argv.slice(2)).then(
  (code) => {
    process.exitCode = code;
  },
  (error: unknown) => {
    process.stderr.write(`${error instanceof Error ? error.message : String(error)}\n`);
    process.exitCode = 1;
  }
);
