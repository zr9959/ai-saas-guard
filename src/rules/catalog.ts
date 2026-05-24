import type { Severity } from "../types.js";

export type RuleStability = "default" | "experimental" | "strict";

export interface RuleMetadata {
  ruleId: string;
  severity: Severity;
  title: string;
  why: string;
  stability: RuleStability;
}

export const RULE_CATALOG: Record<string, RuleMetadata> = {
  "actions.checkout.fetch-depth": {
    ruleId: "actions.checkout.fetch-depth",
    severity: "medium",
    title: "GitHub Actions checkout may be too shallow for PR risk",
    why: "`pr-risk --base` needs enough Git history to compare trust-boundary changes reliably.",
    stability: "default"
  },
  "actions.docs-only-full-ci": {
    ruleId: "actions.docs-only-full-ci",
    severity: "low",
    title: "Docs-only changes may trigger full CI",
    why: "AI-assisted docs edits should not always spend the same launch-readiness CI budget as code changes.",
    stability: "experimental"
  },
  "actions.permissions.too-broad": {
    ruleId: "actions.permissions.too-broad",
    severity: "medium",
    title: "GitHub Actions workflow grants broad write permissions",
    why: "Launch preflight workflows usually need read access, not broad repository mutation privileges.",
    stability: "default"
  },
  "actions.pr-missing-concurrency": {
    ruleId: "actions.pr-missing-concurrency",
    severity: "low",
    title: "Pull request workflow lacks concurrency cancellation",
    why: "AI-assisted PRs can push many commits quickly, making stale CI runs wasteful and confusing.",
    stability: "experimental"
  },
  "actions.secrets-missing-failfast": {
    ruleId: "actions.secrets-missing-failfast",
    severity: "medium",
    title: "GitHub Actions secrets lack fail-fast checks",
    why: "Deploy or integration workflows should fail clearly when required secrets or tools are missing.",
    stability: "default"
  },
  "actions.unpinned-action": {
    ruleId: "actions.unpinned-action",
    severity: "info",
    title: "GitHub Action is not pinned to a full commit SHA",
    why: "Pinned actions make launch-preflight workflows more reproducible.",
    stability: "experimental"
  },
  "secrets.detected": {
    ruleId: "secrets.detected",
    severity: "high",
    title: "Secret-like value detected",
    why: "Credentials committed to source, config, or examples can be exposed before launch.",
    stability: "strict"
  },
  "next.env.public-secret": {
    ruleId: "next.env.public-secret",
    severity: "high",
    title: "Risky NEXT_PUBLIC environment variable",
    why: "Next.js exposes NEXT_PUBLIC variables to browser code, so secret-like values can leak to users.",
    stability: "strict"
  },
  "stripe.webhook.missing-route": {
    ruleId: "stripe.webhook.missing-route",
    severity: "medium",
    title: "No Stripe webhook handler found",
    why: "Stripe checkout redirects are not a reliable source of billing truth.",
    stability: "default"
  },
  "stripe.webhook.missing-signature": {
    ruleId: "stripe.webhook.missing-signature",
    severity: "critical",
    title: "Stripe webhook does not verify the Stripe signature",
    why: "Unsigned webhook handlers can accept forged billing events.",
    stability: "strict"
  },
  "stripe.webhook.raw-body-risk": {
    ruleId: "stripe.webhook.raw-body-risk",
    severity: "high",
    title: "Stripe signature verification may use a parsed JSON body",
    why: "Stripe signature checks require the exact raw request body.",
    stability: "default"
  },
  "stripe.webhook.public-secret": {
    ruleId: "stripe.webhook.public-secret",
    severity: "critical",
    title: "Stripe signing secret appears public",
    why: "Public Stripe secrets can be bundled into client code and abused.",
    stability: "strict"
  },
  "stripe.webhook.missing-idempotency": {
    ruleId: "stripe.webhook.missing-idempotency",
    severity: "high",
    title: "Stripe webhook lacks duplicate event idempotency",
    why: "Stripe retries and duplicate events can drift billing state.",
    stability: "default"
  },
  "stripe.webhook.no-entitlement-path": {
    ruleId: "stripe.webhook.no-entitlement-path",
    severity: "medium",
    title: "Stripe webhook does not show an entitlement update path",
    why: "Returning HTTP 200 is not the same as changing application access state.",
    stability: "experimental"
  },
  "stripe.webhook.missing-critical-event": {
    ruleId: "stripe.webhook.missing-critical-event",
    severity: "high",
    title: "Stripe webhook does not handle a critical lifecycle event",
    why: "Failure, cancellation, update, and refund paths need explicit handling.",
    stability: "default"
  },
  "supabase.rls.broad-policy": {
    ruleId: "supabase.rls.broad-policy",
    severity: "critical",
    title: "Broad Supabase RLS policy",
    why: "`USING (true)` or `WITH CHECK (true)` can turn login into broad data access or writes.",
    stability: "strict"
  },
  "supabase.rls.enabled-no-policy": {
    ruleId: "supabase.rls.enabled-no-policy",
    severity: "high",
    title: "Supabase RLS is enabled without policies",
    why: "RLS with no policies often looks like silent empty results instead of an explainable launch failure.",
    stability: "default"
  },
  "supabase.rls.missing-ownership-filter": {
    ruleId: "supabase.rls.missing-ownership-filter",
    severity: "high",
    title: "Supabase policy lacks an ownership filter",
    why: "Policies need resource ownership or tenant membership checks.",
    stability: "default"
  },
  "supabase.rls.public-write-policy": {
    ruleId: "supabase.rls.public-write-policy",
    severity: "high",
    title: "Supabase write policy grants public role",
    why: "Public write policies can expose inserts or mutations when predicates are incomplete.",
    stability: "default"
  },
  "supabase.rls.tenant-predicate-missing": {
    ruleId: "supabase.rls.tenant-predicate-missing",
    severity: "high",
    title: "Supabase tenant-like table lacks tenant predicate",
    why: "Multi-tenant SaaS tables need tenant, workspace, organization, owner, or membership predicates.",
    stability: "experimental"
  },
  "supabase.rls.uid-column-mismatch": {
    ruleId: "supabase.rls.uid-column-mismatch",
    severity: "medium",
    title: "Supabase policy compares auth.uid() to suspicious column",
    why: "`auth.uid()` is a UUID; comparing it to text/email/name columns commonly causes silent policy failures.",
    stability: "experimental"
  },
  "supabase.rls.weak-with-check": {
    ruleId: "supabase.rls.weak-with-check",
    severity: "high",
    title: "Supabase write policy has a weak WITH CHECK predicate",
    why: "Insert and update policies need WITH CHECK predicates tied to the current user or tenant membership.",
    stability: "default"
  },
  "supabase.rls.write-policy-missing": {
    ruleId: "supabase.rls.write-policy-missing",
    severity: "medium",
    title: "Supabase table has read policy but no common write policy",
    why: "Reads can work while inserts, updates, or deletes silently fail when write policies are missing.",
    stability: "experimental"
  },
  "supabase.table.missing-owner-column": {
    ruleId: "supabase.table.missing-owner-column",
    severity: "medium",
    title: "Sensitive table has no owner or tenant column",
    why: "Sensitive tables are hard to protect without owner or tenant keys.",
    stability: "default"
  },
  "supabase.rls.not-enabled": {
    ruleId: "supabase.rls.not-enabled",
    severity: "critical",
    title: "Sensitive table does not enable row level security",
    why: "User-data tables should enable row level security.",
    stability: "strict"
  },
  "supabase.storage.public-bucket": {
    ruleId: "supabase.storage.public-bucket",
    severity: "high",
    title: "Supabase storage policy or bucket appears public",
    why: "Storage buckets can leak files even when database rows are protected.",
    stability: "default"
  },
  "api.route.missing-rate-limit": {
    ruleId: "api.route.missing-rate-limit",
    severity: "medium",
    title: "Sensitive API route lacks obvious rate limiting",
    why: "Login, checkout, upload, AI, and webhook routes are common abuse targets.",
    stability: "experimental"
  },
  "api.route.auth-without-ownership": {
    ruleId: "api.route.auth-without-ownership",
    severity: "high",
    title: "API route checks auth but lacks an ownership guard",
    why: "Login checks do not prove resource ownership checks.",
    stability: "experimental"
  },
  "auth.clerk.unsafe-metadata": {
    ruleId: "auth.clerk.unsafe-metadata",
    severity: "high",
    title: "Clerk unsafe metadata is used for privileged state",
    why: "Clerk unsafe metadata is user-writable and should not drive roles, plans, tenant membership, or entitlements.",
    stability: "default"
  },
  "data.prisma.tenant-scope-missing": {
    ruleId: "data.prisma.tenant-scope-missing",
    severity: "high",
    title: "Prisma resource access lacks tenant or owner scope",
    why: "Authenticated Prisma reads or mutations on tenant-like resources need tenant, owner, organization, or workspace predicates.",
    stability: "experimental"
  },
  "silent-success.swallowed-error": {
    ruleId: "silent-success.swallowed-error",
    severity: "high",
    title: "Error handling may return fake success",
    why: "Swallowed provider, auth, billing, or data errors can make a launch path look successful when it failed.",
    stability: "default"
  },
  "silent-success.production-mock-data": {
    ruleId: "silent-success.production-mock-data",
    severity: "medium",
    title: "Production path may use mock or demo data",
    why: "Fixtures and demo responses in sensitive paths can make AI-built integrations look complete before they are real.",
    stability: "default"
  },
  "silent-success.hardcoded-fallback": {
    ruleId: "silent-success.hardcoded-fallback",
    severity: "high",
    title: "Sensitive path contains hardcoded fallback success",
    why: "Hardcoded success fallbacks in auth, billing, AI, or data paths can grant access or hide broken integrations.",
    stability: "default"
  },
  "silent-success.weakened-test": {
    ruleId: "silent-success.weakened-test",
    severity: "medium",
    title: "Test may be skipped or placeholder-only",
    why: "Skipped, TODO-only, empty, or truthy-only tests create fake confidence in AI-generated code.",
    stability: "default"
  },
  "silent-success.temporary-bypass": {
    ruleId: "silent-success.temporary-bypass",
    severity: "high",
    title: "Temporary trust-boundary bypass",
    why: "Temporary bypasses around auth, validation, webhook verification, rate limits, or ownership are common launch blockers.",
    stability: "default"
  },
  "deploy.next.static-export-api-risk": {
    ruleId: "deploy.next.static-export-api-risk",
    severity: "medium",
    title: "Next static export may conflict with server routes",
    why: "Static export can conflict with runtime API assumptions.",
    stability: "default"
  },
  "deploy.next.missing-security-headers": {
    ruleId: "deploy.next.missing-security-headers",
    severity: "medium",
    title: "Next/Vercel app lacks obvious security headers",
    why: "Apps with auth, payment, and API routes should launch with explicit browser security headers.",
    stability: "experimental"
  },
  "deploy.env.server-undocumented": {
    ruleId: "deploy.env.server-undocumented",
    severity: "low",
    title: "Server route env var is not documented",
    why: "Undocumented server env vars cause local-success, production-failure deploys.",
    stability: "experimental"
  },
  "deploy.env.public-inventory": {
    ruleId: "deploy.env.public-inventory",
    severity: "info",
    title: "Public Next.js env var inventory",
    why: "`NEXT_PUBLIC_*` variables are browser-visible and should be reviewed as public config.",
    stability: "experimental"
  },
  "deploy.next.image-cost-risk": {
    ruleId: "deploy.next.image-cost-risk",
    severity: "medium",
    title: "Next image optimization may be unbounded",
    why: "Broad remote image patterns or user-controlled image sources can amplify deploy cost and trust risk.",
    stability: "experimental"
  },
  "deploy.next.request-amplification": {
    ruleId: "deploy.next.request-amplification",
    severity: "low",
    title: "Dynamic route prefetch may amplify requests",
    why: "High-cardinality dynamic route prefetching can create unexpected production request volume.",
    stability: "experimental"
  },
  "deploy.observability.missing-request-id": {
    ruleId: "deploy.observability.missing-request-id",
    severity: "low",
    title: "Sensitive route lacks request ID logging",
    why: "Billing, webhook, and tenant incidents are hard to debug without traceable request IDs.",
    stability: "experimental"
  },
  "deploy.vercel.cron-missing-guard": {
    ruleId: "deploy.vercel.cron-missing-guard",
    severity: "medium",
    title: "Vercel cron route lacks launch guards",
    why: "Scheduled billing, tenant, or cleanup jobs need a secret guard, idempotency, and request tracing before launch.",
    stability: "experimental"
  },
  "deploy.edge-runtime-node-api": {
    ruleId: "deploy.edge-runtime-node-api",
    severity: "medium",
    title: "Route may use Node-only APIs in Edge runtime",
    why: "Edge runtime can break Node-only dependencies.",
    stability: "default"
  },
  "deploy.env.example-missing": {
    ruleId: "deploy.env.example-missing",
    severity: "low",
    title: "Important runtime env var is not documented",
    why: "Missing env docs cause local-success, production-failure deploys.",
    stability: "experimental"
  },
  "mcp.config.invalid-json": {
    ruleId: "mcp.config.invalid-json",
    severity: "medium",
    title: "MCP config is not valid JSON",
    why: "Broken MCP configs hide the actual tool inventory.",
    stability: "strict"
  },
  "mcp.config.plaintext-secret": {
    ruleId: "mcp.config.plaintext-secret",
    severity: "high",
    title: "MCP server contains plaintext secret-like config",
    why: "Prompt and tool logs can expose plaintext credentials.",
    stability: "default"
  },
  "mcp.config.non-local-bind": {
    ruleId: "mcp.config.non-local-bind",
    severity: "high",
    title: "MCP server may bind outside localhost",
    why: "Broad bind addresses can expose local tools to the network.",
    stability: "default"
  },
  "mcp.config.insecure-http": {
    ruleId: "mcp.config.insecure-http",
    severity: "medium",
    title: "MCP server uses insecure HTTP for a non-local endpoint",
    why: "Plain HTTP can expose tool calls and credentials outside localhost.",
    stability: "default"
  },
  "mcp.config.broad-filesystem": {
    ruleId: "mcp.config.broad-filesystem",
    severity: "high",
    title: "MCP server has broad filesystem or write access",
    why: "Write access over broad paths increases prompt-injection blast radius.",
    stability: "default"
  },
  "mcp.tool.shell": {
    ruleId: "mcp.tool.shell",
    severity: "high",
    title: "MCP server exposes shell-like tools",
    why: "Generic shell tools can turn prompt injection into command execution.",
    stability: "default"
  },
  "mcp.tool.raw-sql": {
    ruleId: "mcp.tool.raw-sql",
    severity: "high",
    title: "MCP server exposes database or raw SQL capability",
    why: "Raw SQL tools can read or mutate production data if over-scoped.",
    stability: "default"
  },
  "mcp.tool.missing-side-effect-classification": {
    ruleId: "mcp.tool.missing-side-effect-classification",
    severity: "medium",
    title: "MCP tool lacks side-effect classification",
    why: "Tool policies need explicit read, write, shell, network, database, or unknown side-effect classes.",
    stability: "experimental"
  },
  "mcp.tool.missing-policy-boundary": {
    ruleId: "mcp.tool.missing-policy-boundary",
    severity: "high",
    title: "High-risk MCP tool lacks policy boundary",
    why: "Shell, filesystem-write, database, network, and unknown tools need visible allow/deny boundaries.",
    stability: "experimental"
  },
  "mcp.tool.missing-scope": {
    ruleId: "mcp.tool.missing-scope",
    severity: "high",
    title: "High-risk MCP tool lacks allowlist or scope",
    why: "Shell, filesystem, and database tools should be constrained to explicit commands, paths, queries, or credentials.",
    stability: "experimental"
  },
  "mcp.config.loose-permissions": {
    ruleId: "mcp.config.loose-permissions",
    severity: "low",
    title: "MCP config file is readable by group or other users",
    why: "Secret-bearing configs should not be group/world-readable.",
    stability: "default"
  },
  "pr-risk.sensitive-surface": {
    ruleId: "pr-risk.sensitive-surface",
    severity: "medium",
    title: "Review first sensitive PR surface",
    why: "AI-generated PRs often bury trust-boundary changes inside larger diffs.",
    stability: "experimental"
  },
  "pr-risk.trust-boundary-missing-spec": {
    ruleId: "pr-risk.trust-boundary-missing-spec",
    severity: "medium",
    title: "Trust-boundary PR lacks nearby spec context",
    why: "AI-generated PRs can change auth, billing, data access, deploy, or tool decisions without explaining the rationale.",
    stability: "experimental"
  },
  "pr-risk.diff-unavailable": {
    ruleId: "pr-risk.diff-unavailable",
    severity: "info",
    title: "Git diff could not be read",
    why: "PR classification can be misleading when the requested base ref or Git history is unavailable.",
    stability: "default"
  },
  "pr-risk.no-diff": {
    ruleId: "pr-risk.no-diff",
    severity: "info",
    title: "No git diff found",
    why: "PR classification needs a diff to identify changed trust boundaries.",
    stability: "default"
  }
};

export function getRuleMetadata(ruleId: string): RuleMetadata | undefined {
  return RULE_CATALOG[ruleId];
}
