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

export function nextSteps(findings: Finding[]): string[] {
  if (findings.length === 0) {
    return [
      "Keep this report with the launch checklist, then run a two-account auth/data-access check and a deploy-preview smoke before inviting real users."
    ];
  }

  const steps: string[] = [];
  const hasCriticalOrHigh = findings.some((finding) => finding.severity === "critical" || finding.severity === "high");
  const hasMedium = findings.some((finding) => finding.severity === "medium");
  const hasLowNoise = findings.some((finding) => finding.severity === "low" || finding.severity === "info");

  if (hasCriticalOrHigh) {
    steps.push("Fix critical and high trust-boundary findings first: auth/session, billing/webhook, tenant data, and silent-success paths.");
  } else if (hasMedium) {
    steps.push("Verify medium-risk launch findings with the owning developer before production traffic.");
  }

  steps.push("Run the manual proof steps above in staging and confirm each risky path fails closed.");

  if (hasLowNoise) {
    steps.push("Treat low and info deploy/CI hygiene hints as cleanup after critical, high, and medium launch paths are understood.");
  }

  return steps;
}
