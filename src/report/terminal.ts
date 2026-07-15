import type { ActionsReport, BaseReport, Finding, McpReport, ShowcaseReport, SupabaseReport } from "../types.js";
import { launchGateVerdict, manualProofSteps, nextSteps, reviewFirst } from "./launchGate.js";
import { formatEvidenceLocation, formatScanCoverage, formatSummaryCounts, hasIncompleteScanCoverage, sanitizeTerminalInline } from "./presentation.js";

export function formatTerminalReport(report: BaseReport): string {
  if (report.command === "demo") return formatDemoTerminalReport(report as ShowcaseReport);

  const lines: string[] = [];
  lines.push(`ai-saas-guard | ${report.command.toUpperCase()}`);
  lines.push("----------------------------------------");
  lines.push(`Target       ${sanitizeTerminalInline(report.rootDir)}`);
  lines.push(`Launch gate  ${launchGateVerdict(report)}`);
  lines.push(`Findings     ${formatSummaryCounts(report.summary)}`);
  const scanCoverage = formatScanCoverage(report);
  if (scanCoverage) lines.push(`Coverage     ${scanCoverage}`);

  if (report.findings.length === 0) {
    appendSection(lines, "RESULT");
    if (hasIncompleteScanCoverage(report)) {
      lines.push("No findings were produced, but scan coverage was incomplete.");
      lines.push("Resolve unreadable or skipped inputs, then rerun before using this result.");
    } else {
      lines.push("No heuristic launch-readiness risks found by this command.");
      lines.push("This is still a heuristic result, not a certification.");
    }
    appendSection(lines, "NEXT STEPS");
    appendNumberedList(lines, nextSteps(report.findings));
    appendCommandExtras(lines, report);
    return lines.join("\n");
  }

  appendSection(lines, "REVIEW FIRST");
  appendNumberedList(lines, reviewFirst(report.findings));

  appendSection(lines, "MANUAL PROOF");
  appendNumberedList(lines, manualProofSteps(report.findings));

  appendSection(lines, "NEXT STEPS");
  appendNumberedList(lines, nextSteps(report.findings));

  appendSection(lines, "FINDINGS");

  for (const [index, item] of report.findings.entries()) {
    if (index > 0) lines.push("");
    lines.push(`[${index + 1}/${report.findings.length}] ${item.severity.toUpperCase()} | ${sanitizeTerminalInline(item.title)}`);
    lines.push(`  Rule      ${sanitizeTerminalInline(item.ruleId)}`);
    const primaryLocation = formatEvidenceLocation(item.evidence[0]);
    if (primaryLocation) lines.push(`  Location  ${sanitizeTerminalInline(primaryLocation)}`);
    lines.push(`  Why       ${sanitizeTerminalInline(item.why)}`);
    lines.push(`  Verify    ${sanitizeTerminalInline(item.suggestedVerification)}`);
    lines.push(`  Fix       ${sanitizeTerminalInline(item.suggestedFix)}`);
    lines.push("  Evidence");
    for (const evidence of item.evidence.slice(0, 5)) {
      const location = formatEvidenceLocation(evidence) ?? "unknown";
      const detail = evidence.snippet ?? evidence.match ?? "";
      const safeLocation = sanitizeTerminalInline(location);
      const safeDetail = sanitizeTerminalInline(detail);
      lines.push(`    - ${safeLocation}${safeDetail ? ` -> ${safeDetail}` : ""}`);
    }
    if (item.evidence.length > 5) lines.push(`    - ${item.evidence.length - 5} more evidence item(s) in JSON/SARIF output`);
  }

  appendCommandExtras(lines, report);

  return lines.join("\n");
}

function formatDemoTerminalReport(report: ShowcaseReport): string {
  const lines: string[] = [];
  lines.push("ai-saas-guard | DEMO");
  lines.push("----------------------------------------");
  lines.push("AI-built SaaS can look ready while launch risks stay hidden.");
  lines.push("This is not a pentest, full audit, or certification.");

  appendSection(lines, "RESULT");
  lines.push(`Risky demo: ${summaryText(report.demos.risky)}`);
  lines.push(`Safe demo: ${summaryText(report.demos.safe)}`);

  appendSection(lines, "WHAT THIS PROVES");
  appendNumberedList(lines, [
    "The same SaaS surfaces can look finished while auth, billing, data, deploy, and CI risks still need review.",
    "The safe demo keeps the same SaaS surfaces but removes the intentional launch-risk patterns."
  ]);

  appendSection(lines, "REVIEW FIRST");
  appendNumberedList(lines, reviewFirst(report.demos.risky.findings));

  appendSection(lines, "MANUAL PROOF");
  appendNumberedList(lines, manualProofSteps(report.demos.risky.findings));

  appendSection(lines, "NEXT STEPS");
  appendNumberedList(lines, report.nextSteps);

  appendSection(lines, "RUN AGAINST YOUR APP");
  lines.push("  npx ai-saas-guard@latest scan --root /path/to/your-saas");
  lines.push("Read more: https://github.com/zr9959/ai-saas-guard/blob/main/docs/demo-quickstart.md");
  return lines.join("\n");
}

function summaryText(report: BaseReport): string {
  return formatSummaryCounts(report.summary);
}

function appendCommandExtras(lines: string[], report: BaseReport): void {
  if (report.command === "check-supabase") {
    const supabase = report as SupabaseReport;
    if (supabase.doctor.sqlCookbook.length > 0) {
      appendSection(lines, "SUPABASE RLS DOCTOR");
      for (const step of supabase.doctor.twoAccountVerificationSteps.slice(0, 5)) {
        lines.push(`- ${sanitizeTerminalInline(step)}`);
      }
      lines.push("SQL cookbook:");
      for (const line of supabase.doctor.sqlCookbook.slice(0, 8)) {
        lines.push(`  ${sanitizeTerminalInline(line)}`);
      }
    }
  }

  if (report.command === "check-mcp") {
    const mcp = report as McpReport;
    if (mcp.policyTemplate) {
      appendSection(lines, "MCP POLICY TEMPLATE");
      for (const line of mcp.policyTemplate.localPolicyTemplate) {
        lines.push(`  ${sanitizeTerminalInline(line)}`);
      }
      lines.push("Receipt fields:");
      lines.push(`  ${sanitizeTerminalInline(mcp.policyTemplate.receiptFormat.join(", "))}`);
    }
  }

  if (report.command === "check-actions") {
    const actions = report as ActionsReport;
    if (actions.hygieneChecklist.length > 0) {
      appendSection(lines, "GITHUB ACTIONS HYGIENE");
      for (const item of actions.hygieneChecklist) {
        lines.push(`- ${sanitizeTerminalInline(item)}`);
      }
    }
  }
}

export function formatFindingSummary(finding: Finding): string {
  const location = formatEvidenceLocation(finding.evidence[0]);
  return sanitizeTerminalInline(`${finding.severity.toUpperCase()} ${finding.ruleId}${location ? ` ${location}` : ""}`);
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
