import type { BaseReport, ShowcaseReport } from "../types.js";
import { launchDecisionQuestions, launchGateVerdict, manualProofSteps, nextSteps, reviewFirst } from "./launchGate.js";

export function formatSummaryReport(report: BaseReport): string {
  if (report.command === "demo") return formatShowcaseSummary(report as ShowcaseReport);

  const lines: string[] = [];
  lines.push(`ai-saas-guard ${report.command} summary`);
  lines.push(`Root: ${report.rootDir}`);
  lines.push(`Findings: ${summaryText(report)}`);
  lines.push(`Launch gate: ${launchGateVerdict(report)}`);
  lines.push(`Decision queue: ${launchDecisionQuestions(report.findings)[0]}`);
  const scanCoverage = scanCoverageText(report);
  if (scanCoverage) lines.push(`Scan coverage: ${scanCoverage}`);
  if (report.findings.length > 0) {
    lines.push("Review trust-boundary findings before deploy/cost hygiene.");
  }

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

function scanCoverageText(report: BaseReport): string | undefined {
  const parts: string[] = [];
  const collection = report.fileCollection;
  if (collection) {
    const unreadableFileCount = collection.unreadableFiles.length;
    const unreadableDirectoryCount = collection.unreadableDirectories.length;
    const skippedLargeCount = collection.skippedLargeFiles.length;
    const skippedBudgetCount = collection.skippedBudgetFiles.length;
    const hasCollectionWarning =
      unreadableFileCount > 0 ||
      unreadableDirectoryCount > 0 ||
      skippedLargeCount > 0 ||
      skippedBudgetCount > 0 ||
      collection.maxFilesReached ||
      collection.maxTotalBytesReached;

    if (hasCollectionWarning) {
      parts.push(`${collection.filesScanned} ${plural(collection.filesScanned, "file")} scanned`);
      if (unreadableFileCount > 0) parts.push(`${unreadableFileCount} unreadable ${plural(unreadableFileCount, "file")}`);
      if (unreadableDirectoryCount > 0) {
        parts.push(`${unreadableDirectoryCount} unreadable ${plural(unreadableDirectoryCount, "directory", "directories")}`);
      }
      if (skippedLargeCount > 0) parts.push(`${skippedLargeCount} large ${plural(skippedLargeCount, "file")} skipped`);
      if (skippedBudgetCount > 0) parts.push(`${skippedBudgetCount} budget-skipped ${plural(skippedBudgetCount, "file")}`);
      if (collection.maxFilesReached) parts.push("file count budget reached");
      if (collection.maxTotalBytesReached) parts.push("total byte budget reached");
    }
  }

  const malformedPackageCount =
    report.stackInventory?.warnings.filter((warning) => warning.reason === "invalid_package_json").length ?? 0;
  if (malformedPackageCount > 0) {
    parts.push(`${malformedPackageCount} malformed package ${plural(malformedPackageCount, "manifest")}`);
  }

  return parts.length > 0 ? parts.join("; ") : undefined;
}

function plural(count: number, singular: string, pluralValue = `${singular}s`): string {
  return count === 1 ? singular : pluralValue;
}
