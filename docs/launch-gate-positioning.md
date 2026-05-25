# Launch Gate Positioning

`ai-saas-guard` is a local-first launch gate for AI-built SaaS apps. It is focused on the code paths that decide whether a product is ready to invite users: auth, billing, tenant data, provider failure handling, deploy config, MCP tool power, GitHub Actions hygiene, and AI-heavy PR review.

The narrow bet is simple: a founder or reviewer should know which launch-risk files to inspect first, what manual proof to run, and what fix direction to try before traffic reaches real users.

## What This Adds In One Line

`ai-saas-guard` turns AI-built SaaS launch risks into a short local review queue; it is not intended to substitute for broad SAST, dependency scanning, workflow security analysis, or repository scorecards.

## Where It Fits

| Tool category | Typical strength | How ai-saas-guard fits beside it |
| --- | --- | --- |
| Semgrep | Broad customizable static rules across many languages and frameworks | Adds SaaS launch-specific heuristics and review wording for Stripe, Supabase, silent-success, Next/Vercel, MCP, Actions, and AI PR trust boundaries |
| zizmor | Deep GitHub Actions security analysis | Adds a smaller launch-readiness hygiene check for workflow permissions, PR concurrency, docs-only CI cost, shallow checkout risk, and first-run guidance |
| OpenSSF Scorecard | Repository supply-chain posture signals | Adds app-level launch triage inside the repo, while Scorecard remains useful for public project maintenance controls |
| Snyk and dependency scanners | Dependency, container, license, and known-vulnerability workflows | Adds local source review for SaaS trust-boundary mistakes that may not be dependency vulnerabilities |
| GitHub code scanning | SARIF ingestion and code-security workflow inside GitHub | Emits SARIF, but keeps the primary workflow local-first and focused on launch review queues |

## What It Optimizes For

- local-first: source stays on the machine or in the caller's CI job
- deterministic: no LLM calls and no code upload
- founder-readable output: severity, rule ID, file evidence, why, manual proof, and fix direction
- AI-built SaaS launch risk: not every static-analysis finding, only the paths likely to break auth, billing, data access, deploy, or review trust
- PR triage: ranking trust-boundary files before cosmetic or unrelated AI-generated changes

## What It Does Not Try To Be

- not a general vulnerability management platform
- not a dependency advisory database
- not a cloud posture dashboard
- not a runtime WAF or MCP proxy
- not a guarantee that an app is safe to launch

Use it as a short, evidence-first launch review queue alongside dependency scanning, repository hardening, code scanning, manual two-account authorization tests, Stripe webhook replay, deploy-preview checks, and human review.
