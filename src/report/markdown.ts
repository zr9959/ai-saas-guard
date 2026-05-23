import type { BaseReport, Evidence, Finding, PrRiskReport } from "../types.js";

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
    lines.push(`${index + 1}. **[${finding.severity.toUpperCase()}] ${finding.title}**`);
    lines.push(`   - Rule: \`${finding.ruleId}\``);
    lines.push(`   - Evidence: ${formatEvidence(finding.evidence[0])}`);
    lines.push(`   - Why: ${finding.why}`);
    lines.push(`   - Verify: ${finding.suggestedVerification}`);
    lines.push(`   - Fix direction: ${finding.suggestedFix}`);
  }
}

function formatEvidence(evidence: Evidence | undefined): string {
  if (!evidence) return "`none`";
  const location = evidence.line ? `${evidence.file}:${evidence.line}` : evidence.file;
  const detail = evidence.snippet ?? evidence.match;
  return detail ? `\`${location}\` - ${detail}` : `\`${location}\``;
}

function escapeMarkdownTableCell(value: string): string {
  return value.replaceAll("|", "\\|").replaceAll("\n", " ");
}
