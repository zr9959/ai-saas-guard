import type { BaseReport, ShowcaseReport } from "../types.js";
import { launchDecisionQuestions, launchGateVerdict, manualProofSteps, nextSteps, reviewFirst } from "./launchGate.js";
import { formatScanCoverage, formatSummaryCounts, hasIncompleteScanCoverage, sanitizeTerminalInline } from "./presentation.js";

export function formatSummaryReport(report: BaseReport): string {
  if (report.command === "demo") return formatShowcaseSummary(report as ShowcaseReport);

  const lines: string[] = [];
  lines.push(`ai-saas-guard | ${report.command.toUpperCase()} SUMMARY`);
  lines.push("----------------------------------------");
  lines.push(`Target       ${sanitizeTerminalInline(report.rootDir)}`);
  lines.push(`Launch gate  ${launchGateVerdict(report)}`);
  lines.push(`Findings     ${formatSummaryCounts(report.summary)}`);
  const scanCoverage = formatScanCoverage(report);
  if (scanCoverage) lines.push(`Coverage     ${scanCoverage}`);
  if (report.findings.length > 0) {
    lines.push(`Decision     ${sanitizeTerminalInline(launchDecisionQuestions(report.findings)[0])}`);
  }

  if (report.findings.length === 0) {
    appendSection(lines, "RESULT");
    if (hasIncompleteScanCoverage(report)) {
      lines.push("No findings were produced, but scan coverage was incomplete.");
      lines.push("Review the coverage line and rerun after unreadable or skipped inputs are resolved.");
    } else {
      lines.push("No heuristic launch-readiness risks found by this command.");
      lines.push("This is still a heuristic result, not a certification.");
    }
    appendSection(lines, "NEXT STEPS");
    appendNumberedList(lines, nextSteps(report.findings));
    appendSection(lines, "FULL REPORT");
    lines.push("  Rerun without --summary, or use --json, --sarif, or --markdown where supported.");
    return lines.join("\n");
  }

  appendSection(lines, "TOP RISKS");
  appendNumberedList(lines, reviewFirst(report.findings, 3));
  appendSection(lines, "MANUAL PROOF");
  appendNumberedList(lines, manualProofSteps(report.findings, 3));
  appendSection(lines, "NEXT STEPS");
  appendNumberedList(lines, nextSteps(report.findings));
  appendSection(lines, "FULL REPORT");
  lines.push("  Rerun without --summary, or use --json, --sarif, or --markdown where supported.");
  return lines.join("\n");
}

function formatShowcaseSummary(report: ShowcaseReport): string {
  const lines: string[] = [];
  lines.push("ai-saas-guard | DEMO SUMMARY");
  lines.push("----------------------------------------");
  lines.push("AI-built SaaS can look ready while launch risks stay hidden.");
  lines.push("This is not a pentest, full audit, or certification.");
  appendSection(lines, "RESULT");
  lines.push(`Risky demo  ${formatSummaryCounts(report.demos.risky.summary)}`);
  lines.push(`Safe demo   ${formatSummaryCounts(report.demos.safe.summary)}`);
  lines.push(`Launch gate ${launchGateVerdict(report.demos.risky)}`);
  appendSection(lines, "WHAT THIS PROVES");
  appendNumberedList(lines, [
    "The same SaaS surfaces can look finished while auth, billing, data, deploy, and CI risks still need review.",
    "The safe demo keeps the same SaaS surfaces but removes the intentional launch-risk patterns."
  ]);
  appendSection(lines, "TOP RISKS");
  appendNumberedList(lines, reviewFirst(report.demos.risky.findings, 3));
  appendSection(lines, "MANUAL PROOF");
  appendNumberedList(lines, manualProofSteps(report.demos.risky.findings, 3));
  appendSection(lines, "NEXT STEPS");
  appendNumberedList(lines, report.nextSteps);
  appendSection(lines, "FULL REPORT");
  lines.push("  Rerun `ai-saas-guard demo` without --summary or use --json/--markdown.");
  return lines.join("\n");
}

function appendSection(lines: string[], title: string): void {
  lines.push("");
  lines.push(title);
}

function appendNumberedList(lines: string[], items: string[]): void {
  for (const [index, item] of items.entries()) {
    lines.push(`${index + 1}. ${sanitizeTerminalInline(item)}`);
  }
}
