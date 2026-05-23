import type { BaseReport, Finding } from "../types.js";

export function formatTerminalReport(report: BaseReport): string {
  const lines: string[] = [];
  lines.push(`ai-saas-guard ${report.command}`);
  lines.push(`Root: ${report.rootDir}`);
  lines.push(
    `Findings: ${report.summary.total} total | critical ${report.summary.critical} | high ${report.summary.high} | medium ${report.summary.medium} | low ${report.summary.low} | info ${report.summary.info}`
  );

  if (report.findings.length === 0) {
    lines.push("");
    lines.push("No heuristic launch-readiness risks found by this command.");
    return lines.join("\n");
  }

  for (const [index, item] of report.findings.entries()) {
    lines.push("");
    lines.push(`${index + 1}. [${item.severity.toUpperCase()}] ${item.title}`);
    lines.push(`   Rule: ${item.ruleId}`);
    lines.push(`   Why: ${item.why}`);
    lines.push(`   Verify: ${item.suggestedVerification}`);
    lines.push(`   Fix direction: ${item.suggestedFix}`);
    lines.push("   Evidence:");
    for (const evidence of item.evidence.slice(0, 5)) {
      const location = evidence.line ? `${evidence.file}:${evidence.line}` : evidence.file;
      const detail = evidence.snippet ?? evidence.match ?? "";
      lines.push(`   - ${location}${detail ? ` -> ${detail}` : ""}`);
    }
  }

  return lines.join("\n");
}

export function formatFindingSummary(finding: Finding): string {
  const firstEvidence = finding.evidence[0];
  const location = firstEvidence?.line ? `${firstEvidence.file}:${firstEvidence.line}` : firstEvidence?.file;
  return `${finding.severity.toUpperCase()} ${finding.ruleId}${location ? ` ${location}` : ""}`;
}
