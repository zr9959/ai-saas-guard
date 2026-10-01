import type { BaseReport, PrRiskReport } from "../types.js";
import { launchDecisionQuestions, launchGateVerdict, nextSteps, reviewFirst, trustStatement } from "./launchGate.js";
import { escapeMarkdownInline } from "./presentation.js";

/**
 * `--format comment` renders a compact PR-comment-ready markdown body.
 * It is optimized for `pr-risk` (paste into a PR review), but works for
 * any command as a short verdict + review queue.
 */
export function formatCommentReport(report: BaseReport): string {
  if (report.command === "pr-risk") return `${formatPrRiskComment(report as PrRiskReport)}\n`;
  return `${formatGenericComment(report)}\n`;
}

function formatPrRiskComment(report: PrRiskReport): string {
  const lines: string[] = [];
  lines.push("## \u{1F6E1}\uFE0F ai-saas-guard PR risk");
  lines.push("");
  lines.push(`**Verdict:** ${escapeMarkdownInline(launchGateVerdict(report))}`);

  if (report.categories.length > 0) {
    lines.push("");
    lines.push(
      `**This PR touches:** ${report.categories.map((category) => `\`${escapeMarkdownInline(category)}\``).join(", ")}`
    );
  }

  const topFiles = report.topRiskyFiles.slice(0, 3);
  lines.push("");
  lines.push(`### \u{1F440} Review these ${topFiles.length === 1 ? "file" : "files"} first`);
  if (topFiles.length === 0) {
    lines.push("");
    lines.push("No changed trust-boundary files were classified by `pr-risk`.");
  } else {
    lines.push("");
    for (const [index, file] of topFiles.entries()) {
      lines.push(
        `${index + 1}. \`${escapeMarkdownInline(file.path)}\` — ${file.categories.map((category) => `\`${escapeMarkdownInline(category)}\``).join(", ")} (+${file.added}/-${file.removed})`
      );
    }
  }

  const verification = report.requiredTests.length > 0 ? report.requiredTests : report.reviewChecklist;
  if (verification.length > 0) {
    lines.push("");
    lines.push("### \u2705 Verify before merge");
    lines.push("");
    for (const item of verification.slice(0, 4)) {
      lines.push(`- ${escapeMarkdownInline(item)}`);
    }
  }

  const split = report.suggestedSplit.filter(
    (item) => !/no split required/i.test(item)
  );
  if (split.length > 0) {
    lines.push("");
    lines.push("### \u2702\uFE0F Suggested split");
    lines.push("");
    for (const item of split.slice(0, 3)) {
      lines.push(`- ${escapeMarkdownInline(item)}`);
    }
  }

  lines.push("");
  lines.push("---");
  lines.push(
    `<sub>Posted by \`ai-saas-guard pr-risk --format comment\`. ${trustStatement().map(escapeMarkdownInline).join(" ")}</sub>`
  );
  return lines.join("\n");
}

function formatGenericComment(report: BaseReport): string {
  const lines: string[] = [];
  lines.push(`## \u{1F6E1}\uFE0F ai-saas-guard ${escapeMarkdownInline(report.command)}`);
  lines.push("");
  lines.push(`**Verdict:** ${escapeMarkdownInline(launchGateVerdict(report))}`);
  lines.push("");
  lines.push("### Review first");
  lines.push("");
  for (const item of reviewFirst(report.findings, 3)) {
    lines.push(`- ${escapeMarkdownInline(item)}`);
  }
  lines.push("");
  lines.push("### Next");
  lines.push("");
  for (const item of nextSteps(report.findings).slice(0, 3)) {
    lines.push(`- ${escapeMarkdownInline(item)}`);
  }
  lines.push("");
  lines.push("---");
  lines.push(`<sub>${trustStatement().map(escapeMarkdownInline).join(" ")}</sub>`);
  return lines.join("\n");
}

