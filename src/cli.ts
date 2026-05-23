#!/usr/bin/env node

import { resolve } from "node:path";
import { checkMcp, checkStripe, checkSupabase, classifyPrRisk, scanRepository } from "./index.js";
import { formatJsonReport } from "./report/json.js";
import { formatSarifReport } from "./report/sarif.js";
import { formatTerminalReport } from "./report/terminal.js";
import type { BaseReport, CommandName, Severity } from "./types.js";

interface ParsedArgs {
  command?: CommandName | "help";
  rootDir: string;
  format: "terminal" | "json" | "sarif";
  base?: string;
  failOn?: Severity | "none";
}

async function main(argv: string[]): Promise<number> {
  const args = parseArgs(argv);
  if (!args.command || args.command === "help") {
    process.stdout.write(helpText());
    return 0;
  }

  let report: BaseReport;
  switch (args.command) {
    case "scan":
      report = await scanRepository({ rootDir: args.rootDir });
      break;
    case "check-supabase":
      report = await checkSupabase({ rootDir: args.rootDir });
      break;
    case "check-stripe":
      report = await checkStripe({ rootDir: args.rootDir });
      break;
    case "check-mcp":
      report = await checkMcp({ rootDir: args.rootDir });
      break;
    case "pr-risk":
      report = await classifyPrRisk({ rootDir: args.rootDir, base: args.base });
      break;
    default:
      process.stderr.write(`Unknown command: ${String(args.command)}\n\n${helpText()}`);
      return 2;
  }

  process.stdout.write(formatReport(report, args.format));

  if (shouldFail(report, args.failOn)) {
    process.stderr.write(`Failing because findings met --fail-on ${args.failOn}\n`);
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

    if (arg === "--format") {
      const value = argv[index + 1];
      if (value !== "terminal" && value !== "json" && value !== "sarif") {
        throw new Error("--format requires terminal, json, or sarif");
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

    if (arg === "--base") {
      const value = argv[index + 1];
      if (!value) throw new Error("--base requires a branch or ref");
      result.base = value;
      index += 1;
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
  ai-saas-guard scan [--root <repo>] [--json|--sarif] [--fail-on <severity>]
  ai-saas-guard check-supabase [--root <repo>] [--json|--sarif] [--fail-on <severity>]
  ai-saas-guard check-stripe [--root <repo>] [--json|--sarif] [--fail-on <severity>]
  ai-saas-guard check-mcp [--root <repo>] [--json|--sarif] [--fail-on <severity>]
  ai-saas-guard pr-risk [--root <repo>] [--base <branch>] [--json|--sarif] [--fail-on <severity>]

Defaults:
  - read-only
  - no network calls
  - no account or login required
  - terminal output by default, JSON with --json
  - SARIF output for GitHub code scanning with --sarif
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
