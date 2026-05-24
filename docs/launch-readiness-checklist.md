# Launch Readiness Checklist

Use this checklist when an AI-built SaaS app is close to launch, a founder is about to invite real users, or a reviewer needs a practical pre-merge review path.

This is not a full security audit, penetration test, compliance review, or proof that the app is secure. It is a founder-readable launch preflight that combines `ai-saas-guard` findings with manual verification for the most common SaaS launch blockers.

## Start With The Local Preflight

Run from the app repository:

```bash
npx ai-saas-guard@latest scan --root .
npx ai-saas-guard@latest pr-risk --root . --base origin/main
npx ai-saas-guard@latest check-supabase --root . --doctor
npx ai-saas-guard@latest check-stripe --root .
npx ai-saas-guard@latest check-mcp --root . --policy-template
npx ai-saas-guard@latest check-actions --root .
```

Treat every finding as a review queue item. The tool is read-only and local-first, so it can show where to inspect, but it cannot confirm production settings, account ownership, live Stripe dashboard state, or every possible authorization path.

## Launch Blocker Rules

Use these labels while reviewing:

| Level | Meaning | Examples |
| --- | --- | --- |
| Launch blocker | Do not ship until fixed or explicitly disabled for the product. | Any user can read another tenant's data, unsigned Stripe webhooks grant access, real secrets are committed. |
| Must verify | Shipping may be reasonable only after a named manual test passes. | Rate limits, billing lifecycle handling, storage object scope, rollback path. |
| Follow-up | Track after launch when the current product risk is bounded. | Extra docs, sharper false-positive suppression, non-critical workflow polish. |

If a finding affects auth, billing, user data, secrets, file storage, production deploy config, or MCP tools with side effects, assume it is at least "must verify" until a human has tested the exact path.

## Two-Account Authorization Testing

Two-account authorization testing is the fastest manual check for broken SaaS isolation.

Prepare two ordinary test accounts:

- User A in organization or workspace A.
- User B in organization or workspace B.
- At least one private object owned by each account or workspace: project, document, invoice, file, message, API key, or team member.

Verify read isolation:

- Log in as User A and open User A's private objects.
- Try to load User B's object by changing route parameters, object IDs, slugs, search filters, API URLs, and browser history entries.
- Repeat the same checks through direct API calls if the app exposes JSON routes.
- Confirm User A receives a 403 or 404 and no object metadata leaks in the response.

Verify write isolation:

- As User A, try to update, delete, invite users to, export, or share User B's objects by tampering with IDs.
- Confirm the server rejects the request, not only the UI.
- Confirm no partial write, audit entry, billing change, storage object, notification, or background job was created.

Verify tenant switching:

- If a user can belong to multiple workspaces, switch active workspaces and repeat the same read/write checks.
- Confirm server-side ownership checks use the selected tenant membership, not only a client-side workspace ID.

For Supabase apps, compare these manual checks with row-level security policy evidence from `check-supabase`. RLS should protect sensitive tables even when a route, query builder, or generated client code is wrong.

## Stripe Webhook Verification

Stripe webhook verification is required for subscription or credit products because checkout redirects are not billing truth.

Minimum checks:

- The webhook route reads the raw request body.
- The handler verifies the `Stripe-Signature` header with the server-only webhook secret before any database write.
- The signing secret is never exposed through `NEXT_PUBLIC_*`, client bundles, public logs, issue comments, or screenshots.
- The handler stores or dedupes `event.id`.
- Entitlement state is updated from Stripe webhook reconciliation, not only from checkout success pages.

Replay the critical billing paths with the companion cookbook:

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
stripe trigger checkout.session.completed
stripe trigger invoice.payment_failed
stripe trigger customer.subscription.updated
stripe trigger customer.subscription.deleted
stripe trigger charge.refunded
```

Expected evidence:

- Checkout success grants the right user or tenant access only after signature verification.
- Failed invoice creates the intended past-due or grace state.
- Subscription updates reconcile plan, quantity, status, cancellation, and period fields.
- Cancellation revokes or downgrades paid access.
- Refund handling is explicit, even if the product requires manual review.
- Duplicate delivery of the same event ID is a no-op.
- Out-of-order events reconcile to one durable entitlement state.

See [stripe-webhook-replay.md](stripe-webhook-replay.md) for the full command cookbook.

## MCP Config Review

MCP config review matters because local tools can turn prompt injection into filesystem, shell, database, or network side effects.

Inventory every MCP server used by the app, agent, or development workflow:

- Config files such as `.mcp.json`, `.cursor/mcp.json`, `claude_desktop_config.json`, or tool-specific equivalents.
- Tool descriptions that expose shell commands, raw SQL, browser automation, filesystem writes, or deployment actions.
- Environment variables and credentials passed to MCP servers.
- Bind addresses and transport URLs.

Review questions:

- Does any MCP server bind to `0.0.0.0` or a non-localhost host?
- Does any tool allow broad filesystem read/write access outside the intended repository?
- Does any tool run arbitrary shell commands or raw SQL against production-like data?
- Are credentials stored in plaintext config files?
- Are secret-bearing config files group-readable or world-readable?
- Can the tool mutate billing, user access, customer data, or deploy state without a human approval step?

Launch blocker examples:

- A production database URL is stored in an MCP config.
- A broad filesystem tool can write outside the app repository.
- A shell or SQL tool is exposed to untrusted prompts without environment separation.

Use `check-mcp` findings as the starting inventory, then manually inspect any tool that can read secrets or change state.

Use `check-mcp --policy-template` when a repo has MCP tools that need a local allow/deny policy and tool-call receipt format before launch. The template is static and transparent; it is not a runtime firewall.

## Supabase And Storage

For Supabase apps, launch only after the data model has an ownership story.

Check:

- Sensitive tables have RLS enabled.
- Policies use `auth.uid()` or tenant membership checks tied to the row.
- Write policies use `WITH CHECK` so users cannot insert or move rows into another tenant.
- Storage buckets and `storage.objects` policies are scoped by owner, tenant, or object path.
- Service-role keys stay server-only and are not used in browser code.

Manual verification should still use the two-account flow above. Scanner findings can point to weak policies, but the actual product workflow determines whether access is correctly isolated.

Use `check-supabase --doctor` when RLS behavior is confusing. It outputs static debugging hints, two-account/cross-tenant verification steps, and a SQL cookbook prompt for staging. It does not connect to Supabase.

## Silent Success Checks

AI-generated code can make broken launch paths look green.

Check:

- Catch blocks in auth, billing, AI, Supabase, and mutation routes return visible errors or disclosed degraded mode.
- Production routes do not import fixtures, mocks, demo data, or sample responses.
- Stripe, Supabase, OpenAI, payment, and auth paths do not grant access from hardcoded fallback data.
- Tests are not skipped, TODO-only, empty, or truthy-only placeholders.
- Temporary bypasses for auth, rate limits, webhooks, validation, or ownership are removed before launch.

Manual verification: force the upstream provider, database, or auth call to fail and confirm the user sees a failure path, no entitlement is granted, and no cross-tenant mutation succeeds.

## Secrets, Env, And Deploy

Before launch:

- Rotate any real secret that was committed, pasted into a public issue, or printed in a public log.
- Confirm examples use inert placeholders, not real-looking provider tokens.
- Confirm `NEXT_PUBLIC_*` variables contain only values that are safe for browsers.
- Check `.env.example` or deploy docs include required production variables without revealing secret values.
- Confirm Vercel, Netlify, or other deploy settings match runtime expectations: API routes are not accidentally static, and Node-only libraries are not deployed to incompatible Edge runtimes.
- Confirm Next/Vercel security headers, request ID logging, image remote patterns, and high-cardinality route prefetch behavior are deliberate.

## CI And PR Review

Minimum repository workflow:

- CI runs tests on pull requests and pushes to the default branch.
- `ai-saas-guard pr-risk` runs with enough git history to compare against the base branch.
- SARIF or markdown output is used when reviewers need scan results in GitHub.
- Large AI-generated pull requests are split when they combine UI, auth, database, billing, and deploy changes.
- GitHub Actions use least-privilege permissions, cancel stale PR runs, avoid full CI for docs-only edits when possible, fail fast on missing secrets, and checkout enough history for `pr-risk`.

Review the first files named by `pr-risk` before reviewing cosmetic changes. If a base ref is missing, fix checkout depth or fetch history before trusting the PR risk result.

## Rollback And Incident Readiness

Before inviting real users, define:

- How to disable paid access changes without deleting customer data.
- How to revoke or rotate leaked keys.
- How to roll back a failed deployment.
- How to pause new signups or billing flows.
- Where webhook delivery failures, auth errors, and database policy denials are logged.
- Who decides whether a finding is a launch blocker or an accepted risk.

The goal is not a perfect process. The goal is that the founder can answer what happens when auth, billing, deploy, or data isolation fails on launch day.

## Founder Sign-Off

A launch-ready review should leave behind short evidence, not just a feeling.

Use this minimal sign-off:

| Area | Evidence to keep |
| --- | --- |
| CLI preflight | Command output or CI link for `scan` and focused checks |
| Two-account authorization | User A/User B notes with tested object types and rejected actions |
| Stripe | Webhook replay notes for success, failure, update, cancellation, refund, duplicate, and out-of-order paths |
| Supabase | RLS and storage policy review notes |
| MCP | Reviewed MCP config files and disabled or constrained risky tools |
| Secrets | Rotation notes or confirmation that only placeholders were found |
| Deploy | Production env and runtime checks |
| Rollback | Known rollback command or deploy platform rollback path |

If any row is blank for a product surface the app actually uses, treat it as a must-verify item before launch.
