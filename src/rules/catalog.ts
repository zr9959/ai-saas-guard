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
  "secrets.detected": {
    ruleId: "secrets.detected",
    severity: "high",
    title: "Secret-like value detected",
    why: "Credentials committed to source, config, or examples can be exposed before launch.",
    stability: "default"
  },
  "next.env.public-secret": {
    ruleId: "next.env.public-secret",
    severity: "high",
    title: "Risky NEXT_PUBLIC environment variable",
    why: "Next.js exposes NEXT_PUBLIC variables to browser code, so secret-like values can leak to users.",
    stability: "default"
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
    stability: "default"
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
    stability: "default"
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
    stability: "default"
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
    why: "`USING (true)` often turns login into public data access.",
    stability: "default"
  },
  "supabase.rls.missing-ownership-filter": {
    ruleId: "supabase.rls.missing-ownership-filter",
    severity: "high",
    title: "Supabase policy lacks an ownership filter",
    why: "Policies need resource ownership or tenant membership checks.",
    stability: "default"
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
    stability: "default"
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
    stability: "default"
  },
  "api.route.auth-without-ownership": {
    ruleId: "api.route.auth-without-ownership",
    severity: "high",
    title: "API route checks auth but lacks an ownership guard",
    why: "Login checks do not prove resource ownership checks.",
    stability: "default"
  },
  "deploy.next.static-export-api-risk": {
    ruleId: "deploy.next.static-export-api-risk",
    severity: "medium",
    title: "Next static export may conflict with server routes",
    why: "Static export can conflict with runtime API assumptions.",
    stability: "default"
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
    stability: "default"
  },
  "mcp.config.invalid-json": {
    ruleId: "mcp.config.invalid-json",
    severity: "medium",
    title: "MCP config is not valid JSON",
    why: "Broken MCP configs hide the actual tool inventory.",
    stability: "default"
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
