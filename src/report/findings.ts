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
    const ruleDelta = compareText(a.ruleId, b.ruleId);
    if (ruleDelta !== 0) return ruleDelta;
    const fileDelta = compareText(a.evidence[0]?.file ?? "", b.evidence[0]?.file ?? "");
    if (fileDelta !== 0) return fileDelta;
    const lineDelta = (a.evidence[0]?.line ?? 0) - (b.evidence[0]?.line ?? 0);
    if (lineDelta !== 0) return lineDelta;
    const columnDelta = (a.evidence[0]?.column ?? 0) - (b.evidence[0]?.column ?? 0);
    if (columnDelta !== 0) return columnDelta;
    return compareText(a.title, b.title);
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

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}
