# Demo Quickstart

Use these public fixtures when you want to understand `ai-saas-guard` before pointing it at a private repository.

## Risky Demo

```bash
node dist/cli.js scan --root examples/demo-risky-saas
```

The risky demo intentionally includes unsigned Stripe webhook handling, a silent-success billing fallback, broad Supabase RLS, and overpowered GitHub Actions permissions.

With the published package:

```bash
npx ai-saas-guard@latest scan --root examples/demo-risky-saas
```

## Safe Demo

```bash
node dist/cli.js scan --root examples/demo-safe-saas
```

The safe demo keeps the same broad surfaces but uses safer static patterns: Stripe signature verification and idempotency hints, scoped RLS, security headers, documented env variables, request IDs, and bounded GitHub Actions permissions.

## What To Look For

- Every finding has a rule ID, severity, file evidence, why it matters, a manual verification step, and a fix direction.
- The risky demo is intentionally noisy enough to show the report shape.
- The safe demo is intentionally small; it is not a complete SaaS template and does not certify a real app.

Do not paste real API keys, customer data, private source code, webhook secrets, or production URLs into public issues when sharing output.
