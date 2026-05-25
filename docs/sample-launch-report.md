# Sample Launch Report

This is a synthetic, public-safe example of the kind of review queue `ai-saas-guard` produces. Paths, snippets, and checks are intentionally small so a founder or reviewer can understand the output before running the tool.

```text
ai-saas-guard scan summary
Findings: 6 findings: 0 critical, 3 high, 3 medium, 0 low, 0 info
Launch gate: review required: high-risk launch paths need manual verification before launch
Decision queue: Can a real user get access they should not have? Review auth, tenant ownership, Supabase RLS, webhook entitlement, and data mutation findings first.
Review trust-boundary findings before deploy/cost hygiene.

Top risks:
- HIGH stripe.webhook.missing-signature at app/api/stripe/webhook/route.ts:12 - Stripe webhook does not verify the Stripe signature
- HIGH auth.clerk.unsafe-metadata at app/api/auth/profile/route.ts:8 - Clerk unsafe metadata is used as authorization input
- HIGH data.prisma.tenant-scope-missing at app/api/projects/[projectId]/route.ts:9 - Prisma query lacks an obvious tenant or owner predicate

Manual proof to run next:
- Replay a webhook with an invalid signature and confirm the route rejects it.
- Try changing the same metadata as a normal signed-in user and confirm it cannot grant admin, paid plan, tenant, workspace, or entitlement access.
- Create this resource as Tenant/User A, then attempt the same update with Tenant/User B.

Next steps
- Fix critical and high trust-boundary findings first: auth/session, billing/webhook, tenant data, and silent-success paths.
- Run the manual proof steps above in staging and confirm each risky path fails closed.

Full report:
  Rerun without --summary, or use --json, --sarif, or --markdown where supported.
```

Markdown reports include the same decision queue plus:

- why auth, billing, tenant data, RLS, webhooks, and silent-success findings rank first
- a trust statement: local-first, deterministic, read-only, no code upload, no LLM calls
- a reviewer checklist for PR risk output

The full terminal report expands each finding:

```text
6 findings: 3 high, 3 medium

HIGH stripe.webhook.missing-signature
Rule: stripe.webhook.missing-signature
File: app/api/stripe/webhook/route.ts:12
Why: Billing access can be granted from a webhook path that does not verify Stripe signatures.
Verify: Replay a webhook with an invalid signature and confirm the route rejects it.
Fix direction: In Next.js route handlers, read the payload with `await req.text()`, read the `stripe-signature` header, call `stripe.webhooks.constructEvent(body, signature, STRIPE_WEBHOOK_SECRET)`, and return 400 before any entitlement mutation when verification fails.

HIGH auth.clerk.unsafe-metadata
Rule: auth.clerk.unsafe-metadata
File: app/api/auth/profile/route.ts:8
Why: Clerk unsafe metadata can be changed from the client side, so roles, paid plans, tenant membership, or entitlements stored there can become authorization input by accident.
Verify: Try changing the same metadata as a normal signed-in user and confirm it cannot grant admin, paid plan, tenant, workspace, or entitlement access.
Fix direction: Store authorization and billing state in server-controlled Clerk private/public metadata or your database.

HIGH data.prisma.tenant-scope-missing
Rule: data.prisma.tenant-scope-missing
File: app/api/projects/[projectId]/route.ts:9
Why: A route can authenticate the caller but still read or mutate another tenant's resource when Prisma queries only scope by a guessed resource ID.
Verify: Create this resource as Tenant/User A, then attempt the same update with Tenant/User B.
Fix direction: Add tenant, organization, workspace, owner, user, or membership predicates to the Prisma where clause.

MEDIUM supabase.rls.tenant-predicate-missing
Rule: supabase.rls.tenant-predicate-missing
File: supabase/migrations/20260524_projects.sql:22
Why: Multi-tenant tables need tenant, workspace, organization, owner, or membership predicates.
Verify: Sign in as user A and user B; confirm neither can SELECT, INSERT, UPDATE, or DELETE the other's rows.
Fix direction: Tie every policy to tenant/workspace/organization membership or owner columns, and mirror the same tenant scope in `WITH CHECK` for INSERT and UPDATE.

MEDIUM deploy.vercel.cron-missing-guard
Rule: deploy.vercel.cron-missing-guard
File: app/api/cron/reconcile-billing/route.ts:3
Why: Scheduled billing, tenant, or cleanup jobs need a secret guard, idempotency, and request tracing before launch.
Verify: Call the cron route without the expected cron secret and with a repeated request ID; confirm unauthorized calls fail and repeated runs do not duplicate state changes.
Fix direction: Check a server-only cron secret, record an idempotency key or run lock, and log a request/trace ID before stateful cron work starts.

MEDIUM silent-success.swallowed-error
Rule: silent-success.swallowed-error
File: app/api/billing/checkout/route.ts:31
Why: Swallowed provider, auth, billing, or data errors can make a launch path look successful when it failed.
Verify: Force the upstream provider call to fail and confirm the route returns an error or disclosed degraded mode.
Fix direction: Log the failure with a request id, return a 4xx/5xx error or explicit degraded-mode response, and do not grant entitlement, change ownership, or mutate tenant data after the failed dependency.

Next steps
- Fix critical and high trust-boundary findings first: auth/session, billing/webhook, tenant data, and silent-success paths.
- Run the manual proof steps above in staging and confirm each risky path fails closed.
- Treat low and info deploy/CI hygiene hints as cleanup after critical, high, and medium launch paths are understood.
```

## How To Read It

Start with the highest severity findings that touch trust-boundary code: auth, billing, tenant data, webhooks, and scheduled jobs. Each finding should give you enough to answer three launch questions:

- What file should I inspect first?
- Why could this fail for real users?
- What manual proof shows the path fails closed?

The report is a focused launch decision queue. It does not replace your two-account authorization tests, Stripe webhook replay, deploy-preview checks, or human review.
