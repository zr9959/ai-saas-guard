# Risky Demo SaaS

This is a tiny public fixture that intentionally contains common AI-built SaaS launch risks.

Run from the repository root:

```bash
node dist/cli.js scan --root examples/demo-risky-saas
```

Or with the published package:

```bash
npx ai-saas-guard@latest scan --root examples/demo-risky-saas
```

Expected themes:

- unsigned Stripe webhook handling
- silent-success billing fallback
- broad Supabase RLS policy
- over-broad GitHub Actions permissions
- stale PR workflow risk

This fixture uses inert placeholder code only. It does not contain real secrets, customer data, or production URLs.
