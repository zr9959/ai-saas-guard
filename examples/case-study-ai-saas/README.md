# Case Study AI SaaS Fixture

This synthetic fixture looks like a small AI-built SaaS with auth, billing, Supabase, Vercel/Next.js deploy config, and GitHub Actions.

It is intentionally risky:

- billing checkout swallows provider failure and returns fake success
- Stripe webhook does not verify signatures
- Supabase RLS policy is broad
- Next.js config lacks production security headers
- GitHub Actions grants broad permissions

It is not a complete SaaS template and does not contain real secrets.
