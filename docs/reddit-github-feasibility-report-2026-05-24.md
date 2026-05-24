# Reddit + GitHub Feasibility Report - 2026-05-24

## Executive Summary

Best next directions for `ai-saas-guard`:

1. **Silent-success guard for AI-generated SaaS code** - highest leverage. Reddit pain is sharp, current repo does not cover it, and competition is broad but not focused on deterministic "fake success before launch" checks.
2. **Supabase RLS doctor / policy test harness** - strong fit. Current static RLS checks are a good base; Reddit repeatedly asks for debugging help and cross-tenant proof, not just warnings.
3. **Next/Vercel launch preflight expansion** - useful and aligned if kept narrow: env/runtime mismatch, missing security headers, image/cost/request amplification hints, and logging/observability checklist.
4. **Spec-to-PR trust-boundary review** - good extension of `pr-risk`, but should be framed as deterministic launch-risk triage, not generic AI PR review.
5. **MCP tool-call receipts / runtime gate** - promising but more competitive and larger in scope. Start with config/manifest/receipts design, not a full firewall.

Avoid as primary pivots:

- generic AI PR reviewer
- SaaS boilerplate
- lead-generation radar
- full CI analytics platform
- broad GitHub Actions security scanner

## Current Product Overlap

Already strong:

- AI SaaS launch preflight positioning
- Supabase RLS/static policy risk
- Stripe webhook signature/idempotency/lifecycle checks
- secrets and `NEXT_PUBLIC_*` leakage
- API route ownership/rate-limit hints
- MCP static config risks
- PR risk triage for sensitive surfaces
- local-first trust model and GitHub Action distribution

Main gaps surfaced by Reddit:

- silent AI failure patterns: swallowed errors, fake data, placeholder tests
- RLS debug/proof: JWT claims, policy explainability, cross-tenant probes
- security headers and auth/session details
- Firebase/Prisma coverage for common indie SaaS stacks
- Next/Vercel cost and runtime-env preflight
- spec/decision drift for AI-generated code

## Competition Snapshot

GitHub searches were public/read-only and cross-checked with `gh search repos` and repo pages on 2026-05-24.

| Area | Competition Evidence | Intensity | Implication |
| --- | --- | --- | --- |
| Supabase RLS/security scanners | GitHub API search for `supabase rls audit` returned 29 repos. Top visible repos: [yoanbernabeu/supabase-pentest-skills](https://github.com/yoanbernabeu/supabase-pentest-skills) 42 stars, [Farenhytee/database-sentinel](https://github.com/Farenhytee/database-sentinel) 26, [SymbioticSec/vibe-scanner](https://github.com/SymbioticSec/vibe-scanner) 20, [Perufitlife/supabase-security-skill](https://github.com/Perufitlife/supabase-security-skill) 17. | Low to moderate | There is competition, but no dominant OSS. A focused RLS debugger/proof harness can stand out. |
| Broad AI PR review | [The-PR-Agent/pr-agent](https://github.com/The-PR-Agent/pr-agent) has 11,317 stars. [Nayjest/Gito](https://github.com/Nayjest/Gito) is an open-source AI reviewer with GitHub PR and local review support. Presubmit, ReviewScope, CodeRabbit-style products also exist. | High | Do not compete as a generic PR reviewer. Use deterministic SaaS trust-boundary checks. |
| AI slop / AI generated-code quality | [SlopCannon](https://slopcannon.dev/) markets PR slop detection. [Deslint](https://deslint.com/) focuses deterministic AI-code verification for frontend/design/a11y. Search results show smaller silent-failure-specific tools. | Moderate, emerging | Narrow "silent fake success" detection for SaaS integrations is still open. |
| MCP static security scanners | GitHub API search for `MCP security scanner prompt injection` returned 54 repos. Top visible repos: [HeadyZhang/agent-audit](https://github.com/HeadyZhang/agent-audit) 172, [sinewaveai/agent-security-scanner-mcp](https://github.com/sinewaveai/agent-security-scanner-mcp) 102, [garagon/aguara](https://github.com/garagon/aguara) 81. | Medium and heating up | Current static MCP checks are okay. Runtime firewalling is crowded and trust-sensitive. |
| MCP tool-call firewalls | Search for `MCP firewall tool calls` returned 22 repos. Examples: `pic-standard` 23, `avakill` 10, `agent-wall` 6, `OpenAgentLock` 6, `deconvolute` 4. | Early but crowded in narrative | A receipts/audit format may be safer than another firewall. |
| GitHub Actions analytics / CI waste | GitHub now has native Actions metrics docs. Competitors include [Workflow Metrics](https://workflow-metrics.com/), [RunWatch](https://runwatch.io/), [SpecHive](https://spechive.dev/), and CILens. | Medium to high | Full CI analytics is a separate product. A small Actions hygiene check can support PR risk. |
| GitHub Actions security | [zizmor](https://github.com/zizmorcore/zizmor) 5,282 stars, [OpenSSF Scorecard](https://github.com/ossf/scorecard) 5,455, [actionlint](https://github.com/rhysd/actionlint) 3,894, [harden-runner](https://github.com/step-security/harden-runner) 1,164. | High | Do not enter broad Actions security. Only add checks directly relevant to AI SaaS launch. |
| Next/env validation | [t3-oss/t3-env](https://github.com/t3-oss/t3-env) 3,921 stars and [expatfile/next-runtime-env](https://github.com/expatfile/next-runtime-env) 647 cover typed/runtime env patterns. | Medium | Validation libraries exist, but a scanner that detects risky deployment/env posture is still differentiated. |

## Feasibility Ranking

Scores: 5 is best. Competition score is inverted, where 5 means less dangerous competition.

| Direction | Demand | Repo Fit | Differentiation | Build Leverage | Competition Score | Priority |
| --- | ---: | ---: | ---: | ---: | ---: | --- |
| Silent-success guard | 5 | 5 | 4 | 5 | 4 | P0 |
| Supabase RLS doctor | 5 | 5 | 4 | 4 | 4 | P0 |
| Next/Vercel deploy preflight | 4 | 4 | 3 | 4 | 3 | P1 |
| Spec-to-PR trust-boundary review | 4 | 5 | 3 | 4 | 2 | P1 |
| MCP receipts / action gate | 4 | 3 | 3 | 2 | 2 | P2 |
| GitHub Actions waste lens | 4 | 2 | 2 | 2 | 2 | P3 / separate |

## Recommended Builds

### P0: Silent-Success Guard

Problem: AI agents produce code that appears to work but silently returns fake/default data, swallows real failures, or weakens tests.

MVP:

- Add rules under API/auth/billing/data routes for:
  - `catch`/`.catch` returning `{}`, `[]`, `null`, `true`, fake success, or sample data without logging or visible error propagation.
  - production files importing fixtures, mocks, demo data, or sample responses.
  - hardcoded fallback API responses in Stripe/Supabase/OpenAI/payment/auth flows.
  - test bodies replaced with TODOs, empty assertions, `test.skip`, `describe.skip`, or broad snapshots without behavior checks.
  - "temporary" bypasses around auth, rate limits, webhooks, and ownership checks.
- Integrate with `pr-risk` so these findings rank high when in sensitive files.
- Output manual verification steps: "force upstream API failure and confirm visible error, no entitlement grant, no fake success."

Why it should work:

- Reddit signal is detailed and recent.
- Current repo already has finding/report plumbing.
- The rules can be deterministic and local-first.
- It reinforces the repo's strongest message: AI speed needs launch verification.

Risks:

- False positives around legitimate fallback UX.
- Mitigation: label as default/experimental, require evidence path, and distinguish disclosed fallback from silent fallback.

### P0: Supabase RLS Doctor

Problem: RLS bugs fail silently. Static checks tell users something looks risky, but not how to reproduce or prove the boundary.

MVP:

- New `check-supabase --doctor` or extended report section.
- Generate SQL snippets for:
  - tables with RLS enabled but no policies
  - write policies involving `public`
  - missing insert/update/delete policies when select exists
  - policy predicates referencing `auth.uid()` against suspicious non-uuid columns
  - tables with tenant-like names but no tenant/owner predicate
- Add a two-account verification recipe:
  - seed user A/user B rows
  - run authenticated role checks
  - attempt cross-tenant select/update/delete
- Optional later: safe anon-key dynamic probe requiring explicit `--supabase-url` and anon key, with redaction and no data upload.

Why it should work:

- Existing Supabase scanner gives a base.
- GitHub competition is not entrenched.
- Reddit pain is not "teach me RLS"; it is "show me why this failed."

Risks:

- Dynamic probes can be sensitive.
- Mitigation: default to static SQL generation; require explicit flags for live probing.

### P1: Next/Vercel Launch Preflight

Problem: indie SaaS builders get surprised by runtime env, Vercel/Next behavior, missing logs, and cost/request amplification.

MVP:

- Add rules/checklist for:
  - missing `securityHeaders` / `headers()` config where app has auth/payment routes
  - `next/image` remote patterns and unbounded transformation/cost risk
  - suspicious `prefetch`/dynamic route patterns for high-cardinality pages
  - env vars used in server routes but missing from `.env.example`
  - `NEXT_PUBLIC_*` values beyond existing secret checks, with client exposure inventory
  - missing production logging/trace IDs for billing/webhook/tenant routes
- Keep wording as "cost/deploy risk hints", not billing prediction.

Why it should work:

- Fits launch-readiness.
- Avoids competing with full observability platforms.

Risks:

- Cost rules are noisy because architecture context matters.
- Mitigation: evidence-first hints plus manual verification, not hard failures.

### P1: Spec-To-PR Trust-Boundary Review

Problem: AI-generated code can be functionally correct while hiding decisions that no one reviewed.

MVP:

- Extend `pr-risk` to detect when sensitive files changed without nearby docs/spec updates.
- Recognize repo spec paths: `docs/`, `specs/`, `.claude/`, `.cursor/`, `AGENTS.md`, `CLAUDE.md`.
- Emit "decision review missing" for changes to auth/session/billing/RLS/MCP/deploy with no corresponding rationale.
- Add a markdown checklist for reviewers:
  - What changed at the trust boundary?
  - Why this auth/session/payment/data access decision?
  - What manual test proves it?

Why it should work:

- Builds directly on `pr-risk`.
- Avoids broad AI PR reviewer competition.

Risks:

- Teams without specs will get generic advice.
- Mitigation: make it an opt-in mode or low-severity checklist finding.

### P2: MCP Receipts / Runtime-Adjacent Guard

Problem: MCP risk is moving from config to actual tool calls.

MVP:

- Do not start with a full proxy.
- Add `check-mcp --policy-template` to produce a local policy and receipt format:
  - server/tool identity
  - normalized argument digest
  - side-effect class
  - redaction status
  - allow/deny reason
  - replay determinism note
- Extend static checks to flag MCP tools lacking a clear side-effect class or permission boundary.

Why it should work:

- Trust-sensitive market rewards transparency.
- Current local-first posture is credible.

Risks:

- Runtime proxying is a new product.
- Mitigation: ship static/policy artifacts first and watch adoption.

## Suggested 6-Week Roadmap

Week 1:

- Add silent-success rule catalog entries and fixtures.
- Add findings for swallowed errors and fake data in JS/TS API routes.

Week 2:

- Add test-integrity rules for skipped/TODO/no-op tests.
- Wire high-risk ranking into `pr-risk`.

Week 3:

- Add Supabase doctor static SQL inventory and report section.
- Add fixtures for missing insert policy, public writes, RLS enabled with no policies.

Week 4:

- Add two-account RLS verification cookbook output.
- Update README with "AI-built SaaS holes Reddit keeps reporting" coverage map.

Week 5:

- Add Next/Vercel preflight rules for security headers, env inventory, image/request cost hints.
- Keep all cost findings as medium/low with manual verification steps.

Week 6:

- Add spec-to-PR checklist mode.
- Publish example reports and issues labeled `good first rule`.

## Positioning

Use:

- "AI-built SaaS launch preflight"
- "silent-failure checks for AI-generated code"
- "RLS doctor and two-account proof checklist"
- "review-first PR risk triage"
- "local-first, deterministic, no code upload"

Avoid:

- "AI PR reviewer" as the main category
- "finds all vulnerabilities"
- "pentest"
- "automatic security certification"
- "Vercel bill predictor"

## Final Recommendation

Build the next wedge as **AI-generated SaaS silent-failure + RLS proof**.

It is close to what the repo already does, has strong Reddit evidence, avoids saturated generic PR-review and GitHub Actions markets, and gives the hosted GitHub App a clearer future reason to exist: not another reviewer, but a launch-risk gate that catches the exact trust-boundary failures AI builders keep missing.

