import type { ActionsReport, BaseReport, Evidence, Finding, McpReport, PrRiskReport, ShowcaseReport, SupabaseReport } from "../types.js";
import { launchGateVerdict, manualProofSteps, nextSteps, reviewFirst } from "./launchGate.js";

export function formatMarkdownReport(report: BaseReport): string {
  if (report.command === "demo") return `${formatDemoMarkdown(report as ShowcaseReport)}\n`;
  if (report.command === "pr-risk") return `${formatPrRiskMarkdown(report as PrRiskReport)}\n`;
  return `${formatGenericMarkdown(report)}\n`;
}

function formatDemoMarkdown(report: ShowcaseReport): string {
  const lines: string[] = [];
  lines.push("## ai-saas-guard demo");
  lines.push("");
  lines.push("Synthetic public demo for the local-first launch gate. This is not a pentest, full audit, or certification.");
  lines.push("");
  lines.push(`- Risky demo: ${escapeMarkdownInline(summaryText(report.demos.risky))}`);
  lines.push(`- Safe demo: ${escapeMarkdownInline(summaryText(report.demos.safe))}`);
  lines.push("");
  lines.push("### Review First");
  appendList(lines, reviewFirst(report.demos.risky.findings).map(escapeMarkdownInline));
  lines.push("");
  lines.push("### Manual Proof To Run Next");
  appendList(lines, manualProofSteps(report.demos.risky.findings).map(escapeMarkdownInline));
  lines.push("");
  lines.push("### Next Steps");
  appendList(lines, report.nextSteps.map(escapeMarkdownInline));
  lines.push("");
  lines.push("Run against your app:");
  lines.push("");
  lines.push("```bash");
  lines.push("npx ai-saas-guard@latest scan --root /path/to/your-saas");
  lines.push("```");
  return lines.join("\n");
}

function formatPrRiskMarkdown(report: PrRiskReport): string {
  const lines: string[] = [];
  lines.push("## ai-saas-guard PR risk summary");
  lines.push("");
  lines.push(summaryLine(report));
  lines.push(`**Launch gate:** ${escapeMarkdownInline(launchGateVerdict(report))}`);

  if (report.categories.length > 0) {
    lines.push("");
    lines.push(`**Risk categories:** ${report.categories.map((category) => `\`${category}\``).join(", ")}`);
  }

  lines.push("");
  lines.push("### Review first");
  if (report.topRiskyFiles.length === 0) {
    lines.push("");
    lines.push("No changed trust-boundary files were classified by `pr-risk`.");
  } else {
    lines.push("");
    lines.push("| File | Score | Categories | Diff |");
    lines.push("| --- | ---: | --- | ---: |");
    for (const file of report.topRiskyFiles.slice(0, 10)) {
      lines.push(
        `| \`${escapeMarkdownTableCell(file.path)}\` | ${file.score} | ${file.categories.map((category) => `\`${escapeMarkdownTableCell(category)}\``).join("<br>")} | +${file.added} / -${file.removed} |`
      );
    }
  }

  lines.push("");
  lines.push("### Required verification");
  appendList(lines, report.requiredTests.length > 0 ? report.requiredTests : report.reviewChecklist);

  lines.push("");
  lines.push("### Suggested PR split");
  appendList(lines, report.suggestedSplit.length > 0 ? report.suggestedSplit : ["No split suggestion from the current diff."]);

  lines.push("");
  lines.push("### Findings");
  appendFindings(lines, report.findings);

  return lines.join("\n");
}

function formatGenericMarkdown(report: BaseReport): string {
  const lines: string[] = [];
  lines.push(`## ai-saas-guard ${report.command}`);
  lines.push("");
  lines.push(summaryLine(report));
  lines.push(`**Launch gate:** ${escapeMarkdownInline(launchGateVerdict(report))}`);
  appendLaunchQueue(lines, report.findings);
  lines.push("");
  lines.push("### Findings");
  appendFindings(lines, report.findings);
  appendGenericExtras(lines, report);
  return lines.join("\n");
}

function summaryLine(report: BaseReport): string {
  return `**Findings:** ${report.summary.total} total | critical ${report.summary.critical} | high ${report.summary.high} | medium ${report.summary.medium} | low ${report.summary.low} | info ${report.summary.info}`;
}

function appendList(lines: string[], items: string[]): void {
  for (const item of items) {
    lines.push(`- ${item}`);
  }
}

function appendLaunchQueue(lines: string[], findings: Finding[]): void {
  if (findings.length === 0) return;

  lines.push("");
  lines.push("### Review First");
  appendList(lines, reviewFirst(findings).map(escapeMarkdownInline));
  lines.push("");
  lines.push("### Manual Proof To Run Next");
  appendList(lines, manualProofSteps(findings).map(escapeMarkdownInline));
  lines.push("");
  lines.push("### Next Steps");
  appendList(lines, nextSteps(findings).map(escapeMarkdownInline));
}

function appendFindings(lines: string[], findings: Finding[]): void {
  if (findings.length === 0) {
    lines.push("");
    lines.push("No heuristic launch-readiness risks found by this command.");
    return;
  }

  for (const [index, finding] of findings.entries()) {
    lines.push("");
    lines.push(
      `${index + 1}. **[${finding.severity.toUpperCase()}] ${escapeMarkdownInline(finding.title)}**`
    );
    lines.push(`   - Rule: \`${finding.ruleId}\``);
    lines.push(`   - Evidence: ${formatEvidence(finding.evidence[0])}`);
    lines.push(`   - Why: ${escapeMarkdownInline(finding.why)}`);
    lines.push(`   - Verify: ${escapeMarkdownInline(finding.suggestedVerification)}`);
    lines.push(`   - Fix direction: ${escapeMarkdownInline(finding.suggestedFix)}`);
  }
}

function appendGenericExtras(lines: string[], report: BaseReport): void {
  if (report.command === "check-supabase") {
    const supabase = report as SupabaseReport;
    if (supabase.doctor.sqlCookbook.length === 0) return;
    lines.push("");
    lines.push("### Supabase RLS Doctor");
    appendList(lines, supabase.doctor.twoAccountVerificationSteps);
    lines.push("");
    lines.push("```sql");
    lines.push(...supabase.doctor.sqlCookbook);
    lines.push("```");
  }

  if (report.command === "check-mcp") {
    const mcp = report as McpReport;
    if (!mcp.policyTemplate) return;
    lines.push("");
    lines.push("### MCP Policy Template");
    lines.push("");
    lines.push("```yaml");
    lines.push(...mcp.policyTemplate.localPolicyTemplate);
    lines.push("```");
    lines.push("");
    lines.push(`Receipt fields: ${mcp.policyTemplate.receiptFormat.map((field) => `\`${field}\``).join(", ")}`);
  }

  if (report.command === "check-actions") {
    const actions = report as ActionsReport;
    lines.push("");
    lines.push("### GitHub Actions Hygiene Checklist");
    appendList(lines, actions.hygieneChecklist);
  }
}

function formatEvidence(evidence: Evidence | undefined): string {
  if (!evidence) return "`none`";
  const location = evidence.line ? `${evidence.file}:${evidence.line}` : evidence.file;
  const detail = evidence.snippet ?? evidence.match;
  const safeLocation = escapeMarkdownInline(location).replaceAll("`", "'");
  return detail
    ? `\`${safeLocation}\` - ${escapeMarkdownInline(detail)}`
    : `\`${safeLocation}\``;
}

function escapeMarkdownTableCell(value: string): string {
  return value.replaceAll("|", "\\|").replaceAll("\n", " ");
}

function escapeMarkdownInline(value: string): string {
  return value.replace(/\r?\n/g, " ").replaceAll("|", "\\|").trim();
}

function summaryText(report: BaseReport): string {
  if (report.summary.total === 0) return "0 findings";
  return `${report.summary.total} findings: ${report.summary.critical} critical, ${report.summary.high} high, ${report.summary.medium} medium, ${report.summary.low} low, ${report.summary.info} info`;
}
