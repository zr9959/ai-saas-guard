import type { BaseReport, CommandName, Finding, Severity, Summary } from "../types.js";

const severities: Severity[] = ["critical", "high", "medium", "low", "info"];

export function summarizeFindings(findings: Finding[]): Summary {
  const summary: Summary = {
    critical: 0,
    high: 0,
    medium: 0,
    low: 0,
    info: 0,
    total: findings.length
  };

  for (const finding of findings) {
    summary[finding.severity] += 1;
  }

  return summary;
}

export function createReport<T extends BaseReport>(
  command: CommandName,
  rootDir: string,
  findings: Finding[],
  extra: Omit<T, keyof BaseReport | "command">
): T {
  return {
    command,
    rootDir,
    generatedAt: new Date().toISOString(),
    findings: sortFindings(findings),
    summary: summarizeFindings(findings),
    ...extra
  } as T;
}

export function sortFindings(findings: Finding[]): Finding[] {
  return [...findings].sort((a, b) => {
    const severityDelta = severities.indexOf(a.severity) - severities.indexOf(b.severity);
    if (severityDelta !== 0) return severityDelta;
    return a.ruleId.localeCompare(b.ruleId);
  });
}

export function finding(input: Finding): Finding {
  return input;
}

export function uniqueFindings(findings: Finding[]): Finding[] {
  const seen = new Set<string>();
  const result: Finding[] = [];

  for (const item of findings) {
    const firstEvidence = item.evidence[0];
    const key = `${item.ruleId}:${firstEvidence?.file ?? ""}:${firstEvidence?.line ?? ""}:${item.title}`;
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }

  return result;
}
