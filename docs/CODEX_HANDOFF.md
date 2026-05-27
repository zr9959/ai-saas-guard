# Codex Handoff

Last updated: 2026-05-27, Asia/Shanghai.

This handoff is the source of truth for a new Codex conversation. Do not rely on the old long chat history.

## Project Goal And Product Direction

`ai-saas-guard` is a local-first launch gate for AI-built SaaS apps. It sits between AI-generated SaaS code and real users, turning risky code and AI-heavy pull requests into a deterministic launch-risk review queue.

The product must stay focused:

- local-first, deterministic, no LLM calls, no code upload by default
- Next.js, Vercel, Supabase, Stripe, GitHub Actions, MCP, auth/session, billing, data access, deploy, and fake-green AI-code risks
- every finding needs rule ID, severity, file evidence, why, manual verification, and fix direction
- not a pentest, not a full audit, not a certification, and not a generic AI PR reviewer

Long-term product goal: become the launch-risk middle layer for AI-built SaaS apps. Current state stops before commercialization.

## Current True Progress

Current branch: `main`.

Latest release state:

- latest release commit: `9eff887 Fix hosted smoke cleanup and scan diagnostics (#119)`
- current `main` HEAD at the 2026-05-27 post-release recheck: `9eff887 Fix hosted smoke cleanup and scan diagnostics (#119)`
- package version: `0.43.2`
- npm latest: `ai-saas-guard@0.43.2`
- GitHub Release: `v0.43.2`
- floating Action tag: `v0` points to `9eff887f83d7287c44c066c3484b871105fc5b4a`
- Cloudflare Worker health reports `scannerVersion: "0.43.0"`
- the live hosted endpoint is still the Cloudflare `webhook-ingress`, not a deployed full source-checkout worker
- real hosted smoke passed on PR `#91`, Check Run `77724168740`, with KV cleanup returning `[]`

Post-release docs and evidence work after `v0.43.0`:

- committed Codex handoff package and public beta evidence intake: `3177e99 docs: add codex handoff and beta evidence intake`
- committed public beta evidence intake status: `58cb8dc docs: record public beta evidence intake status`
- opened draft PR `#95` from branch `codex/beta-evidence-readiness`
- added hosted operator runbook on PR `#95`
- merged PR `#95` into `main` with merge commit `9f780bc9151502e4e9cc674fa0c220457e1ae8d7`
- performed post-merge read-only provider check: public endpoints still healthy, Worker version unchanged, KV has 15 compact records with TTL and was not deleted
- opened GitHub issue `#93` for design-partner feedback intake
- opened GitHub issue `#94` for provider evidence before hosted public beta
- rechecked Phase 4/5 gates from current evidence; both remain blocked
- released `v0.43.1` from PR `#107`
- merged documentation/discovery follow-up PRs `#113`, `#114`, and `#115`
- 2026-05-27 recheck confirmed npm latest `0.43.1`, GitHub release `v0.43.1`, latest CI/CodeQL/Metrics/Cross-Project Discovery success, hosted health safe but still reporting hosted scanner `0.43.0`, issue `#93` missing real DP feedback, and issue `#94` still blocked on source-checkout/provider deletion/monitoring evidence
- released `v0.43.2` from PR `#119`; npm `latest` and floating Action tag `v0` now point at `0.43.2` / `9eff887`

Current working tree note: `.local/project-handoff.md` is local-only and ignored by git. Do not force-add it.

## User Latest Requirement

The user's latest explicit request is to focus back on this project and execute the evidence/docs review plan in order. Business code should not change unless explicitly requested.

The user also previously established this strategic boundary:

- keep going automatically until the product reaches the pre-commercial boundary
- do not keep producing endless five-item plans
- stop before commercialization
- do not add billing, pricing, paid packaging, marketplace conversion, or sales funnel work until real user/design-partner feedback exists

## Completed Work

Core CLI and scanners:

- `scan`
- `demo`
- `pr-risk`
- `check-supabase`
- `check-stripe`
- `check-mcp`
- `check-actions`
- secret and `NEXT_PUBLIC_*` checks
- Stripe webhook checks
- Supabase RLS/storage checks plus RLS doctor
- Next/Vercel launch preflight
- silent-success/fake-green guard
- MCP policy/receipt template
- GitHub Actions launch hygiene scanner
- spec-to-PR trust-boundary review
- JSON, SARIF, terminal, summary, and PR markdown outputs
- GitHub Action wrapper
- npm Trusted Publisher release path

Hosted path:

- Cloudflare hosted ingress deployed at `https://ai-saas-guard-hosted.zr9959.workers.dev`
- private staging GitHub App `ai-saas-guard-hosted`
- signed webhook intake
- compact KV delivery/scan records
- scoped GitHub App token exchange
- PR file metadata classification
- bounded selected-repository Check Run publishing
- signed installation/repository cleanup
- Node/container hosted app skeleton
- provider-independent hosted service runtime
- hosted read-only checkout runner
- Phase 3 source-checkout trial gate: `evaluateHostedSourceCheckoutTrialGate`
- Phase 4 hosted beta readiness gate: `evaluateHostedBetaReadinessGate`
- Phase 5 team launch gate: `evaluateTeamLaunchGateReadiness`

Public docs:

- English README and Chinese README updated through `0.43.2`
- Codex/agent working rules in `docs/CODEX_AGENT_WORKING_RULES.md`
- rules docs
- hosted deployment/runtime/gate docs
- hosted operations evidence
- public beta evidence and feedback intake
- repository trust hardening docs
- release quality knowledge base
- npm publishing docs

## Unfinished Work

Do not start commercialization yet.

Remaining pre-public-beta proof work:

- use `docs/public-beta-evidence-feedback.md` as the privacy-safe intake checklist for real feedback and provider evidence
- deployed full source-checkout scan worker with real sandbox evidence
- provider monitoring evidence for source-checkout queue depth, worker failures, Check Run failures, cleanup failures, and retention failures
- source-checkout rollback and incident-response evidence from deployed artifacts
- full GitHub App uninstall or repository-removal deletion proof from a safe test installation
- public beta support and privacy wording validated by a real participant
- external design-partner/user feedback
- GitHub issue `#93` is open to track design-partner feedback intake
- GitHub issue `#94` is open to track provider monitoring, rollback, incident, deletion, and support evidence

Not implemented:

- billing or paid plans
- customer account system
- admin dashboard
- mobile app
- SEO website, sitemap, analytics, or GEO campaign
- production database schema or migration

## Current Blockers

There is no code blocker for CLI/Action releases.

Hosted public beta is blocked by evidence, not by the readiness-gate code:

- source-checkout worker is not yet deployed as the live hosted scan worker
- live hosted Worker still performs compact PR-file metadata classification, not full deployed source checkout scanning
- provider monitoring and rollback evidence is partial for the current ingress path but still missing for deployed source-checkout
- full GitHub App uninstall/repository-removal proof is still blocked on App-management permission or a safe test installation
- no design-partner feedback has been collected
- `docs/public-beta-evidence-feedback.md` defines the intake process, but no real external DP-1/DP-2/DP-3 feedback has been recorded yet
- Phase 4 hosted beta readiness and Phase 5 team launch remain blocked until the remaining evidence exists
- `docs/hosted-operator-runbook.md` documents operator workflow, but source-checkout runbook evidence still requires a deployed source-checkout artifact

## Key Decisions And Reasons

- Keep the product as one repo and one product: local-first launch gate for AI-built SaaS apps.
- Keep local scans deterministic: avoids privacy risk and keeps output explainable.
- Use gates rather than endless planning: Phase 3/4/5 are machine-checkable readiness gates.
- Use `docs/CODEX_AGENT_WORKING_RULES.md` for agent behavior: think before editing, keep changes narrow, verify before claiming, protect secrets, use risk-gated autonomy, and clean up every task.
- Keep billing disabled: user explicitly wants to stop before commercialization.
- Keep hosted Check Runs compact: do not store source, diffs, PR text, checkout paths, or installation tokens.
- Keep README and Chinese README in sync for public-facing changes.

## Do Not Modify Or Delete

Protect:

- Cloudflare secrets: `WEBHOOK_SECRET`, `GITHUB_APP_PRIVATE_KEY`
- Cloudflare KV binding/namespace used as `HOSTED_EVENTS`
- GitHub App `ai-saas-guard-hosted`, App ID `3834787`, installation ID `135085075`
- npm Trusted Publisher configuration
- GitHub Release tags and `v0` tag unless doing an intentional release
- `docs/hosted-operations-evidence.md` history rows
- `.local/project-handoff.md` local-only private context
- private `/Volumes/MyPSSD/app/3in1` project; never mix it into this public repo

Do not commit:

- API keys, tokens, cookies, webhook secrets, private keys, certs, database URLs, customer data
- raw webhook payloads, PR title/body text, raw diffs, source, secrets, checkout paths, or installation tokens
- temporary smoke evidence files from `/tmp`
- generated private logs or AI conversation dumps

## Safety And Risk Notes

- Live hosted ingress is staging evidence, not production hosted exposure.
- Do not claim pentest, full audit, certification, or "AI reviewer".
- Hosted beta/team gates are readiness evaluators; they are not proof that public beta is operationally safe without fresh provider evidence.
- No database migration exists.
- No admin dashboard exists.
- No mobile app exists.
- No SEO/GEO site or analytics exists.
- Login, membership, payment, and permission logic in this repo is fixture/scanner logic plus GitHub App install permission logic; there is no customer login or payment system.

## Self-Check Coverage

This handoff package explicitly covers:

- user latest requirement
- unfinished tasks
- deployment status
- test results
- database changes
- environment variables
- third-party service configuration
- security risks
- SEO/GEO requirements
- admin/backend operations
- mobile issues
- payment, membership, login, and permission logic
- data/config that must not be overwritten or deleted

## Where The Next Codex Should Start

1. Read `docs/CODEX_HANDOFF.md`, `docs/CODEX_AGENT_WORKING_RULES.md`, `docs/CODEX_STATE.md`, `docs/CODEX_TODO.md`, `docs/CODEX_RECENT_CHANGES.md`, `docs/release-quality-knowledge-base.md`, and `docs/public-beta-evidence-feedback.md`.
2. Run `git status --short --branch`.
3. Summarize understanding to the user before modifying code.
4. Do not start new development unless the user explicitly asks.
5. Check GitHub issue `#93` for design-partner feedback intake and issue `#94` for provider evidence.
6. Check `docs/beta-readiness-review-2026-05-27.md` for the latest public-safe blocker summary.
7. If asked for next work, focus on feedback/evidence collection for public beta readiness, not more speculative features.
