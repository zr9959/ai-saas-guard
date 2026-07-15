import type { ActionsReport, BaseReport, Evidence, Finding, McpReport, PrRiskReport, ShowcaseReport, SupabaseReport } from "../types.js";
import {
  launchDecisionQuestions,
  launchGateVerdict,
  manualProofSteps,
  nextSteps,
  prReviewerChecklist,
  rankingExplanation,
  reviewFirst,
  trustStatement
} from "./launchGate.js";
import { escapeMarkdownInline, formatScanCoverage, formatSummaryCounts, hasIncompleteScanCoverage, markdownCode } from "./presentation.js";

export function formatMarkdownReport(report: BaseReport): string {
  if (report.command === "demo") return `${formatDemoMarkdown(report as ShowcaseReport)}\n`;
  if (report.command === "pr-risk") return `${formatPrRiskMarkdown(report as PrRiskReport)}\n`;
  return `${formatGenericMarkdown(report)}\n`;
}

function formatDemoMarkdown(report: ShowcaseReport): string {
  const lines: string[] = [];
  lines.push("## ai-saas-guard - Demo");
  lines.push("");
  lines.push("AI-built SaaS can look ready while launch risks stay hidden.");
  lines.push("");
  lines.push("> This is a deterministic launch-risk review queue, not a pentest, full audit, or certification.");
  lines.push("");
  lines.push("### Result");
  appendList(lines, [
    `**Risky demo:** ${escapeMarkdownInline(formatSummaryCounts(report.demos.risky.summary))}`,
    `**Safe demo:** ${escapeMarkdownInline(formatSummaryCounts(report.demos.safe.summary))}`
  ]);
  lines.push("");
  lines.push("### What This Proves");
  appendEscapedList(lines, [
    "The same SaaS surfaces can look finished while auth, billing, data, deploy, and CI risks still need review.",
    "The safe demo keeps the same SaaS surfaces but removes the intentional launch-risk patterns."
  ]);
  lines.push("");
  lines.push("### Review First");
  appendEscapedList(lines, reviewFirst(report.demos.risky.findings));
  lines.push("");
  lines.push("### Manual Proof");
  appendEscapedList(lines, manualProofSteps(report.demos.risky.findings));
  lines.push("");
  lines.push("### Next Steps");
  appendEscapedList(lines, report.nextSteps);
  lines.push("");
  lines.push("Run against your app:");
  lines.push("");
  appendIndentedCode(lines, ["npx ai-saas-guard@latest scan --root /path/to/your-saas"]);
  return lines.join("\n");
}

function formatPrRiskMarkdown(report: PrRiskReport): string {
  const lines: string[] = [];
  lines.push("## ai-saas-guard - PR Risk Review");
  lines.push("");
  lines.push(`**Launch gate:** ${escapeMarkdownInline(launchGateVerdict(report))}`);
  lines.push("");
  lines.push(`**Findings:** ${escapeMarkdownInline(formatSummaryCounts(report.summary))}`);

  if (report.categories.length > 0) {
    lines.push("");
    lines.push(`**Risk categories:** ${report.categories.map(markdownCode).join(", ")}`);
  }

  lines.push("");
  lines.push("### Review First");
  appendRiskyFiles(lines, report);

  lines.push("");
  lines.push("### Manual Proof");
  appendEscapedList(lines, report.requiredTests.length > 0 ? report.requiredTests : report.reviewChecklist);

  lines.push("");
  lines.push("### Findings");
  appendFindings(lines, report.findings);

  lines.push("");
  lines.push("### Launch Decision Queue");
  appendEscapedList(lines, launchDecisionQuestions(report.findings));

  lines.push("");
  lines.push("### Reviewer Checklist");
  appendEscapedList(lines, prReviewerChecklist());

  lines.push("");
  lines.push("### Why This Review Order");
  appendEscapedList(lines, [
    "Trust-boundary files come before cosmetic files because auth, billing, tenant data, RLS, webhook, and silent-success changes can affect real users first.",
    ...rankingExplanation(report.findings)
  ]);

  lines.push("");
  lines.push("### Suggested PR Split");
  appendEscapedList(lines, report.suggestedSplit.length > 0 ? report.suggestedSplit : ["No split suggestion from the current diff."]);

  appendTrustStatement(lines);
  return lines.join("\n");
}

function formatGenericMarkdown(report: BaseReport): string {
  const lines: string[] = [];
  lines.push(`## ai-saas-guard - ${escapeMarkdownInline(report.command)}`);
  lines.push("");
  lines.push(`**Launch gate:** ${escapeMarkdownInline(launchGateVerdict(report))}`);
  lines.push("");
  lines.push(`**Findings:** ${escapeMarkdownInline(formatSummaryCounts(report.summary))}`);
  const scanCoverage = formatScanCoverage(report);
  if (scanCoverage) {
    lines.push("");
    lines.push(`**Coverage:** ${escapeMarkdownInline(scanCoverage)}`);
  }

  if (report.findings.length === 0) {
    lines.push("");
    lines.push("### Result");
    lines.push("");
    lines.push(
      hasIncompleteScanCoverage(report)
        ? "No findings were produced, but scan coverage was incomplete. Resolve unreadable or skipped inputs and rerun before using this result."
        : "No heuristic launch-readiness risks found by this command. This remains a heuristic result, not a certification."
    );
  } else {
    lines.push("");
    lines.push("### Review First");
    appendEscapedList(lines, reviewFirst(report.findings));
    lines.push("");
    lines.push("### Manual Proof");
    appendEscapedList(lines, manualProofSteps(report.findings));
  }

  lines.push("");
  lines.push("### Findings");
  appendFindings(lines, report.findings);

  lines.push("");
  lines.push("### Next Steps");
  appendEscapedList(lines, nextSteps(report.findings));

  lines.push("");
  lines.push("### Launch Decision Queue");
  appendEscapedList(lines, launchDecisionQuestions(report.findings));

  lines.push("");
  lines.push("### Why This Is Ranked First");
  appendEscapedList(lines, rankingExplanation(report.findings));

  appendTrustStatement(lines);
  appendGenericExtras(lines, report);
  return lines.join("\n");
}

function appendRiskyFiles(lines: string[], report: PrRiskReport): void {
  if (report.topRiskyFiles.length === 0) {
    lines.push("");
    lines.push("No changed trust-boundary files were classified by `pr-risk`.");
    return;
  }

  for (const [index, file] of report.topRiskyFiles.slice(0, 10).entries()) {
    lines.push("");
    lines.push(`${index + 1}. **${markdownCode(file.path)}**`);
    lines.push(`   - Score: ${file.score}`);
    lines.push(`   - Categories: ${file.categories.map(markdownCode).join(", ")}`);
    lines.push(`   - Diff: +${file.added} / -${file.removed}`);
  }
}

function appendList(lines: string[], items: string[]): void {
  for (const item of items) lines.push(`- ${item}`);
}

function appendEscapedList(lines: string[], items: string[]): void {
  appendList(lines, items.map(escapeMarkdownInline));
}

function appendFindings(lines: string[], findings: Finding[]): void {
  if (findings.length === 0) {
    lines.push("");
    lines.push("No findings in this report.");
    return;
  }

  for (const [index, finding] of findings.entries()) {
    lines.push("");
    lines.push(`#### ${index + 1}. ${finding.severity.toUpperCase()} - ${escapeMarkdownInline(finding.title)}`);
    lines.push("");
    lines.push(`- **Rule:** ${markdownCode(finding.ruleId)}`);
    for (const [evidenceIndex, evidence] of finding.evidence.slice(0, 3).entries()) {
      lines.push(`- **Evidence ${evidenceIndex + 1}:** ${formatEvidence(evidence)}`);
    }
    if (finding.evidence.length > 3) {
      lines.push(`- **More evidence:** ${finding.evidence.length - 3} additional item(s) are available in JSON or SARIF output.`);
    }
    lines.push(`- **Why:** ${escapeMarkdownInline(finding.why)}`);
    lines.push(`- **Verify:** ${escapeMarkdownInline(finding.suggestedVerification)}`);
    lines.push(`- **Fix direction:** ${escapeMarkdownInline(finding.suggestedFix)}`);
  }
}

function appendTrustStatement(lines: string[]): void {
  lines.push("");
  lines.push("### Trust Statement");
  appendEscapedList(lines, trustStatement());
}

function appendGenericExtras(lines: string[], report: BaseReport): void {
  if (report.command === "check-supabase") {
    const supabase = report as SupabaseReport;
    if (supabase.doctor.sqlCookbook.length > 0) {
      lines.push("");
      lines.push("### Supabase RLS Doctor");
      appendEscapedList(lines, supabase.doctor.twoAccountVerificationSteps);
      lines.push("");
      appendIndentedCode(lines, supabase.doctor.sqlCookbook);
    }
  }

  if (report.command === "check-mcp") {
    const mcp = report as McpReport;
    if (mcp.policyTemplate) {
      lines.push("");
      lines.push("### MCP Policy Template");
      lines.push("");
      appendIndentedCode(lines, mcp.policyTemplate.localPolicyTemplate);
      lines.push("");
      lines.push(`Receipt fields: ${mcp.policyTemplate.receiptFormat.map(markdownCode).join(", ")}`);
    }
  }

  if (report.command === "check-actions") {
    const actions = report as ActionsReport;
    lines.push("");
    lines.push("### GitHub Actions Hygiene Checklist");
    appendEscapedList(lines, actions.hygieneChecklist);
  }
}

function appendIndentedCode(lines: string[], values: string[]): void {
  for (const value of values) {
    const normalized = value.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/g, "");
    for (const line of normalized.split(/\r\n?|\n/)) lines.push(`    ${line}`);
  }
}

function formatEvidence(evidence: Evidence): string {
  const location = `${evidence.file}${evidence.line === undefined ? "" : `:${evidence.line}`}${evidence.column === undefined ? "" : `:${evidence.column}`}`;
  const detail = evidence.snippet ?? evidence.match;
  return detail
    ? `${markdownCode(location)} - ${escapeMarkdownInline(detail)}`
    : markdownCode(location);
}
