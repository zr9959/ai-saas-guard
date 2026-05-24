import type { ActionsReport, Finding } from "../types.js";
import type { ScanInput } from "../context.js";
import { resolveScanContext } from "../context.js";
import { createReport, finding, uniqueFindings } from "../report/findings.js";
import { lineAt, lineNumberForIndex } from "../utils/files.js";

const broadPermissionPattern = /^\s*(contents|pull-requests|actions|id-token|deployments|checks|packages):\s*write\b/gim;
const unpinnedActionPattern = /^\s*-\s*uses:\s*([^@\s]+)@([^\s#]+).*$/gim;

export async function checkActions(input: ScanInput): Promise<ActionsReport> {
  const context = await resolveScanContext(input);
  const workflows = context.getFiles((file) => /^\.github\/workflows\/[^/]+\.(ya?ml)$/i.test(file.path));
  const findings: Finding[] = [];

  for (const file of workflows) {
    const broadPermission = findBroadPermission(file.content);
    if (broadPermission && !hasObviousPermissionNeed(file.content, broadPermission.permission)) {
      findings.push(
        finding({
          ruleId: "actions.permissions.too-broad",
          title: `GitHub Actions workflow grants broad write permissions: ${file.path}`,
          severity: "medium",
          evidence: [{ file: file.path, line: broadPermission.line, snippet: broadPermission.snippet }],
          why: "Launch preflight workflows usually only need read access; broad write permissions increase the blast radius of compromised dependencies or PR-triggered automation.",
          suggestedVerification:
            "Review every write permission in this workflow and confirm the job actually writes checks, packages, deployments, or pull request content.",
          suggestedFix:
            "Set top-level `permissions: contents: read` and grant narrower job-level write permissions only where a step requires them."
        })
      );
    }

    if (isPullRequestWorkflow(file.content) && !hasCancelInProgressConcurrency(file.content)) {
      findings.push(
        finding({
          ruleId: "actions.pr-missing-concurrency",
          title: `Pull request workflow lacks concurrency cancel-in-progress: ${file.path}`,
          severity: "low",
          evidence: [{ file: file.path, line: firstLine(file.content, /^\s*pull_request:/im), snippet: firstSnippet(file.content, /^\s*pull_request:/im) }],
          why: "AI-assisted development can push many revisions quickly; stale PR workflow runs waste reviewer time and CI budget.",
          suggestedVerification: "Push two quick commits to a test PR and confirm the older run is cancelled.",
          suggestedFix:
            "Add a `concurrency` group keyed by workflow and ref with `cancel-in-progress: true` for PR workflows."
        })
      );
    }

    if (runsOnPullRequestOrPush(file.content) && !hasPathFilters(file.content)) {
      findings.push(
        finding({
          ruleId: "actions.docs-only-full-ci",
          title: `Workflow appears to run full CI for docs-only changes: ${file.path}`,
          severity: "low",
          evidence: [{ file: file.path, line: firstLine(file.content, /^on:/im), snippet: firstSnippet(file.content, /^on:/im) }],
          why: "Docs-only AI edits should not always trigger the same expensive launch test path as auth, billing, and data-access code.",
          suggestedVerification:
            "Open a docs-only test PR and confirm whether the workflow can skip full install/build/test jobs.",
          suggestedFix:
            "Add `paths` or `paths-ignore` filters, or split docs validation from full launch-preflight CI."
        })
      );
    }

    if (usesSecrets(file.content) && !hasFailFastEnvironmentCheck(file.content)) {
      const match = firstMatch(file.content, /\bsecrets\.[A-Z0-9_]+/gi);
      findings.push(
        finding({
          ruleId: "actions.secrets-missing-failfast",
          title: `Workflow uses secrets without an obvious fail-fast environment check: ${file.path}`,
          severity: "medium",
          evidence: [{ file: file.path, line: match.line, snippet: match.snippet }],
          why: "Launch workflows that rely on secrets or deploy environments should fail clearly before expensive or stateful steps run with empty config.",
          suggestedVerification:
            "Run the workflow in a safe branch with a required secret intentionally absent and confirm it fails before build, deploy, or scan side effects.",
          suggestedFix:
            "Add early shell checks such as `test -n \"${VAR:-}\"` and explicit tool-version checks before deploy or integration steps."
        })
      );
    }

    if (mentionsPrRisk(file.content) && hasShallowCheckout(file.content)) {
      const match = firstMatch(file.content, /fetch-depth:\s*(?:1|2|[3-9]\d*)/gi);
      findings.push(
        finding({
          ruleId: "actions.checkout.fetch-depth",
          title: `Workflow may checkout too little history for pr-risk: ${file.path}`,
          severity: "medium",
          evidence: [{ file: file.path, line: match.line, snippet: match.snippet }],
          why: "`pr-risk --base` needs enough Git history to compare against the base ref; shallow checkouts can produce misleading no-diff or diff-unavailable output.",
          suggestedVerification:
            "Run `git rev-parse --is-shallow-repository` in CI and confirm `ai-saas-guard pr-risk --base origin/main` can read a merge-base diff.",
          suggestedFix:
            "Set `actions/checkout` `fetch-depth: 0` when invoking `pr-risk` against a base branch."
        })
      );
    }

    for (const match of file.content.matchAll(unpinnedActionPattern)) {
      const ref = match[2] ?? "";
      if (/^[a-f0-9]{40}$/i.test(ref)) continue;
      const actionName = match[1] ?? "action";
      findings.push(
        finding({
          ruleId: "actions.unpinned-action",
          title: `GitHub Action is not pinned to a full commit SHA: ${actionName}`,
          severity: "info",
          evidence: [{ file: file.path, line: lineNumberForIndex(file.content, match.index ?? 0), snippet: lineAt(file.content, lineNumberForIndex(file.content, match.index ?? 0)) }],
          why: "Pinned action SHAs make launch-preflight runs more reproducible. This is a hygiene hint, not a replacement for zizmor or Scorecard.",
          suggestedVerification: "Review whether the referenced Action version is intentionally floating.",
          suggestedFix:
            "Pin third-party actions to reviewed full commit SHAs, keeping a comment with the human-readable version when helpful."
        })
      );
    }
  }

  return createReport<ActionsReport>("check-actions", context.rootDir, uniqueFindings(findings), {
    workflows: workflows.map((file) => file.path).sort(),
    hygieneChecklist: [
      "Use least-privilege workflow permissions.",
      "Cancel stale PR runs with concurrency.",
      "Avoid full CI for docs-only edits when possible.",
      "Fail fast when secrets or tool versions are missing.",
      "Use `fetch-depth: 0` for `pr-risk --base` workflows.",
      "Pin third-party actions to reviewed SHAs for reproducibility."
    ]
  });
}

function isPullRequestWorkflow(content: string): boolean {
  return /^\s*pull_request(?:_target)?:/im.test(content);
}

function runsOnPullRequestOrPush(content: string): boolean {
  return /^\s*(pull_request(?:_target)?|push):/im.test(content);
}

function hasCancelInProgressConcurrency(content: string): boolean {
  if (!/^\s*concurrency:/im.test(content)) return false;
  const match = /^\s*cancel-in-progress:\s*(.+?)\s*$/im.exec(content);
  if (!match) return false;
  const value = match[1]?.trim() ?? "";
  if (/^true\b/i.test(value)) return true;
  if (/^\$\{\{[\s\S]*\}\}$/.test(value) && !/\bfalse\b/i.test(value)) return true;
  return false;
}

function hasPathFilters(content: string): boolean {
  return /^\s*(paths|paths-ignore):\s*$/im.test(content) || /^\s*(paths|paths-ignore):\s*\[/im.test(content);
}

function usesSecrets(content: string): boolean {
  return /\bsecrets\.[A-Z0-9_]+/i.test(content) || /^\s*environment:/im.test(content);
}

function hasFailFastEnvironmentCheck(content: string): boolean {
  return /\btest\s+-n\s+["']?\$\{?[A-Z0-9_]+|if\s*\[\s*-z\s+["']?\$\{?[A-Z0-9_]+|node\s+--version|npm\s+--version|pnpm\s+--version|yarn\s+--version/i.test(content);
}

function mentionsPrRisk(content: string): boolean {
  return /\bai-saas-guard\b[\s\S]{0,120}\bpr-risk\b|\bpr-risk\b[\s\S]{0,120}\bai-saas-guard\b/i.test(content);
}

function hasShallowCheckout(content: string): boolean {
  if (!/actions\/checkout@/i.test(content)) return false;
  if (/fetch-depth:\s*0\b/i.test(content)) return false;
  return /fetch-depth:\s*(?:1|2|[3-9]\d*)/i.test(content) || true;
}

function firstLine(content: string, pattern: RegExp): number | undefined {
  const match = pattern.exec(content);
  pattern.lastIndex = 0;
  return match ? lineNumberForIndex(content, match.index) : undefined;
}

function firstSnippet(content: string, pattern: RegExp): string | undefined {
  const line = firstLine(content, pattern);
  return line ? lineAt(content, line) : undefined;
}

function firstMatch(content: string, pattern: RegExp): { line?: number; snippet?: string } {
  pattern.lastIndex = 0;
  const match = pattern.exec(content);
  pattern.lastIndex = 0;
  if (!match) return {};
  const line = lineNumberForIndex(content, match.index);
  return { line, snippet: lineAt(content, line) };
}

function findBroadPermission(content: string): { permission: string; line?: number; snippet?: string } | undefined {
  broadPermissionPattern.lastIndex = 0;
  const match = broadPermissionPattern.exec(content);
  broadPermissionPattern.lastIndex = 0;
  if (!match) return undefined;
  const line = lineNumberForIndex(content, match.index);
  return {
    permission: match[1],
    line,
    snippet: lineAt(content, line)
  };
}

function hasObviousPermissionNeed(content: string, permission: string): boolean {
  if (permission === "id-token") {
    return /\bnpm\s+publish\b|trusted publishing|provenance|google-github-actions\/auth|aws-actions\/configure-aws-credentials|azure\/login/i.test(content);
  }
  if (permission === "security-events") {
    return /upload-sarif|codeql-action\/analyze/i.test(content);
  }
  if (permission === "pull-requests") {
    return /gh\s+pr|pulls\/|github-script[\s\S]{0,200}pulls/i.test(content);
  }
  if (permission === "checks") {
    return /check-runs|checks\.create|github-script[\s\S]{0,200}checks/i.test(content);
  }
  if (permission === "contents") {
    return /\b(git\s+push|gh\s+release|npm\s+version|create-pull-request|actions\/upload-artifact)\b/i.test(content);
  }
  return false;
}
