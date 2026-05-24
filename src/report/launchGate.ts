import type { BaseReport, Finding } from "../types.js";

export function launchGateVerdict(report: BaseReport): string {
  if (report.summary.critical > 0) {
    return "blocked: critical launch-readiness findings need review before inviting users";
  }
  if (report.summary.high > 0) {
    return "review required: high-risk launch paths need manual verification before launch";
  }
  if (report.summary.medium > 0) {
    return "check before launch: medium-risk findings should be verified by an owner";
  }
  if (report.summary.low > 0 || report.summary.info > 0) {
    return "low-noise review: confirm these hints against the launch checklist";
  }
  return "clear from current heuristics: no findings from this command, not a certification";
}

export function reviewFirst(findings: Finding[], limit = 3): string[] {
  return findings.slice(0, limit).map((finding) => {
    const firstEvidence = finding.evidence[0];
    const location = firstEvidence?.line ? `${firstEvidence.file}:${firstEvidence.line}` : firstEvidence?.file;
    return `${finding.severity.toUpperCase()} ${finding.ruleId}${location ? ` at ${location}` : ""} - ${finding.title}`;
  });
}

export function manualProofSteps(findings: Finding[], limit = 3): string[] {
  const steps: string[] = [];
  const seen = new Set<string>();

  for (const finding of findings) {
    const step = finding.suggestedVerification.trim();
    if (!step || seen.has(step)) continue;
    seen.add(step);
    steps.push(step);
    if (steps.length >= limit) break;
  }

  return steps;
}
