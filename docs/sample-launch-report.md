# Sample Launch Report

This is a synthetic, public-safe example of the kind of review queue `ai-saas-guard` produces. Paths, snippets, and checks are intentionally small so a founder or reviewer can understand the output before running the tool.

```text
Launch Gate: review before launch
6 findings: 3 high, 3 medium

HIGH stripe.webhook.missing-signature
Rule: stripe.webhook.missing-signature
File: app/api/stripe/webhook/route.ts:12
Why: Billing access can be granted from a webhook path that does not verify Stripe signatures.
Verify: Replay a webhook with an invalid signature and confirm the route rejects it.
Fix direction: Read the raw body, call stripe.webhooks.constructEvent, and keep entitlement changes idempotent.

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
Fix direction: Add tenant or membership predicates and rerun a two-account staging check.

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
Fix direction: Log the failure, return an explicit error status, and avoid granting access after the failed dependency.
```

## How To Read It

Start with the highest severity findings that touch trust-boundary code: auth, billing, tenant data, webhooks, and scheduled jobs. Each finding should give you enough to answer three launch questions:

- What file should I inspect first?
- Why could this fail for real users?
- What manual proof shows the path fails closed?

The report is a focused review queue. It does not replace your two-account authorization tests, Stripe webhook replay, deploy-preview checks, or human review.
