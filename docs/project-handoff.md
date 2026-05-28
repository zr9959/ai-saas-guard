# Project Handoff

Last updated: 2026-05-27

Use this public-safe document when moving `ai-saas-guard` into a new GitHub-facing ChatGPT/Codex Project or a new conversation.

## Project Identity

Name: `ai-saas-guard`

GitHub repo: https://github.com/zr9959/ai-saas-guard

Current branch: `main`

Recent setup commits at the time this handoff was created:

- `1bd105d ci: update official actions`
- `a7a8d24 docs: add release quality knowledge base`
- `66c0076 ci: add test workflow`
- `2431389 feat: launch ai saas guard cli`

## Product Direction

`ai-saas-guard` is a local-first launch preflight CLI for AI-built SaaS apps.

North star: `ai-saas-guard` is the launch-risk middle layer between AI-generated SaaS code and real users. It translates AI-built SaaS code and AI-heavy PRs into a founder-readable, reviewer-ready launch gate. It is not a low-level static-analysis engine, a pentest, a certification, or a full security audit service.

The core user is a founder, solo builder, or reviewer shipping an AI-assisted SaaS MVP who needs to know what deserves human review before launch or merge.

The narrow product promise:

- detect risky launch surfaces in a local repository
- explain findings with evidence, verification steps, and fix direction
- help reviewers prioritize auth, billing, data access, secrets, MCP tools, and deploy config
- stay local-first, read-only, no network calls by default, and no account required

Do not market it as a full pentest, full SAST platform, or proof that an app is secure.

## Current Scope

Implemented surfaces:

- secret-like values and risky public env exposure
- founder-readable launch-readiness checklist for two-account authorization, Stripe webhook verification, MCP config review, Supabase, deploy, CI, and rollback checks
- Stripe webhook signature, raw body, idempotency, and lifecycle handler heuristics, including payment-action-required invoice recovery
- Stripe webhook replay cookbook for checkout, renewal failure, payment action required, updates, cancellation, refunds, duplicate delivery, and out-of-order review
- Supabase RLS, tenant membership, ownership filter, weak `WITH CHECK`, and storage object policy heuristics
- sensitive API route heuristics
- MCP config side-effect and secret-bearing risk inventory
- Next/Vercel deploy and runtime footguns
- PR diff risk triage for auth, billing, RLS, env, tests removed, and large mixed diffs
- PR diff diagnostics when a base ref or shallow checkout prevents comparison
- PR-focused markdown summary output for GitHub step summaries or PR comments, with escaped single-line evidence in generic markdown reports
- project-local `.ai-saas-guard.json` config for rule toggles, severity overrides, path-specific suppressions, and default fail thresholds
- rule stability labels in catalog metadata, public rule docs, and SARIF rule properties
- hosted GitHub App design note covering least-privilege permissions, webhook verification, privacy, data retention, prompt-injection handling, and implementation gates
- first hosted service slice document defining signed webhook intake, trusted scan identity, idempotent queueing, read-only worker behavior, check-run-only output, compact report storage, and explicit non-goals
- hosted deployment model document choosing containerized Node.js ingress and worker roles, a managed durable queue, managed compact report storage, platform secret manager usage, structured redacted logs, installation/repository rate limits, rollback, and incident response paths
- hosted operational release gate document requiring hosted CI, webhook replay, dependency and container scanning, privacy and retention verification, worker cleanup, monitoring and alerting, manual rollback, and incident response evidence before exposure
- hosted uninstall and data deletion document defining repository removal, full app uninstall, compact report deletion, queue cancellation, audit record retention, repeated cleanup idempotency, and user-facing deletion wording
- hosted pricing and packaging document defining open-source CLI boundaries, free/public repo hosted behavior, private repo hosted behavior, PR comments, saved reports, team policy, optional Launch Review, and no pentest/certification/full-audit claims
- hosted service runtime document and provider-independent runtime core for signed webhook intake, idempotent queue upsert, read-only worker orchestration, compact report storage, Check Run publication adapters, and worker cleanup planning
- hosted GitHub App deployment planner document and least-privilege manifest planner for required permissions, events, public HTTPS URLs, container digest, secret references, raw secret input blockers, and release-gate checks
- hosted production adapter layer document and helpers for RS256 GitHub App JWT creation, selected-repository installation-token request planning, separate worker/check-run token scopes, fixed read-only worker execution, timeout/output budgets, and cleanup planning for success, failure, timeout, and cancellation
- hosted read-only checkout worker runner exported from `ai-saas-guard/hosted/worker`, with trusted clone targets, git askpass token handling, bounded command execution, compact CLI JSON parsing, and checkout cleanup after success or failure
- hosted Node/container app skeleton document and helpers for safe health and webhook HTTP ingress, one-job worker ticks, in-memory provider adapters, provider reference validation, and the chosen `node_container` roles `webhook-ingress` and `scan-worker`
- Codex/agent working rules requiring narrow changes, fresh verification, secret protection, risk-gated autonomy, and cleanup after every task
- hosted staging deployment planner document and helpers for provider binding, staging release-gate evidence, Node/container deployment composition, and production GitHub App promotion gating
- hosted staging harness document and helpers for local signed webhook replay, file-backed queue/report/Check Run artifacts, worker sandbox cleanup verification, and release-gate evidence fixtures without cloud calls
- public beta evidence and feedback intake document defining privacy-safe design-partner feedback targets, feedback templates, provider monitoring/rollback/incident/support evidence, beta block conditions, and cleanup requirements before public beta
- live Cloudflare hosted ingress at `https://ai-saas-guard-hosted.zr9959.workers.dev` with `/healthz`, `/github/app/install-info`, `/github/app/manifest-callback`, signed `/github/webhook` intake, Cloudflare KV storage, private staging GitHub App `ai-saas-guard-hosted` (`3834787`) installed on `zr9959/ai-saas-guard`, Worker code for public-safe install guidance, scoped installation-token exchange, PR file metadata fetching, compact PR-risk classification, bounded selected-repository Check Run publishing, and signed installation deletion/repository removal cleanup, plus hosted operations evidence in `docs/hosted-operations-evidence.md`
- resource caps for repository text collection, including per-file, total-file, and total-byte scan budgets to reduce worst-case memory use
- hosted pre-implementation contracts document, hosted compact report fixture, and pure helpers for pull request webhook intake planning, durable scan queue upsert planning, worker read-only scan planning, Check Run publication planning, queue-safe pull request event parsing from trusted GitHub event fields, bounded check-run summary rendering, idempotent queue cleanup planning, worker checkout cleanup planning, retention/deletion cleanup planning, and operational release gate evaluation
- implementation-ready hosted GitHub App permission contract for required permissions, optional PR comment permissions, selected repository installation, and out-of-scope broad permissions
- hosted GitHub App contract helpers and tests for webhook intake order, webhook verification, installation token scoping, durable scan queue idempotency, compact reports, retention limits, uninstall cleanup, repeated cleanup idempotency, scoped deletion planning, operational release gate blocking, provider-independent service runtime orchestration, GitHub App deployment planning, hosted production adapter planning, Node/container app skeleton planning, hosted staging deployment planning, and local staging harness replay
- GitHub issue templates for bug reports, false positives, false negatives, rule requests, and public-safe security reports
- CODEOWNERS for source, tests, docs, workflows, Action, and package metadata
- repository trust hardening with strict `main` branch protection, required CI status checks, fast-check fuzzing, signed GitHub release assets backed by npm trusted publishing provenance, Dependabot for npm and GitHub Actions, CodeQL, private vulnerability reporting, secret scanning, and push protection
- OpenSSF Best Practices passing badge at https://www.bestpractices.dev/projects/12955, with `.bestpractices.json` for conservative repository-backed answer proposals and `CONTRIBUTING.md` for pull request process, tests, rule-design requirements, release gate evidence, and public-safety constraints
- JSON output
- SARIF output
- composite GitHub Action wrapper
- npm publishing through GitHub Actions Trusted Publisher/OIDC

Existing commands:

```bash
ai-saas-guard scan
ai-saas-guard pr-risk
ai-saas-guard check-supabase
ai-saas-guard check-stripe
ai-saas-guard check-mcp
ai-saas-guard check-actions
```

## Mandatory Release Gate

Before any CLI update, GitHub Action update, npm package, plugin, agent tool, or public repository change, read and follow:

- `docs/release-quality-knowledge-base.md`

Minimum verification commands:

```bash
npm ci
npm test
npm run build
node dist/cli.js --help
node dist/cli.js scan --root . --json
node dist/cli.js scan --root . --sarif > /tmp/ai-saas-guard.sarif
node dist/cli.js pr-risk --root . --json
npm audit --audit-level=high --registry=https://registry.npmjs.org
npm pack --dry-run
```

For release candidates, also unpack the npm tarball and run the packaged CLI.

## GitHub Status

Repository visibility: public.

Important: unrelated private projects, private research, and private product files must not be mixed into this public repository.

GitHub Project:

- https://github.com/users/zr9959/projects/1
- Title: `ai-saas-guard Roadmap`
- Visibility: public

Current issue set:

- Closed hosted MVP issue: #24 webhook intake.
- Closed hosted MVP issue: #25 idempotent queue contract.
- Closed hosted MVP issue: #26 read-only worker checkout.
- Closed hosted MVP issue: #27 Check summaries.
- Closed hosted MVP issue: #28 retention/uninstall cleanup.
- Closed hosted MVP issue: #29 hosted operational release gate.

CI:

- Workflow: `.github/workflows/ci.yml`
- Runs on pull requests and pushes to `main`
- Uses `permissions: contents: read`
- Static workflow checks: `actionlint` and `zizmor`
- Code scanning workflow: `.github/workflows/codeql.yml`
- Fuzz/property tests: `npm run test:fuzz` with `fast-check`
- Dependabot config: `.github/dependabot.yml` with weekly schedules, bounded PR volume, and cooldown windows
- Latest verified run for the repository trust hardening release must succeed before publishing

Hosted staging:

- Cloudflare Worker URL: https://ai-saas-guard-hosted.zr9959.workers.dev
- Cloudflare KV binding: `HOSTED_EVENTS`
- GitHub App: `ai-saas-guard-hosted`
- GitHub App ID: `3834787`
- GitHub App installation ID: `135085075`
- Installed repository: `zr9959/ai-saas-guard`
- Current hosted mode: deployed Worker health, signed GitHub App webhook delivery, compact KV records, cleanup, and Check Run publication pass in staging; code supports signed webhook ingress, compact queueing, scoped GitHub App token exchange, PR file risk classification, bounded Check Run publishing, Node/container read-only checkout worker runner, Phase 3 source-checkout trial gate, Phase 4 hosted beta readiness gate, and Phase 5 team launch gate
- Not yet complete: deployed full source checkout scan worker with sandbox evidence, provider monitoring evidence, provider rollback evidence, production hosted exposure, real external user/design-partner feedback, and paid hosted workflow features

OpenSSF Best Practices:

- Project: https://www.bestpractices.dev/projects/12955
- Badge level: passing

Publishing:

- npm package: `ai-saas-guard`
- Current published release line: `v0.43.3` published to GitHub Release, npm, and the `v0` Action tag
- Next source candidate: none
- Publish workflow: `.github/workflows/npm-publish.yml`
- Trusted Publisher: GitHub Actions for `zr9959/ai-saas-guard`, workflow `npm-publish.yml`
- Long-lived npm publish tokens should not be required.

## Latest User Requirements And Current Plan

The newest operating instruction from the user is: keep going automatically until the point where commercialization would begin, then stop. Do not keep creating endless five-item micro-plans. Use the roadmap phases as gates instead:

- Phase 1 local CLI/GitHub Action: complete.
- Phase 2 hosted ingress: complete for staging Cloudflare webhook ingress and compact Check Run publication.
- Phase 3 hosted source-checkout trial gate: complete in code via `evaluateHostedSourceCheckoutTrialGate`.
- Phase 4 hosted beta readiness gate: complete in code via `evaluateHostedBetaReadinessGate`.
- Phase 5 team launch gate: complete in code via `evaluateTeamLaunchGateReadiness`.
- Phase 6 commercialization: intentionally not started. Do not add pricing, billing, paid packaging, marketplace conversion, or sales funnel work until there is real user/design-partner feedback.

Next work should therefore be feedback and evidence work, not more speculative feature expansion:

- use `docs/public-beta-evidence-feedback.md` as the intake checklist
- use GitHub issue `#93` for design-partner feedback tracking
- use GitHub issue `#94` for provider evidence tracking
- collect real user/design-partner feedback
- review public installation wording and support path
- collect provider monitoring, rollback, incident-response, uninstall/deletion, and support evidence before public beta
- keep CLI/Action/docs current
- only start commercialization after actual usage evidence exists
- 2026-05-28 update: npm/GitHub latest is `0.43.3`; the hosted ingress remains healthy and still reports `scannerVersion: "0.43.0"`; real design-partner feedback, deployed source-checkout proof, full GitHub App deletion proof, and source-checkout provider monitoring evidence remain missing

## Latest Deployment And Test Evidence

Latest release:

- Version: `0.43.3`
- Commit/tag target: `1db0253e0d57198060d5227a1f85668004242429`
- GitHub Release: `v0.43.3`
- npm: `ai-saas-guard@0.43.3`, `latest`
- GitHub Action floating tag: `v0` points to `1db0253e0d57198060d5227a1f85668004242429`
- Cloudflare Worker deployed version: `8744d3db-0114-4653-85e2-f1554ff1b26b`
- Worker health: `https://ai-saas-guard-hosted.zr9959.workers.dev/healthz` returns `scannerVersion: "0.43.0"`
- Real hosted PR smoke: PR `#91`, Check Run `77724168740`, conclusion `success`, temporary branch deleted, KV smoke records cleaned to `[]`
- 2026-05-26 read-only provider recheck: public health and install-info endpoints returned HTTP 200 with safe privacy flags; `wrangler deployments list` still showed Worker version `8744d3db-0114-4653-85e2-f1554ff1b26b`; KV had 28 compact records with TTL and no deletion was performed
- 2026-05-26 npm/npx recheck: npm `latest` remained `ai-saas-guard@0.43.0`; `npx --yes ai-saas-guard@latest demo --summary` ran successfully; no npm package was published because this was documentation/evidence-only
- 2026-05-26 staging rollback drill: rollback to v0.42 Worker version `6de0811e-11bf-46a6-9b7b-cbecda409695` passed health/privacy checks, then restore to v0.43 Worker version `8744d3db-0114-4653-85e2-f1554ff1b26b` passed health/privacy checks
- 2026-05-26 deletion drill: dedicated test compact KV key under `scan:135085075:900000526:` was created and deleted by exact key; existing project scan evidence was not deleted; full GitHub App uninstall/repository-removal proof still needs a safe test installation
- 2026-05-26 human support routing: `@zr9959` is primary hosted staging incident/support owner, public-safe hosted support has a GitHub issue template, sensitive reports route to private vulnerability reporting, and missing independent backup coverage falls back to pausing hosted beta
- 2026-05-26 GitHub App management proof attempt: temporary private repo `zr9959/ai-saas-guard-app-proof-20260526` was created, add-to-installation returned HTTP 403 because the session cannot modify the `ai-saas-guard-hosted` installation, and the temporary repo was deleted
- 2026-05-27 beta readiness review: local `main` was clean and in sync before the review branch, later handoff-drift recheck found current `main` HEAD `48587b0`, latest observed CI/CodeQL/Metrics/Cross-Project Discovery runs succeeded, issue `#93` still had no real DP feedback, and issue `#94` still had deployed source-checkout/full deletion/provider monitoring blockers

Latest release verification passed:

```bash
npm test
npm audit --audit-level=high --registry=https://registry.npmjs.org
npm pack --dry-run --json
uvx zizmor --offline .github/workflows
go run github.com/rhysd/actionlint/cmd/actionlint@latest
node dist/cli.js scan --root . --json
node dist/cli.js pr-risk --root . --json
node dist/cli.js scan --root . --sarif
npx wrangler deploy --dry-run
npx wrangler deploy
node scripts/hosted-pr-smoke.mjs --evidence-file /tmp/ai-saas-guard-hosted-smoke-v0.43.json
```

CI for PR `#92` passed: test, fuzz, actionlint, zizmor, and CodeQL. The hosted `ai-saas-guard PR risk` Check Run was skipped as expected for the repository's current hosted smoke behavior.

Post-release docs-only execution:

- `3177e99 docs: add codex handoff and beta evidence intake`
- `58cb8dc docs: record public beta evidence intake status`
- GitHub issue `#93` tracks design-partner feedback intake
- GitHub issue `#94` tracks provider evidence before hosted public beta
- PR `#95` merged the docs-only handoff/evidence/runbook branch into `main` as merge commit `9f780bc9151502e4e9cc674fa0c220457e1ae8d7`
- post-merge read-only provider check kept Worker version at `8744d3db-0114-4653-85e2-f1554ff1b26b`, public endpoints healthy, and 15 compact KV records with TTL untouched
- post-PR `#96` read-only provider recheck kept Worker version at `8744d3db-0114-4653-85e2-f1554ff1b26b`, public endpoints healthy, and 21 compact KV records with TTL untouched
- `docs/hosted-operator-runbook.md` documents the minimum operator workflow, but still needs deployed-artifact exercises before it counts as provider evidence
- `npm run build && node --test tests/hosted-beta.test.mjs` passed with 2 tests
- latest post-merge Phase 4 recheck returned `readyForPublicBeta: false`
- latest post-merge Phase 5 recheck returned `readyForTeamUse: false`
- latest post-PR `#96` Phase 4 recheck returned `readyForPublicBeta: false`
- latest post-PR `#96` Phase 5 recheck returned `readyForTeamUse: false`

## Data, Environment, And Third-Party Configuration

Database changes:

- No application database schema or customer database migration was added.
- The live hosted ingress uses Cloudflare KV namespace binding `HOSTED_EVENTS` for compact delivery/scan records only.
- Current KV evidence after v0.43 smoke cleanup: staging smoke keys returned `[]`.
- Supabase files in this repository are fixtures/examples only, not a connected production database.

Environment variables and secrets:

- Cloudflare Worker public env/config includes `SCANNER_VERSION: "0.43.0"`, `GITHUB_APP_ID: "3834787"`, `GITHUB_APP_SLUG: "ai-saas-guard-hosted"`, and `GITHUB_APP_INSTALLATION_ID: "135085075"`.
- Cloudflare secrets are expected for `WEBHOOK_SECRET` and `GITHUB_APP_PRIVATE_KEY`; do not commit or print their values.
- npm publishing uses GitHub Actions Trusted Publisher/OIDC. Do not add long-lived npm tokens.
- No `.env` file, raw private key, raw webhook secret, installation token, database URL, or customer payload should be committed.

Third-party services:

- GitHub repo: `zr9959/ai-saas-guard`
- GitHub App: `ai-saas-guard-hosted`, App ID `3834787`, installation ID `135085075`, selected-repository access to `zr9959/ai-saas-guard`
- Cloudflare Worker: `ai-saas-guard-hosted` at `https://ai-saas-guard-hosted.zr9959.workers.dev`
- Cloudflare KV binding: `HOSTED_EVENTS`
- npm package: `ai-saas-guard`
- OpenSSF Best Practices project: `12955`

## Security Risk Register

Known constraints and risks:

- The live Cloudflare Worker is still a hosted ingress that fetches PR file metadata and publishes compact Check Runs. It is not yet a deployed full source-checkout scan worker.
- Source checkout runner code and gates exist, but deployed source-checkout worker sandbox, provider monitoring, provider rollback, and incident-response evidence still need real provider evidence before external beta.
- Hosted beta/team gates exist in code but are readiness evaluators, not proof of real external usage.
- Do not claim pentest, full audit, certification, or general AI reviewer.
- Keep all local scans deterministic, no LLM calls, no code upload, no default network calls.
- Do not store raw webhook bodies, PR title/body text, raw diffs, source, secrets, customer payloads, checkout paths, or installation tokens.
- Continue updating both `README.md` and `docs/README.zh-CN.md` for every public release or feature-positioning change.
- Clean `/tmp` artifacts, package tarballs, smoke branches/PRs, staging KV records, and long-running test/dev processes after each task.

## SEO, GEO, Admin, And Mobile Notes

SEO/GEO:

- Current public discoverability is README/npm/GitHub-driven; no website, landing page, sitemap, search-console setup, analytics, or geographic targeting has been implemented.
- Public copy should lead with buyer pain in simple English and keep Chinese README parity.
- Do not add tracking/analytics that could collect source, diffs, PR text, customer payloads, or personal data without a separate privacy review.

Backend/admin:

- No admin dashboard exists.
- Current operational controls are code-level gates, Cloudflare deployment, GitHub App config, KV cleanup, and release evidence docs.
- Before any public beta, define a privacy-safe operator workflow for pausing hosted processing, checking queue depth, reviewing failure counts, deleting compact records, and rollback.

Mobile:

- There is no mobile app and no mobile-specific UI.
- README/docs should remain readable on mobile, but no responsive web app or mobile browser testing has been performed because the product is currently CLI/GitHub/npm/Check Run focused.

## Repository Boundaries

Allowed in this public repository:

- CLI source code
- tests and intentionally vulnerable fixtures
- public docs
- English README and Chinese README; when `README.md` changes, review and update `docs/README.zh-CN.md` in the same change
- GitHub Action wrapper
- examples that contain only inert fake data
- release-quality process docs

Not allowed:

- private source, docs, credentials, strategy notes, or private research from unrelated projects
- real API keys, tokens, cookies, webhook secrets, certificates, private URLs, database URLs, or customer data
- local machine-only paths
- generated private logs or AI conversation dumps

## Next Work Priority

Recommended order:

1. Open implementation issues only after choosing the next hosted build target.
2. Do not build paid hosted features without following `docs/hosted-pricing-packaging.md`.

For every feature, keep the scanner evidence-first:

- rule ID
- severity
- file/path evidence
- why it matters
- suggested verification
- suggested fix direction
- vulnerable fixture
- safe fixture
- tests for both

## Commercial Direction

The open-source core should remain useful on its own:

- local CLI
- deterministic rules
- JSON/SARIF output
- GitHub Action
- rule docs and fixtures

Potential paid layer:

- hosted GitHub App
- PR comments and review-first annotations
- saved/shareable reports
- scan history
- team policy settings
- deeper Stripe/Supabase/Vercel integrations
- optional human launch-readiness review

The differentiation is not "another generic scanner." The product angle is AI-SaaS launch readiness and PR review triage for founders shipping with AI tools.

## New Conversation Starter

Paste this into a new ChatGPT/Codex Project or conversation:

```text
Please take over this project. First read these files and follow their product direction, current status, repository boundaries, and release gate:

docs/project-handoff.md
docs/CODEX_AGENT_WORKING_RULES.md
docs/release-quality-knowledge-base.md

GitHub repo:
https://github.com/zr9959/ai-saas-guard

Important constraints:
- Keep this public repo separate from unrelated private projects.
- Do not publish private files, private research, credentials, or local secrets.
- Before publishing any CLI, GitHub Action, npm package, plugin, or public repo update, run the release gate in docs/release-quality-knowledge-base.md.
- Prefer focused, evidence-first scanner rules with tests and fixtures.
```

## Quick Orientation Commands

```bash
git status --short
git log --oneline -5
rg --files
npm ci
npm test
node dist/cli.js scan --root . --json
```
