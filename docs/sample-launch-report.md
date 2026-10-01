# Sample Launch Report

This synthetic, public-safe example shows the review queue produced by `ai-saas-guard`. The paths and findings are intentionally small enough to inspect before running the tool.

## Summary Output

```text
ai-saas-guard | SCAN SUMMARY
----------------------------------------
Target       /path/to/your-saas
Launch gate  review required: high-risk launch paths need manual verification before launch
Findings     6 findings | 0 critical | 3 high | 3 medium | 0 low | 0 info
Decision     Can a real user get access they should not have? Review auth, tenant ownership, Supabase RLS, webhook entitlement, and data mutation findings first.

TOP RISKS
1. HIGH stripe.webhook.missing-signature at app/api/stripe/webhook/route.ts:12 - Stripe webhook does not verify the Stripe signature
2. HIGH auth.clerk.unsafe-metadata at app/api/auth/profile/route.ts:8 - Clerk unsafe metadata is used as authorization input
3. HIGH data.prisma.tenant-scope-missing at app/api/projects/[projectId]/route.ts:9 - Prisma query lacks an obvious tenant or owner predicate

MANUAL PROOF
1. Replay a webhook with an invalid signature and confirm the route rejects it.
2. Try changing the same metadata as a normal signed-in user and confirm it cannot grant admin, paid plan, tenant, workspace, or entitlement access.
3. Create this resource as Tenant/User A, then attempt the same update with Tenant/User B.

NEXT STEPS
1. Fix critical and high trust-boundary findings first: auth/session, billing/webhook, tenant data, and silent-success paths.
2. Run the manual proof steps above in staging and confirm each risky path fails closed.

FULL REPORT
  Rerun without --summary, or use --json, --sarif, or --markdown where supported.
```

Markdown output adds the launch decision queue, ranking explanation, trust statement, and PR reviewer checklist. The full terminal report expands each item into a consistent scan card:

```text
[1/6] HIGH | Stripe webhook does not verify the Stripe signature
  Rule      stripe.webhook.missing-signature
  Location  app/api/stripe/webhook/route.ts:12
  Why       Billing access can be granted from a webhook path that does not verify Stripe signatures.
  Verify    Replay a webhook with an invalid signature and confirm the route rejects it.
  Fix       Read the raw body, verify the stripe-signature header, and reject invalid events before changing entitlement state.
  Evidence
    - app/api/stripe/webhook/route.ts:12 -> const event = await request.json();

[2/6] HIGH | Clerk unsafe metadata is used as authorization input
  Rule      auth.clerk.unsafe-metadata
  Location  app/api/auth/profile/route.ts:8
  Why       Client-writable metadata can accidentally become authorization input for roles, plans, tenants, or entitlements.
  Verify    Change the metadata as a normal user and confirm it cannot grant privileged access.
  Fix       Store authorization and billing state in server-controlled metadata or the application database.
  Evidence
    - app/api/auth/profile/route.ts:8 -> const role = user.unsafeMetadata.role;

[3/6] HIGH | Prisma query lacks an obvious tenant or owner predicate
  Rule      data.prisma.tenant-scope-missing
  Location  app/api/projects/[projectId]/route.ts:9
  Why       Authentication alone does not stop a caller from guessing another tenant's resource ID.
  Verify    Create the resource as User A, then attempt the same read, update, and delete as User B.
  Fix       Add tenant, organization, workspace, owner, user, or membership predicates to the Prisma where clause.
  Evidence
    - app/api/projects/[projectId]/route.ts:9 -> where: { id: projectId }

[4/6] MEDIUM | Supabase policy lacks an obvious tenant predicate
  Rule      supabase.rls.tenant-predicate-missing
  Location  supabase/migrations/20260524_projects.sql:22
  Why       Multi-tenant rows need owner or membership predicates for every allowed operation.
  Verify    Confirm User B cannot SELECT, INSERT, UPDATE, or DELETE User A rows.
  Fix       Scope USING and WITH CHECK to tenant membership or ownership.
  Evidence
    - supabase/migrations/20260524_projects.sql:22 -> create policy projects_access on projects

[5/6] MEDIUM | Vercel cron route lacks an obvious guard
  Rule      deploy.vercel.cron-missing-guard
  Location  app/api/cron/reconcile-billing/route.ts:3
  Why       Stateful scheduled jobs need authorization, idempotency, and request tracing.
  Verify    Call the route without the cron secret and replay one request ID; confirm both cases fail safely.
  Fix       Validate a server-only secret, use a run lock or idempotency key, and log a request ID.
  Evidence
    - app/api/cron/reconcile-billing/route.ts:3 -> export async function GET() {

[6/6] MEDIUM | Provider failure may be swallowed
  Rule      silent-success.swallowed-error
  Location  app/api/billing/checkout/route.ts:31
  Why       Swallowed billing or data errors can make a failed launch path look successful.
  Verify    Force the provider call to fail and confirm the route returns an explicit error or disclosed degraded mode.
  Fix       Log a request ID, return a 4xx/5xx response, and avoid entitlement or tenant mutations after the failure.
  Evidence
    - app/api/billing/checkout/route.ts:31 -> catch { return Response.json({ ok: true }); }
```

Start with auth, billing, tenant data, webhooks, and stateful jobs. For each item, inspect the named file, understand the real-user failure, and run the listed proof until the path fails closed.
