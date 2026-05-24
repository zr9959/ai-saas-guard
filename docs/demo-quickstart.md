# Demo Quickstart

Use these public fixtures when you want to understand `ai-saas-guard` before pointing it at a private repository.

## Fastest Path

Run the packaged demo without cloning this repository:

```bash
npx ai-saas-guard@latest demo --summary
```

This prints the risky and safe demo summaries, the top risky files to review, manual verification steps, and launch-focused next steps. It uses only public fixture code shipped in the npm package. Rerun `npx ai-saas-guard@latest demo` without `--summary` for the full human-readable report.

## Risky Demo

Clone the repository only if you want to inspect or edit the fixture files:

```bash
git clone https://github.com/zr9959/ai-saas-guard.git
cd ai-saas-guard
npx ai-saas-guard@latest scan --root examples/demo-risky-saas
npx ai-saas-guard@latest scan --root examples/demo-risky-saas --summary
```

The risky demo intentionally includes unsigned Stripe webhook handling, a silent-success billing fallback, broad Supabase RLS, and overpowered GitHub Actions permissions.

Expected summary:

```text
19 findings: 2 critical, 6 high, 7 medium, 3 low, 1 info
```

The first findings should point at trust-boundary files such as:

- `app/api/stripe/webhook/route.ts` for missing Stripe signature verification and idempotency
- `supabase/migrations/001_accounts.sql` for broad RLS and missing tenant predicates
- `app/api/billing/checkout/route.ts` for a silent-success billing fallback
- `.github/workflows/ci.yml` for launch-related workflow hygiene hints

For local development from this repository checkout:

```bash
npm ci
npm run build
node dist/cli.js scan --root examples/demo-risky-saas
```

## Safe Demo

```bash
npx ai-saas-guard@latest scan --root examples/demo-safe-saas
npx ai-saas-guard@latest scan --root examples/demo-safe-saas --summary
```

The safe demo keeps the same broad surfaces but uses safer static patterns: Stripe signature verification and idempotency hints, scoped RLS, security headers, documented env variables, request IDs, and bounded GitHub Actions permissions.

Expected summary:

```text
0 findings
```

For local development from this repository checkout:

```bash
node dist/cli.js scan --root examples/demo-safe-saas
```

## What To Look For

- Every finding has a rule ID, severity, file evidence, why it matters, a manual verification step, and a fix direction.
- The risky demo is intentionally noisy enough to show the report shape.
- The safe demo is intentionally small; it is not a complete SaaS template and does not certify a real app.

Do not paste real API keys, customer data, private source code, webhook secrets, or production URLs into public issues when sharing output.
