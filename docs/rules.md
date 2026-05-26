# Rule Map

`ai-saas-guard` rules are deterministic heuristics. They are designed to produce a focused verification queue, not a complete vulnerability list.

Rule metadata is centralized in `src/rules/catalog.ts` and covered by tests so SARIF output, public docs, and config work can share stable rule IDs, default severities, and stability labels.

## Stability Labels

Stability labels describe how much confidence reviewers should place in a finding before manual verification. They are not severity levels.

| Stability | Meaning | Examples |
| --- | --- | --- |
| Strict | High-confidence evidence that should rarely be suppressed without a written reason. | Committed secret-like values, public Stripe secrets, unsigned Stripe webhooks, broad Supabase RLS policies. |
| Default | Routine launch-readiness heuristic with useful evidence and an expected manual verification step. | Missing Stripe lifecycle events, weak Supabase ownership checks, MCP side-effect inventory. |
| Experimental | Higher-noise heuristic meant to prioritize review, not prove a defect. | API ownership hints, rate-limit hints, missing env docs, PR risk triage. |

SARIF output includes the rule stability in `properties["ai-saas-guard/stability"]` and a `stability:<level>` tag for code scanning consumers.

## Suppressing False Positives

Prefer fixing risky code over suppressing findings. When a finding is a reviewed false positive for a specific generated file, fixture, or documented launch exception, use path-specific `suppressions` in `.ai-saas-guard.json` instead of disabling the whole rule:

```json
{
  "suppressions": [
    {
      "ruleId": "stripe.webhook.missing-idempotency",
      "paths": ["app/api/stripe/webhook/route.ts"],
      "reason": "Temporary exception; duplicate-event behavior is covered by integration tests."
    }
  ]
}
```

`paths` are relative globs. Examples: `generated/**`, `tests/fixtures/**`, and `app/api/stripe/webhook/route.ts`.

## Secrets And Public Env

| Rule ID | Severity | Why it exists |
| --- | --- | --- |
| `secrets.detected` | critical/high | Finds secret-like values committed to source, config, or examples. |
| `next.env.public-secret` | high | Flags `NEXT_PUBLIC_*` values that look secret-bearing or are named like secrets. |

## Stripe

| Rule ID | Severity | Why it exists |
| --- | --- | --- |
| `stripe.webhook.missing-route` | medium | Stripe apps should not rely only on checkout redirects for entitlement state. |
| `stripe.webhook.missing-signature` | critical | Unsigned webhook handlers can accept forged billing events. |
| `stripe.webhook.raw-body-risk` | high | Stripe signature verification requires the raw request body. |
| `stripe.webhook.public-secret` | critical | Stripe secrets must not use `NEXT_PUBLIC_*`. |
| `stripe.webhook.missing-idempotency` | high | Stripe retries and duplicate events can drift billing state. |
| `stripe.webhook.no-entitlement-path` | medium | Returning HTTP 200 is not the same as changing app access state. |
| `stripe.webhook.missing-critical-event` | high/medium | Failure, payment-action, cancellation, update, and refund paths need explicit handling. |

## Supabase

| Rule ID | Severity | Why it exists |
| --- | --- | --- |
| `supabase.rls.broad-policy` | critical | `USING (true)` or `WITH CHECK (true)` can turn login into broad data access or writes. |
| `supabase.rls.enabled-no-policy` | high | RLS with no policies often looks like silent empty results instead of an explainable launch failure. |
| `supabase.rls.missing-ownership-filter` | high | Policies need resource ownership or tenant membership checks. |
| `supabase.rls.public-write-policy` | high | Public write policies can expose inserts or mutations when predicates are incomplete. |
| `supabase.rls.tenant-predicate-missing` | high | Multi-tenant SaaS tables need tenant, workspace, organization, owner, or membership predicates. |
| `supabase.rls.uid-column-mismatch` | medium | `auth.uid()` is a UUID; comparing it to text/email/name columns commonly causes silent policy failures. |
| `supabase.rls.weak-with-check` | high | Write policies need `WITH CHECK` predicates tied to the current user or tenant membership. |
| `supabase.rls.write-policy-missing` | medium | Reads can work while inserts, updates, or deletes silently fail when write policies are missing. |
| `supabase.table.missing-owner-column` | medium | Sensitive tables are hard to protect without owner/tenant keys. |
| `supabase.rls.not-enabled` | critical | User-data tables should enable row level security. |
| `supabase.storage.public-bucket` | high | Storage buckets or unscoped storage object policies can leak files even when database rows are protected. |

`check-supabase --doctor` keeps this static and local. It adds a doctor section with two-account/cross-tenant verification steps and SQL cookbook prompts for staging databases. It does not connect to Supabase or inspect production state.

Supabase RLS checks require Supabase context, such as Supabase paths, dependencies, policy syntax, `auth.uid()`, storage policies, or row-level-security statements. Generic SQLite or Express SQL schemas should not trigger Supabase RLS findings only because a table is named `users` or `subscriptions`.

## Silent Success

| Rule ID | Severity | Why it exists |
| --- | --- | --- |
| `silent-success.swallowed-error` | high | Swallowed provider, auth, billing, or data errors can make a launch path look successful when it failed. |
| `silent-success.production-mock-data` | medium | Fixtures and demo responses in sensitive paths can make AI-built integrations look complete before they are real. |
| `silent-success.hardcoded-fallback` | high | Hardcoded success fallbacks in auth, billing, AI, or data paths can grant access or hide broken integrations. |
| `silent-success.weakened-test` | medium | Skipped, TODO-only, empty, or truthy-only tests create fake confidence in AI-generated code. |
| `silent-success.temporary-bypass` | high | Temporary bypasses around auth, validation, webhook verification, rate limits, or ownership are common launch blockers. |

## API Routes And Deploy

| Rule ID | Severity | Why it exists |
| --- | --- | --- |
| `api.route.missing-rate-limit` | medium | Login, checkout, upload, AI, and webhook routes are common abuse targets. |
| `api.route.auth-without-ownership` | high | Login checks do not prove resource ownership checks. |
| `api.route.provider-debug-exposed` | high | Public provider token/configuration probe endpoints can spend quota, reveal integration state, or exercise server credentials without returning the token. |
| `auth.clerk.unsafe-metadata` | high | Clerk unsafe metadata is user-writable and should not hold roles, plans, tenant membership, or entitlements. |
| `data.prisma.tenant-scope-missing` | high | Authenticated Prisma reads or mutations on tenant-like resources need tenant, owner, organization, or workspace predicates. |
| `deploy.next.static-export-api-risk` | medium | Static export can conflict with runtime API assumptions. |
| `deploy.edge-runtime-node-api` | medium | Edge runtime can break Node-only dependencies. |
| `deploy.env.example-missing` | low | Missing env docs cause local-success, production-failure deploys. |
| `deploy.next.missing-security-headers` | medium | Apps with auth, payment, and API routes should launch with explicit browser security headers. |
| `deploy.env.server-undocumented` | low | Undocumented server env vars cause local-success, production-failure deploys. |
| `deploy.env.public-inventory` | info | `NEXT_PUBLIC_*` variables are browser-visible and should be reviewed as public config. |
| `deploy.next.image-cost-risk` | medium | Broad remote image patterns or user-controlled image sources can amplify deploy cost and trust risk. |
| `deploy.next.request-amplification` | low | High-cardinality dynamic route prefetching can create unexpected production request volume. |
| `deploy.observability.missing-request-id` | low | Billing, webhook, and tenant incidents are hard to debug without traceable request IDs. |
| `deploy.vercel.cron-missing-guard` | medium | Scheduled billing, tenant, or cleanup jobs need a secret guard, idempotency, and request tracing before launch. |

## MCP

| Rule ID | Severity | Why it exists |
| --- | --- | --- |
| `mcp.config.invalid-json` | medium | Broken MCP configs hide the actual tool inventory. |
| `mcp.config.plaintext-secret` | high | Prompt/tool logs can expose plaintext credentials. |
| `mcp.config.non-local-bind` | high | Broad bind addresses can expose local tools to the network. |
| `mcp.config.insecure-http` | medium | Plain HTTP can expose tool calls and credentials outside localhost. |
| `mcp.config.broad-filesystem` | high | Write access over broad paths increases prompt-injection blast radius. |
| `mcp.tool.shell` | high | Generic shell tools can turn prompt injection into command execution. |
| `mcp.tool.raw-sql` | high | Raw SQL tools can read or mutate production data if over-scoped. |
| `mcp.tool.missing-side-effect-classification` | medium | Tool policies need explicit read, write, shell, network, database, or unknown side-effect classes. |
| `mcp.tool.missing-policy-boundary` | high | Shell, filesystem-write, database, network, and unknown tools need visible allow/deny boundaries. |
| `mcp.tool.missing-scope` | high | Shell, filesystem, and database tools should be constrained to explicit commands, paths, queries, or credentials. |
| `mcp.config.loose-permissions` | low | Secret-bearing configs should not be group/world-readable. |

`check-mcp --policy-template` emits a local policy skeleton and receipt field list. The receipt format is meant to make future tool-call decisions auditable: server/tool identity, normalized argument digest, side-effect class, redaction status, decision, reason, and replay determinism note. It is not a runtime firewall.

## GitHub Actions

| Rule ID | Severity | Why it exists |
| --- | --- | --- |
| `actions.permissions.too-broad` | medium | Launch preflight workflows usually need read access, not broad repository mutation privileges. |
| `actions.pr-missing-concurrency` | low | AI-assisted PRs can push many commits quickly, making stale CI runs wasteful and confusing. |
| `actions.docs-only-full-ci` | low | AI-assisted docs edits should not always spend the same launch-readiness CI budget as code changes. |
| `actions.secrets-missing-failfast` | medium | Deploy or integration workflows should fail clearly when required secrets or tools are missing. |
| `actions.checkout.fetch-depth` | medium | `pr-risk --base` needs enough Git history to compare trust-boundary changes reliably. |
| `actions.unpinned-action` | info | Pinned actions make launch-preflight workflows more reproducible. |

These checks are intentionally small and launch-readiness-focused. They do not try to replace actionlint, zizmor, Scorecard, or CI analytics.

## Rule-Quality Notes From Private Pilot Feedback

Use sanitized private pilot feedback to improve rule quality, not to claim public beta readiness. The current regression suite includes synthetic coverage for these feedback categories:

- generic SQL schemas without Supabase context should not trigger Supabase RLS rules
- admin-guarded routes and `req.userId`-scoped routes should avoid generic ownership false positives
- public provider token/configuration probe endpoints should be reviewed or removed before launch
- obvious example placeholders and known test tokens should not be treated as leaked credentials

## PR Risk

| Rule ID | Severity | Why it exists |
| --- | --- | --- |
| `pr-risk.sensitive-surface` | medium/high | Highlights files reviewers should inspect before cosmetic or refactor files. |
| `pr-risk.trust-boundary-missing-spec` | low/medium | AI-generated PRs can change auth, billing, data access, deploy, or tool decisions without explaining the rationale. |
| `pr-risk.diff-unavailable` | info | Explains when the requested base ref or Git history prevents PR diff classification. |
| `pr-risk.no-diff` | info | Explains that PR classification needs a diff. |

## Adding Rules

Prefer rules that meet all of these conditions:

- tied to a repeated launch failure mode
- evidence can be shown with file/line/snippet
- verification can be written as a concrete manual or CLI step
- false positives are understandable from the finding text

Avoid broad claims like "detects all vulnerabilities" or rules that only produce generic advice.
