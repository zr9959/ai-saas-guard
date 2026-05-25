import type { ActionsReport, BaseReport, Finding, McpReport, ShowcaseReport, SupabaseReport } from "../types.js";
import { launchGateVerdict, manualProofSteps, nextSteps, reviewFirst } from "./launchGate.js";

export function formatTerminalReport(report: BaseReport): string {
  if (report.command === "demo") return formatDemoTerminalReport(report as ShowcaseReport);

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

  lines.push("");
  lines.push("Next steps:");
  for (const step of nextSteps(report.findings)) {
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

function formatDemoTerminalReport(report: ShowcaseReport): string {
  const lines: string[] = [];
  lines.push("ai-saas-guard demo");
  lines.push("AI-built SaaS can look ready while launch risks stay hidden.");
  lines.push("This is not a pentest, full audit, or certification.");
  lines.push("");
  lines.push(`Risky demo: ${summaryText(report.demos.risky)}`);
  lines.push(`Safe demo: ${summaryText(report.demos.safe)}`);
  lines.push("");
  lines.push("What this proves:");
  lines.push("- The same SaaS surfaces can look finished while auth, billing, data, deploy, and CI risks still need review.");
  lines.push("- The safe demo keeps the same SaaS surfaces but removes the intentional launch-risk patterns.");
  lines.push("");
  lines.push("Review first:");
  for (const item of reviewFirst(report.demos.risky.findings)) {
    lines.push(`- ${item}`);
  }
  lines.push("");
  lines.push("Manual proof to run next:");
  for (const step of manualProofSteps(report.demos.risky.findings)) {
    lines.push(`- ${step}`);
  }
  lines.push("");
  lines.push("Next steps:");
  for (const step of report.nextSteps) {
    lines.push(`- ${step}`);
  }
  lines.push("");
  lines.push("Run against your app:");
  lines.push("  npx ai-saas-guard@latest scan --root /path/to/your-saas");
  lines.push("");
  lines.push("Read more: https://github.com/zr9959/ai-saas-guard/blob/main/docs/demo-quickstart.md");
  return lines.join("\n");
}

function summaryText(report: BaseReport): string {
  if (report.summary.total === 0) return "0 findings";
  return `${report.summary.total} findings: ${report.summary.critical} critical, ${report.summary.high} high, ${report.summary.medium} medium, ${report.summary.low} low, ${report.summary.info} info`;
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
