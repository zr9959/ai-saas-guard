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
| `supabase.rls.missing-ownership-filter` | high | Policies need resource ownership or tenant membership checks. |
| `supabase.rls.weak-with-check` | high | Write policies need `WITH CHECK` predicates tied to the current user or tenant membership. |
| `supabase.table.missing-owner-column` | medium | Sensitive tables are hard to protect without owner/tenant keys. |
| `supabase.rls.not-enabled` | critical | User-data tables should enable row level security. |
| `supabase.storage.public-bucket` | high | Storage buckets or unscoped storage object policies can leak files even when database rows are protected. |

## API Routes And Deploy

| Rule ID | Severity | Why it exists |
| --- | --- | --- |
| `api.route.missing-rate-limit` | medium | Login, checkout, upload, AI, and webhook routes are common abuse targets. |
| `api.route.auth-without-ownership` | high | Login checks do not prove resource ownership checks. |
| `deploy.next.static-export-api-risk` | medium | Static export can conflict with runtime API assumptions. |
| `deploy.edge-runtime-node-api` | medium | Edge runtime can break Node-only dependencies. |
| `deploy.env.example-missing` | low | Missing env docs cause local-success, production-failure deploys. |

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
| `mcp.config.loose-permissions` | low | Secret-bearing configs should not be group/world-readable. |

## PR Risk

| Rule ID | Severity | Why it exists |
| --- | --- | --- |
| `pr-risk.sensitive-surface` | medium/high | Highlights files reviewers should inspect before cosmetic or refactor files. |
| `pr-risk.diff-unavailable` | info | Explains when the requested base ref or Git history prevents PR diff classification. |
| `pr-risk.no-diff` | info | Explains that PR classification needs a diff. |

## Adding Rules

Prefer rules that meet all of these conditions:

- tied to a repeated launch failure mode
- evidence can be shown with file/line/snippet
- verification can be written as a concrete manual or CLI step
- false positives are understandable from the finding text

Avoid broad claims like "detects all vulnerabilities" or rules that only produce generic advice.
