# Sample ai-saas-guard Report

This example shows the intended tone and structure for terminal, PR, and future GitHub Action output.

```text
ai-saas-guard scan
Root: /repo
Findings: 4 total | critical 1 | high 2 | medium 1 | low 0 | info 0

1. [CRITICAL] Stripe webhook does not verify the Stripe signature
   Rule: stripe.webhook.missing-signature
   Why: Without `stripe.webhooks.constructEvent` and the `stripe-signature` header, attackers can forge billing events that grant or revoke access.
   Verify: Send a request without a valid Stripe signature and confirm the handler rejects it before changing entitlement state.
   Fix direction: Read the raw request body, call `stripe.webhooks.constructEvent(body, signature, STRIPE_WEBHOOK_SECRET)`, and reject invalid signatures.
   Evidence:
   - app/api/stripe/webhook/route.ts:1 -> export async function POST(req: Request) {

2. [HIGH] Supabase policy on public.projects lacks an obvious ownership filter
   Rule: supabase.rls.missing-ownership-filter
   Why: Founders often confuse authentication with authorization; table policies need resource-level ownership checks.
   Verify: Create the same resource as User A and attempt to read, update, and delete it with User B's session.
   Fix direction: Reference `auth.uid()` and a stable ownership or membership column in every sensitive table policy.
   Evidence:
   - supabase/migrations/001_projects.sql:7 -> create policy "public projects"
```

Reports should stay evidence-first and avoid claiming a project is secure. The right conclusion is a prioritized verification queue, not a pass/fail security certification.

## PR Risk Example

```text
ai-saas-guard pr-risk
Root: /repo
Findings: 3 total | critical 0 | high 1 | medium 2 | low 0 | info 0

1. [HIGH] Review first: app/api/stripe/webhook/route.ts
   Rule: pr-risk.sensitive-surface
   Why: AI-generated PRs often bury trust-boundary changes inside larger diffs; this file touches sensitive surfaces.
   Verify: Review this file for billing/subscription, API contract and confirm tests cover the changed behavior.
   Fix direction: Split unrelated UI/refactor work away from trust-boundary changes and add focused tests before merge.
```
