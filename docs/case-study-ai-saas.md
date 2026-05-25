# AI SaaS Case Study Fixture

`examples/case-study-ai-saas` is a synthetic case study for a realistic AI-built SaaS shape: auth-adjacent API routes, billing checkout, Stripe webhook, Supabase RLS, Next/Vercel config, and GitHub Actions.

The fixture is intentionally not safe to launch. It helps readers see why a local-first launch gate is useful even when an app appears to have the expected product surfaces.

Expected findings include:

- missing Stripe webhook signature verification
- silent-success billing fallback
- broad Supabase RLS policy
- missing Next/Vercel security headers
- broad GitHub Actions permissions

Use it locally:

```bash
npx ai-saas-guard@latest scan --root examples/case-study-ai-saas --summary
```

This fixture is public-safe and synthetic. It is not a SaaS starter template, pentest target, certification artifact, or full audit.
