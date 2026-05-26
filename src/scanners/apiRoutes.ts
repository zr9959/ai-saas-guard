import type { Finding } from "../types.js";
import type { ScanInput } from "../context.js";
import { resolveScanContext } from "../context.js";
import { finding, uniqueFindings } from "../report/findings.js";
import { lineAt, lineNumberForIndex } from "../utils/files.js";

const sensitiveRoutePattern = /(login|register|auth|checkout|stripe|webhook|upload|ai|generate|admin|password|reset|token)/i;
const rateLimitPattern = /(rateLimit|ratelimit|rate-limit|throttle|limiter|upstash|slowDown)/i;
const authPattern = /(auth|session|currentUser|getUser|jwt|cookies|authorization)/i;
const ownershipPattern = /(user_id|userId|owner_id|ownerId|tenant_id|tenantId|organization_id|organizationId|workspace_id|workspaceId|resource\.user|resource\.owner|req\.user(?:Id|\.id)|where\s*:\s*{[\s\S]{0,140}(user|owner|tenant|organization|workspace))/i;
const providerDebugPathPattern = /(paypal|stripe|github|oauth|openai|anthropic|resend|sendgrid).*(token|config|status|test|probe|debug)|(token|config|status|test|probe|debug).*(paypal|stripe|github|oauth|openai|anthropic|resend|sendgrid)/i;
const providerCredentialProbePattern =
  /(client_credentials|oauth2\/token|access_token|PAYPAL_SECRET|PAYPAL_CLIENT_SECRET|STRIPE_SECRET|GITHUB_APP_PRIVATE_KEY|OPENAI_API_KEY|ANTHROPIC_API_KEY|SENDGRID_API_KEY|RESEND_API_KEY)/i;

export async function scanApiRoutes(input: ScanInput): Promise<Finding[]> {
  const files = (await resolveScanContext(input)).getFiles((file) => isApiRoute(file.path));
  const findings: Finding[] = [];

  for (const file of files) {
    const hasPostOrMutation = /\b(POST|PUT|PATCH|DELETE)\b|export\s+async\s+function\s+(POST|PUT|PATCH|DELETE)/.test(file.content);
    const isSensitive = sensitiveRoutePattern.test(file.path) || sensitiveRoutePattern.test(file.content);

    findings.push(...scanClerkUnsafeMetadata(file.path, file.content));
    findings.push(...scanPrismaTenantScope(file.path, file.content));
    findings.push(...scanProviderDebugEndpoint(file.path, file.content));

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

    if (
      authPattern.test(file.content) &&
      /params\.|searchParams|get\(|findUnique|findFirst|update|delete/i.test(file.content) &&
      !ownershipPattern.test(file.content) &&
      !hasExplicitAdminGuard(file.content)
    ) {
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

function scanProviderDebugEndpoint(filePath: string, content: string): Finding[] {
  if (!/\bGET\b|export\s+async\s+function\s+GET/i.test(content)) return [];
  if (!providerDebugPathPattern.test(filePath) && !providerDebugPathPattern.test(content)) return [];
  if (!providerCredentialProbePattern.test(content)) return [];
  if (hasExplicitAdminGuard(content) && rateLimitPattern.test(content)) return [];

  return [
    finding({
      ruleId: "api.route.provider-debug-exposed",
      title: `Public provider token or configuration probe endpoint: ${filePath}`,
      severity: "high",
      evidence: [{ file: filePath, line: firstLine(content, providerCredentialProbePattern), snippet: firstSnippet(content, providerCredentialProbePattern) }],
      why: "A public debug endpoint can spend provider quota, reveal integration mode or configuration state, and exercise server-side credentials even when it does not return the token.",
      suggestedVerification:
        "Call the route without a session in staging and confirm it cannot trigger provider authentication or reveal provider configuration state.",
      suggestedFix:
        "Remove the endpoint before launch, or require admin authentication, add a dedicated rate limit, emit an audit log, and disable it in production."
    })
  ];
}

function hasExplicitAdminGuard(content: string): boolean {
  return /\b(requireAdmin|adminMiddleware|isAdmin|requireRole\s*\(\s*["']admin|role\s*[:=]\s*["']admin)/i.test(content);
}

function scanClerkUnsafeMetadata(filePath: string, content: string): Finding[] {
  if (!/\b(@clerk\/|clerkClient|currentUser|auth\s*\()/i.test(content)) return [];
  const findings: Finding[] = [];
  const privilegedUnsafeMetadataPattern =
    /unsafeMetadata\s*:\s*\{[\s\S]{0,700}\b(role|roles|admin|isAdmin|plan|tier|subscription|entitlement|credits|tenant|tenantId|organization|organizationId|orgId|workspace|permissions?)\b/gi;

  for (const match of content.matchAll(privilegedUnsafeMetadataPattern)) {
    const line = lineNumberForIndex(content, match.index ?? 0);
    findings.push(
      finding({
        ruleId: "auth.clerk.unsafe-metadata",
        title: `Clerk unsafe metadata appears to store privileged launch state: ${filePath}`,
        severity: "high",
        evidence: [{ file: filePath, line, snippet: lineAt(content, line) }],
        why: "Clerk unsafe metadata can be modified from the client side, so roles, paid plans, tenant membership, or entitlement state stored there can become authorization input by accident.",
        suggestedVerification:
          "Try changing the same metadata as a normal signed-in user and confirm it cannot grant admin, paid plan, tenant, workspace, or entitlement access.",
        suggestedFix:
          "Store authorization and billing state in server-controlled Clerk private/public metadata or your database, and use unsafe metadata only for non-privileged user preferences."
      })
    );
  }

  return findings;
}

function scanPrismaTenantScope(filePath: string, content: string): Finding[] {
  if (!/\bprisma\.[A-Za-z0-9_]+\./.test(content) || !authPattern.test(content)) return [];
  const findings: Finding[] = [];
  const operationPattern = /\bprisma\.([A-Za-z0-9_]+)\.(findUnique|findFirst|update|delete|upsert|updateMany|deleteMany)\s*\(/gi;

  for (const match of content.matchAll(operationPattern)) {
    const model = match[1];
    if (!isTenantLikePrismaSurface(filePath, content, model)) continue;
    const start = content.indexOf("(", match.index ?? 0);
    const end = findMatchingParen(content, start);
    const operationText = content.slice(match.index ?? 0, end > start ? end + 1 : (match.index ?? 0) + 900);
    if (hasTenantOrOwnerScope(operationText)) continue;
    const line = lineNumberForIndex(content, match.index ?? 0);
    findings.push(
      finding({
        ruleId: "data.prisma.tenant-scope-missing",
        title: `Prisma ${model} access lacks an obvious tenant or owner predicate: ${filePath}`,
        severity: "high",
        evidence: [{ file: filePath, line, snippet: lineAt(content, line) }],
        why: "A route can authenticate the caller but still read or mutate another tenant's resource when Prisma queries only scope by a guessed resource ID.",
        suggestedVerification:
          "Run a two-account or cross-tenant test: create this resource as Tenant/User A, then attempt the same read/update/delete with Tenant/User B.",
        suggestedFix:
          "Add tenant, organization, workspace, owner, user, or membership predicates to the Prisma `where` clause and cover the cross-tenant denial in tests."
      })
    );
  }

  return findings;
}

function isApiRoute(path: string): boolean {
  return (
    /(^|\/)app\/api\/.+\/route\.(ts|js|tsx|jsx)$/i.test(path) ||
    /(^|\/)pages\/api\/.+\.(ts|js)$/i.test(path) ||
    /(^|\/)(routes|controllers)\/.+\.(ts|js)$/i.test(path)
  );
}

function isTenantLikePrismaSurface(filePath: string, content: string, model: string): boolean {
  return /\[(?:tenant|org|organization|workspace|project|client|customer|team|account|invoice|subscription|id)[^\]]*\]/i.test(filePath) ||
    /\b(tenant|organization|orgId|workspace|project|client|customer|team|account|invoice|subscription|membership)\b/i.test(`${model}\n${filePath}\n${content}`);
}

function hasTenantOrOwnerScope(operationText: string): boolean {
  return /\b(tenantId|tenant_id|orgId|organizationId|organization_id|workspaceId|workspace_id|ownerId|owner_id|userId|user_id|memberId|member_id|membershipId|membership_id)\s*:/i.test(operationText) ||
    /\b(memberships?|organization|workspace|tenant)\s*:\s*\{/i.test(operationText);
}

function findMatchingParen(content: string, openParen: number): number {
  if (openParen < 0) return -1;
  let depth = 0;
  let inSingle = false;
  let inDouble = false;
  let inTemplate = false;

  for (let index = openParen; index < content.length; index += 1) {
    const char = content[index];
    const prev = content[index - 1];
    if (prev === "\\") continue;
    if (char === "'" && !inDouble && !inTemplate) inSingle = !inSingle;
    if (char === "\"" && !inSingle && !inTemplate) inDouble = !inDouble;
    if (char === "`" && !inSingle && !inDouble) inTemplate = !inTemplate;
    if (inSingle || inDouble || inTemplate) continue;
    if (char === "(") depth += 1;
    if (char === ")") {
      depth -= 1;
      if (depth === 0) return index;
    }
  }

  return -1;
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
