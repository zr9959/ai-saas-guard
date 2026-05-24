import type { ActionsReport, BaseReport, Finding, McpReport, SupabaseReport } from "../types.js";
import { launchGateVerdict, manualProofSteps, reviewFirst } from "./launchGate.js";

export function formatTerminalReport(report: BaseReport): string {
  const lines: string[] = [];
  lines.push(`ai-saas-guard ${report.command}`);
  lines.push(`Root: ${report.rootDir}`);
  lines.push(
    `Findings: ${report.summary.total} total | critical ${report.summary.critical} | high ${report.summary.high} | medium ${report.summary.medium} | low ${report.summary.low} | info ${report.summary.info}`
  );
  lines.push(`Launch gate: ${launchGateVerdict(report)}`);

  if (report.findings.length === 0) {
    lines.push("");
    lines.push("No heuristic launch-readiness risks found by this command.");
    appendCommandExtras(lines, report);
    return lines.join("\n");
  }

  lines.push("");
  lines.push("Review first:");
  for (const item of reviewFirst(report.findings)) {
    lines.push(`- ${item}`);
  }

  lines.push("");
  lines.push("Manual proof to run next:");
  for (const step of manualProofSteps(report.findings)) {
    lines.push(`- ${step}`);
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

  appendCommandExtras(lines, report);

  return lines.join("\n");
}

function appendCommandExtras(lines: string[], report: BaseReport): void {
  if (report.command === "check-supabase") {
    const supabase = report as SupabaseReport;
    if (supabase.doctor.sqlCookbook.length > 0) {
      lines.push("");
      lines.push("Supabase RLS doctor:");
      for (const step of supabase.doctor.twoAccountVerificationSteps.slice(0, 5)) {
        lines.push(`- ${step}`);
      }
      lines.push("SQL cookbook:");
      for (const line of supabase.doctor.sqlCookbook.slice(0, 8)) {
        lines.push(`  ${line}`);
      }
    }
  }

  if (report.command === "check-mcp") {
    const mcp = report as McpReport;
    if (mcp.policyTemplate) {
      lines.push("");
      lines.push("MCP policy template:");
      for (const line of mcp.policyTemplate.localPolicyTemplate) {
        lines.push(`  ${line}`);
      }
      lines.push("Receipt fields:");
      lines.push(`  ${mcp.policyTemplate.receiptFormat.join(", ")}`);
    }
  }

  if (report.command === "check-actions") {
    const actions = report as ActionsReport;
    if (actions.hygieneChecklist.length > 0) {
      lines.push("");
      lines.push("GitHub Actions hygiene checklist:");
      for (const item of actions.hygieneChecklist) {
        lines.push(`- ${item}`);
      }
    }
  }
}

export function formatFindingSummary(finding: Finding): string {
  const firstEvidence = finding.evidence[0];
  const location = firstEvidence?.line ? `${firstEvidence.file}:${firstEvidence.line}` : firstEvidence?.file;
  return `${finding.severity.toUpperCase()} ${finding.ruleId}${location ? ` ${location}` : ""}`;
}
