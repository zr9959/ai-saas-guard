import type { Finding } from "../types.js";
import type { ScanInput } from "../context.js";
import { resolveScanContext } from "../context.js";
import { finding, uniqueFindings } from "../report/findings.js";
import { lineAt, lineNumberForIndex } from "../utils/files.js";

const sensitiveRoutePattern = /(login|register|auth|checkout|stripe|webhook|upload|ai|generate|admin|password|reset|token)/i;
const rateLimitPattern = /(rateLimit|ratelimit|rate-limit|throttle|limiter|upstash|slowDown)/i;
const authPattern = /(auth|session|currentUser|getUser|jwt|cookies|authorization)/i;
const ownershipPattern = /(user_id|owner_id|tenant_id|organization_id|workspace_id|resource\.user|resource\.owner|where\s*:\s*{[\s\S]{0,100}(user|owner|tenant))/i;

export async function scanApiRoutes(input: ScanInput): Promise<Finding[]> {
  const files = (await resolveScanContext(input)).getFiles((file) => isApiRoute(file.path));
  const findings: Finding[] = [];

  for (const file of files) {
    const hasPostOrMutation = /\b(POST|PUT|PATCH|DELETE)\b|export\s+async\s+function\s+(POST|PUT|PATCH|DELETE)/.test(file.content);
    const isSensitive = sensitiveRoutePattern.test(file.path) || sensitiveRoutePattern.test(file.content);

    if (isSensitive && hasPostOrMutation && !rateLimitPattern.test(file.content)) {
      findings.push(
        finding({
          ruleId: "api.route.missing-rate-limit",
          title: `Sensitive API route lacks obvious rate limiting: ${file.path}`,
          severity: "medium",
          evidence: [{ file: file.path, line: firstLine(file.content, /\b(POST|PUT|PATCH|DELETE)\b/), snippet: firstSnippet(file.content, /\b(POST|PUT|PATCH|DELETE)\b/) }],
          why: "Login, checkout, upload, AI, and webhook endpoints are common abuse targets in AI-built SaaS apps.",
          suggestedVerification:
            "Run repeated requests against this route in a staging environment and confirm abuse is throttled before expensive or stateful work runs.",
          suggestedFix:
            "Add IP/user keyed rate limiting close to the route entry point, with stricter limits for auth, checkout, upload, AI, and webhook paths."
        })
      );
    }

    if (authPattern.test(file.content) && /params\.|searchParams|get\(|findUnique|findFirst|update|delete/i.test(file.content) && !ownershipPattern.test(file.content)) {
      findings.push(
        finding({
          ruleId: "api.route.auth-without-ownership",
          title: `API route checks auth but lacks an obvious ownership guard: ${file.path}`,
          severity: "high",
          evidence: [{ file: file.path, line: firstLine(file.content, authPattern), snippet: firstSnippet(file.content, authPattern) }],
          why: "A route can require login but still allow User B to access User A's resource by guessing an ID.",
          suggestedVerification:
            "Run a two-account IDOR test: create a resource as User A, then read, update, and delete it using User B's session.",
          suggestedFix:
            "Scope every resource query or mutation by the current user's owner, tenant, or membership relationship."
        })
      );
    }
  }

  return uniqueFindings(findings);
}

function isApiRoute(path: string): boolean {
  return (
    /(^|\/)app\/api\/.+\/route\.(ts|js|tsx|jsx)$/i.test(path) ||
    /(^|\/)pages\/api\/.+\.(ts|js)$/i.test(path) ||
    /(^|\/)(routes|controllers)\/.+\.(ts|js)$/i.test(path)
  );
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
