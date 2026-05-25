import type { BaseReport, ShowcaseReport } from "../types.js";
import { launchGateVerdict, manualProofSteps, nextSteps, reviewFirst } from "./launchGate.js";

export function formatSummaryReport(report: BaseReport): string {
  if (report.command === "demo") return formatShowcaseSummary(report as ShowcaseReport);

  const lines: string[] = [];
  lines.push(`ai-saas-guard ${report.command} summary`);
  lines.push(`Root: ${report.rootDir}`);
  lines.push(`Findings: ${summaryText(report)}`);
  lines.push(`Launch gate: ${launchGateVerdict(report)}`);

  if (report.findings.length === 0) {
    lines.push("");
    lines.push("No heuristic launch-readiness risks found by this command.");
    lines.push("");
    lines.push("Next steps:");
    appendList(lines, nextSteps(report.findings));
    lines.push("");
    lines.push("Full report:");
    lines.push("  Rerun without --summary, or use --json, --sarif, or --markdown where supported.");
    return lines.join("\n");
  }

  lines.push("");
  lines.push("Top risks:");
  appendList(lines, reviewFirst(report.findings, 3));
  lines.push("");
  lines.push("Manual proof to run next:");
  appendList(lines, manualProofSteps(report.findings, 3));
  lines.push("");
  lines.push("Next steps:");
  appendList(lines, nextSteps(report.findings));
  lines.push("");
  lines.push("Full report:");
  lines.push("  Rerun without --summary, or use --json, --sarif, or --markdown where supported.");
  return lines.join("\n");
}

function formatShowcaseSummary(report: ShowcaseReport): string {
  const lines: string[] = [];
  lines.push("ai-saas-guard demo summary");
  lines.push("AI-built SaaS can look ready while launch risks stay hidden.");
  lines.push("This is not a pentest, full audit, or certification.");
  lines.push("");
  lines.push(`Risky demo: ${summaryText(report.demos.risky)}`);
  lines.push(`Safe demo: ${summaryText(report.demos.safe)}`);
  lines.push(`Launch gate: ${launchGateVerdict(report.demos.risky)}`);
  lines.push("");
  lines.push("What this proves:");
  lines.push("- The same SaaS surfaces can look finished while auth, billing, data, deploy, and CI risks still need review.");
  lines.push("- The safe demo keeps the same SaaS surfaces but removes the intentional launch-risk patterns.");
  lines.push("");
  lines.push("Top risks:");
  appendList(lines, reviewFirst(report.demos.risky.findings, 3));
  lines.push("");
  lines.push("Manual proof to run next:");
  appendList(lines, manualProofSteps(report.demos.risky.findings, 3));
  lines.push("");
  lines.push("Next steps:");
  appendList(lines, report.nextSteps);
  lines.push("");
  lines.push("Full report:");
  lines.push("  Rerun `ai-saas-guard demo` without --summary or use --json/--markdown.");
  return lines.join("\n");
}

function appendList(lines: string[], items: string[]): void {
  for (const item of items) {
    lines.push(`- ${item}`);
  }
}

function summaryText(report: BaseReport): string {
  if (report.summary.total === 0) return "0 findings";
  return `${report.summary.total} findings: ${report.summary.critical} critical, ${report.summary.high} high, ${report.summary.medium} medium, ${report.summary.low} low, ${report.summary.info} info`;
}
