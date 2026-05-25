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

## Local Scan

```bash
npx ai-saas-guard@latest scan --root examples/case-study-ai-saas --summary
```

## Markdown Report

Use Markdown when you want a launch decision queue that can be pasted into an issue or PR:

```bash
npx ai-saas-guard@latest scan --root examples/case-study-ai-saas --markdown
```

The report should start with the launch gate, decision queue, top risks, manual proof steps, ranking explanation, and trust statement before listing every finding.

## PR Risk

To see how the same middle-layer logic works for an AI-heavy PR, run:

```bash
npx ai-saas-guard@latest pr-risk --root examples/case-study-ai-saas --base origin/main --markdown
```

The PR report is designed for reviewers: review order, required verification, reviewer checklist, suggested PR split, and file evidence.

## Fix-before/fix-after

Use this fixture as the "before" state. The expected fix path is not to make the fixture a starter template; it is to demonstrate how a reviewer would close the launch gate:

- verify Stripe signatures before entitlement updates
- replace fake success fallbacks with explicit error or degraded-mode handling
- scope Supabase RLS by tenant/user ownership
- add Next/Vercel security headers and request IDs
- reduce GitHub Actions permissions and add PR concurrency cancellation

After each fix, rerun the local scan and keep the manual proof result with the launch checklist.

## Trust and Resource Boundary

The fixture is scanned locally. `ai-saas-guard` does not upload source code or call an LLM, and normal CLI scans use bounded file collection with generated and dependency directories ignored.

This fixture is public-safe and synthetic. It is not a SaaS starter template, pentest target, certification artifact, or full audit.
