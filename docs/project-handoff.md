# Project Handoff

Last updated: 2026-05-24

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
- hosted staging deployment planner document and helpers for provider binding, staging release-gate evidence, Node/container deployment composition, and production GitHub App promotion gating
- hosted staging harness document and helpers for local signed webhook replay, file-backed queue/report/Check Run artifacts, worker sandbox cleanup verification, and release-gate evidence fixtures without cloud calls
- live Cloudflare hosted ingress at `https://ai-saas-guard-hosted.zr9959.workers.dev` with `/healthz`, `/github/app/manifest-callback`, signed `/github/webhook` intake, Cloudflare KV storage, private staging GitHub App `ai-saas-guard-hosted` (`3834787`) installed on `zr9959/ai-saas-guard`, Worker code for scoped installation-token exchange, PR file metadata fetching, compact PR-risk classification, and bounded Check Run publishing, plus hosted operations evidence in `docs/hosted-operations-evidence.md`
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
- Current hosted mode: deployed Worker health, signed GitHub App webhook delivery, compact KV records, cleanup, and Check Run publication pass in staging; code supports signed webhook ingress, compact queueing, scoped GitHub App token exchange, PR file risk classification, bounded Check Run publishing, and a Node/container read-only checkout worker runner
- Not yet complete: deployed full source checkout scan worker with sandbox evidence, monitoring evidence, rollback evidence, incident-response evidence, production hosted exposure, and paid hosted workflow features

OpenSSF Best Practices:

- Project: https://www.bestpractices.dev/projects/12955
- Badge level: passing

Publishing:

- npm package: `ai-saas-guard`
- Current published release line: `v0.28.1` pending this branch release
- Next source candidate: none
- Publish workflow: `.github/workflows/npm-publish.yml`
- Trusted Publisher: GitHub Actions for `zr9959/ai-saas-guard`, workflow `npm-publish.yml`
- Long-lived npm publish tokens should not be required.

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
