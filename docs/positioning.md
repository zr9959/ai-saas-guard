# Positioning Notes

This project should compete by being narrow, trustworthy, and review-oriented.

## North Star

`ai-saas-guard` should become the launch-risk middle layer between AI-generated SaaS code and real users.

The product is not trying to be the lowest-level static-analysis engine, and it is not trying to be a top-level full security audit service. Its job is to translate messy AI-built SaaS code and AI-heavy PRs into a founder-readable, reviewer-ready launch gate:

```text
AI-built SaaS code
        ↓
ai-saas-guard: launch-risk middle layer
        ↓
founder, reviewer, CI, or GitHub App makes the final launch decision
```

The long-term product sentence:

> The launch gate between AI-generated code and real users.

Every major feature should support this middle-layer role:

- translate code changes into launch-risk language
- prioritize trust-boundary paths: auth, billing, tenant data, RLS, webhooks, env, CI, MCP, and deploy
- turn findings into manual proof steps a human can actually run
- keep the default trust model local-first, deterministic, read-only, no code upload, and no LLM calls
- avoid claiming pentest, certification, full audit, or complete vulnerability discovery

## Public Position

`ai-saas-guard` is a local-first launch preflight for AI-built SaaS apps. It finds common production-readiness risks and produces concrete verification steps.

Use these phrases:

- launch preflight
- evidence-first scanner
- review-first file list
- two-account authorization test
- Stripe webhook replay checklist
- local-only, no upload

Avoid these phrases:

- full security audit
- pentest
- proves your app is secure
- finds every vulnerability
- automatic security certification

## Differentiation

The broad market already has strong tools:

- secret scanners
- SAST platforms
- MCP scanners
- hosted AI SaaS audit products
- Supabase-specific scanners

The wedge should be:

1. `pr-risk` for AI-generated PRs.
2. Founder-readable launch verification, not only findings.
3. Stack-specific checks for Next.js + Supabase + Stripe + Vercel + MCP.
4. AI-specific silent-success checks: swallowed errors, fake fallback data, placeholder tests, and missing trust-boundary rationale.
5. Local-first trust model for private repos.
6. Open-source CLI first, hosted GitHub App later.

## Monetization Path

Start with GitHub reputation:

- public repo
- good fixtures
- high-signal README
- short demos
- issues labeled `good first rule`
- example reports
- GitHub Action usage

Then add paid layers:

- saved reports
- shareable launch-readiness page
- PR comments
- scan history
- policy thresholds
- private GitHub App
- optional human review

The open-source CLI should remain useful enough to earn trust. Paid features should save time and add workflow integration.
