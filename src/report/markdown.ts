import type { ActionsReport, BaseReport, Evidence, Finding, McpReport, PrRiskReport, SupabaseReport } from "../types.js";

export function formatMarkdownReport(report: BaseReport): string {
  if (report.command === "pr-risk") return `${formatPrRiskMarkdown(report as PrRiskReport)}\n`;
  return `${formatGenericMarkdown(report)}\n`;
}

function formatPrRiskMarkdown(report: PrRiskReport): string {
  const lines: string[] = [];
  lines.push("## ai-saas-guard PR risk summary");
  lines.push("");
  lines.push(summaryLine(report));

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
