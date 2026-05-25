<h1 align="center">ai-saas-guard</h1>

<p align="center">
  <strong>You used AI to build your SaaS. Now find the launch risks before users do.</strong>
</p>

<p align="center">
  A local-first launch gate for AI-built Next.js, Supabase, Stripe, Vercel, GitHub Actions, and MCP SaaS apps. It focuses on auth, billing, data access, secrets, MCP, and deploy paths, then turns risky files into a short review queue before launch or merge. It runs locally, reads your repo only, and does not upload code.
</p>

<p align="center">
  It is not a pentest. It is a practical, evidence-first review queue for the code that can break launch.
</p>

<p align="center">
  English | <a href="docs/README.zh-CN.md">中文 README</a>
</p>

<p align="center">
  <a href="https://github.com/zr9959/ai-saas-guard/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/zr9959/ai-saas-guard/actions/workflows/ci.yml/badge.svg"></a>
  <a href="https://www.bestpractices.dev/projects/12955"><img alt="OpenSSF Best Practices" src="https://www.bestpractices.dev/projects/12955/badge"></a>
  <a href="https://www.npmjs.com/package/ai-saas-guard"><img alt="npm" src="https://img.shields.io/npm/v/ai-saas-guard.svg"></a>
  <a href="LICENSE"><img alt="License: MIT" src="https://img.shields.io/badge/license-MIT-blue.svg"></a>
  <a href="package.json"><img alt="Node.js >=20" src="https://img.shields.io/badge/node-%3E%3D20-339933.svg"></a>
  <a href="docs/release-quality-knowledge-base.md"><img alt="Release gate documented" src="https://img.shields.io/badge/release%20gate-documented-0f766e.svg"></a>
</p>

---

## Before You Invite Users

AI-built SaaS can look ready before it is ready: login works, checkout opens, the dashboard loads, and tests are green. The launch risk is usually hidden in trust-boundary code that decides who gets access, who pays, what data they can see, and whether failures are visible.

Start with the 30-second copy-paste demo: `npx ai-saas-guard@latest demo --summary`. No signup, no code upload, no LLM call. See the [terminal screenshot](docs/demo-terminal-screenshot.svg), [saved output](docs/demo-terminal-output.txt), [compare with alternatives](docs/launch-gate-positioning.md), and the [30-second cold-start review](docs/cold-start-review.md).

These are the failures that hurt after real users arrive:

- one customer can see or change another customer's data
- Stripe grants access from an unsigned, duplicated, missing, or failed webhook path
- Clerk or Prisma code trusts user-writable metadata or an unscoped tenant query
- provider errors get swallowed and the app returns fake success or demo data
- a secret leaks through env config or `NEXT_PUBLIC_*`
- an MCP tool, GitHub workflow, or deploy job has more power than the launch needs
- a Next/Vercel deploy is missing production env docs, security headers, request IDs, or cost-risk hints
- a large AI PR hides auth, billing, data, deploy, or test changes inside harmless-looking work

`ai-saas-guard` gives you a short local review queue for those risks. It does not prove the app is secure, certify a release, or replace human review. It tells founders, solo builders, small teams, and reviewers what deserves attention first.

## 30-Second Copy-Paste Demo

No signup, no code upload, no LLM call:

```bash
npx ai-saas-guard@latest demo --summary
```

The demo scans two packaged fixtures: one risky AI-built SaaS and one safer version. See the [terminal screenshot](docs/demo-terminal-screenshot.svg) or saved terminal sample in [docs/demo-terminal-output.txt](docs/demo-terminal-output.txt), then compare with alternatives in [docs/launch-gate-positioning.md](docs/launch-gate-positioning.md).

## 60-Second Local Check

See the public demo output without cloning a repo:

```bash
npx ai-saas-guard@latest demo --summary
```

Run it against your app without installing anything globally:

```bash
npx ai-saas-guard@latest scan --root /path/to/your-saas --summary
```

For an AI-heavy pull request:

```bash
npx ai-saas-guard@latest pr-risk --root /path/to/your-saas --base origin/main --markdown
```

The summary starts with the launch gate, top risks, manual proof steps, and next actions. Rerun without `--summary` for every finding with rule IDs, severity, file evidence, why it matters, manual verification, and fix direction. The scanner is deterministic, read-only, and does not call an LLM.

## Try The Demo Fixtures

Want to see the report before scanning your own repo?

```bash
npx ai-saas-guard@latest demo --summary
```

The demo command uses packaged public fixtures: `examples/demo-risky-saas` currently returns 19 intentional findings across Stripe, Supabase, silent-success paths, Next/Vercel deploy hints, and GitHub Actions; `examples/demo-safe-saas` returns 0 findings for the same broad surfaces with safer static patterns. Rerun `demo` without `--summary` for the full human-readable report, or see [docs/demo-quickstart.md](docs/demo-quickstart.md) if you want to inspect the fixture files locally.

## See The Output

The report is designed to be read before launch or before merging an AI-heavy PR. A longer copy-paste example is in [docs/sample-launch-report.md](docs/sample-launch-report.md).

```text
ai-saas-guard scan summary
Findings: 19 findings: 2 critical, 6 high, 7 medium, 3 low, 1 info
Launch gate: blocked: critical launch-readiness findings need review before inviting users

Top risks:
- CRITICAL stripe.webhook.missing-signature at app/api/stripe/webhook/route.ts:1 - Stripe webhook does not verify the Stripe signature
- CRITICAL supabase.rls.broad-policy at supabase/migrations/001_accounts.sql:10 - Broad Supabase RLS policy on public.accounts
- HIGH silent-success.swallowed-error at app/api/billing/checkout/route.ts:4 - Catch block may turn upstream failure into success

Manual proof to run next:
- Send a request without a valid Stripe signature and confirm the handler rejects it before changing entitlement state.
- Run the generated two-account IDOR test and confirm User B cannot read, update, or delete User A resources.
- Force the upstream billing call to fail and confirm the route returns an error, not fake success.

Next steps
- Fix critical and high trust-boundary findings first.
- Run the manual proof steps in staging and confirm each risky path fails closed.
```

## What You Get

One command returns a launch-readiness report with:

- a plain launch-gate verdict at the top of terminal and Markdown output
- risky files sorted before cosmetic files
- rule ID, severity, and file evidence
- why the finding matters for an AI-built SaaS launch
- manual verification steps you can actually run
- practical fix direction, not generic advice
- short `--summary`, terminal, JSON, SARIF, and PR markdown output for local review or CI

## Problems It Helps You Catch

| Launch question | What ai-saas-guard checks |
| --- | --- |
| Can users only access their own data? | Supabase RLS, tenant/owner predicates, storage policies, API ownership hints, two-account verification guidance |
| Can auth metadata be trusted? | Clerk unsafe metadata used for roles, plans, tenant membership, or entitlements |
| Will billing change access correctly? | Stripe webhook signature, raw body, idempotency, entitlement paths, failure/cancel/update/refund coverage |
| Will broken integrations fail visibly? | Silent-success fallbacks, swallowed errors, hardcoded success responses, production mock/demo data, skipped or placeholder tests |
| Will production behave like local? | Next/Vercel headers, env docs, public env inventory, image/request amplification hints, request ID logging, Vercel cron guard hints |
| Are tools and CI overpowered? | MCP side-effect classes, local policy/receipt templates, GitHub Actions permissions, concurrency, checkout depth, action pinning |
| Can reviewers trust the PR? | `pr-risk` ranking for auth, billing, RLS, deploy, API, storage, tests, silent-success paths, missing spec context, and large AI diffs |

For a concise comparison with Semgrep, zizmor, OpenSSF Scorecard, Snyk, and GitHub code scanning, see [docs/launch-gate-positioning.md](docs/launch-gate-positioning.md).

## Quick Start

Run the published CLI without installing it globally:

```bash
npx ai-saas-guard@latest demo --summary
npx ai-saas-guard@latest scan --root /path/to/your-saas --summary
```

Run focused checks:

```bash
npx ai-saas-guard@latest pr-risk --root /path/to/your-saas --base origin/main
npx ai-saas-guard@latest check-supabase --root /path/to/your-saas
npx ai-saas-guard@latest check-supabase --root /path/to/your-saas --doctor
npx ai-saas-guard@latest check-stripe --root /path/to/your-saas
npx ai-saas-guard@latest check-mcp --root /path/to/your-saas
npx ai-saas-guard@latest check-mcp --root /path/to/your-saas --policy-template
npx ai-saas-guard@latest check-actions --root /path/to/your-saas
```

Short or machine-readable output:

```bash
npx ai-saas-guard@latest scan --root /path/to/your-saas --summary
npx ai-saas-guard@latest scan --root /path/to/your-saas --json
npx ai-saas-guard@latest scan --root /path/to/your-saas --sarif > ai-saas-guard.sarif
npx ai-saas-guard@latest pr-risk --root /path/to/your-saas --base origin/main --markdown > ai-saas-guard-pr.md
npx ai-saas-guard@latest scan --root /path/to/your-saas --config <file> --json
npx ai-saas-guard@latest scan --root /path/to/your-saas --fail-on high
```

For local development:

```bash
git clone https://github.com/zr9959/ai-saas-guard.git
cd ai-saas-guard
npm ci
npm run build
node dist/cli.js scan --root /path/to/your-saas
```

Run focused checks:

```bash
node dist/cli.js pr-risk --root /path/to/your-saas --base origin/main
node dist/cli.js check-supabase --root /path/to/your-saas
node dist/cli.js check-stripe --root /path/to/your-saas
node dist/cli.js check-mcp --root /path/to/your-saas
node dist/cli.js check-actions --root /path/to/your-saas
```

## Current Status

This repository is public on GitHub.

The CLI is published on npm as `ai-saas-guard`, and the GitHub Action is available through versioned release tags. Use `v0` for the latest compatible pre-1.0 Action, a specific release tag for controlled upgrades, or a reviewed commit SHA for stricter supply-chain pinning.

| Area | Status |
| --- | --- |
| Public GitHub repository | Available |
| npm CLI | `ai-saas-guard@0.34.0` |
| GitHub Action | `zr9959/ai-saas-guard@v0` or fixed tag `v0.34.0` |
| Outputs | Short summary, terminal, JSON, SARIF, and PR-focused markdown |
| Project config | `.ai-saas-guard.json` rule toggles, severity overrides, suppressions, and fail thresholds |
| Privacy model | Local-first, read-only scan commands, no LLM calls, no code upload |
| Versioned Action tags | `v0.34.0`, `v0` |
| Current release | `0.34.0` adds a visual demo screenshot, tightens first-run demo output, adds a concise competitor-positioning line, and improves hosted Check Run reviewer checklist wording |
| npm publishing | Trusted Publisher/OIDC, no long-lived publish token |
| Repository trust hardening | Strict branch protection, Dependabot, CodeQL, fast-check fuzzing, signed release provenance assets, private vulnerability reporting, secret scanning, and push protection |
| Cloudflare hosted ingress | Deployed at `https://ai-saas-guard-hosted.zr9959.workers.dev`; signed GitHub App webhook delivery and compact Check Run smoke now pass in staging |
| Hosted GitHub App staging | Private App `ai-saas-guard-hosted` (`3834787`) installed on `zr9959/ai-saas-guard`; hosted operations evidence is in [docs/hosted-operations-evidence.md](docs/hosted-operations-evidence.md) |
| OpenSSF Best Practices | Passing badge, project `12955`; `.bestpractices.json` remains the conservative evidence record |

## Example Finding

Terminal output is designed to be useful to a reviewer, not just a scanner dashboard.

```text
[HIGH] Stripe webhook lacks obvious duplicate event idempotency
Rule: stripe.webhook.missing-idempotency
Why: Stripe can retry and deliver duplicate events; without storing processed event IDs, access grants and revocations can drift.
Verify: Replay the same Stripe event ID twice and confirm the second delivery does not create duplicate fulfillment or inconsistent state.
Fix direction: Persist processed Stripe event IDs and make entitlement updates idempotent around event ID and subscription/customer IDs.
Evidence:
- app/api/stripe/webhook/route.ts:41 -> switch (event.type) {
```

## What It Checks

| Surface | Examples of risks it flags |
| --- | --- |
| Secrets and env | Secret-like values, risky `NEXT_PUBLIC_*` exposure |
| Stripe | Missing webhook route, unsigned webhook handling, parsed-body signature risk, missing idempotency, missing failure/cancel/update/refund paths |
| Supabase | RLS disabled on sensitive tables, broad `USING`/`WITH CHECK`, tenant membership patterns, weak write checks, storage object policy scope |
| Silent success | Swallowed provider errors, hardcoded fallback success, production mock/demo data in sensitive paths, temporary trust-boundary bypasses, skipped or placeholder tests |
| API routes | Auth checks without obvious ownership guards, Clerk unsafe metadata, Prisma tenant-scope gaps, missing rate-limit hints on sensitive mutation routes |
| MCP | Plaintext secrets, non-localhost binds, broad filesystem/write access, shell tools, raw SQL tools, side-effect classification, local policy and receipt template |
| Next/Vercel deploy | Static export/runtime mismatches, Edge runtime with Node-only APIs, missing security headers, undocumented server env, public env inventory, image/request amplification hints, missing request ID logging, unguarded Vercel cron routes |
| GitHub Actions | Broad workflow permissions, stale PR runs, docs-only full CI, missing fail-fast secret checks, shallow `pr-risk` checkout, unpinned Action refs |
| PR risk | Auth, billing, RLS, env, deploy, API, storage, silent-success, test-removal, missing spec context, and large mixed-diff classification |

See [docs/rules.md](docs/rules.md) for the full rule map.

## The Main Bet: PR Risk Triage

Most scanners start with "scan the whole repository." `ai-saas-guard` can do that, but its sharper wedge is pull request review.

AI-generated PRs often combine unrelated work:

- UI polish
- auth/session changes
- database migrations
- Stripe checkout edits
- Supabase policies
- Vercel config
- removed or weakened tests

`pr-risk` classifies the current diff and returns:

- top risky files to review first
- sensitive categories touched by the PR
- review-first checklist
- suggested PR split
- required tests or manual verification
- explicit git-diff diagnostics when a base ref or shallow checkout prevents PR classification
- PR-focused markdown for GitHub step summaries or PR comments

```bash
node dist/cli.js pr-risk --root /path/to/your-saas --base origin/main --json
node dist/cli.js pr-risk --root /path/to/your-saas --base origin/main --markdown
```

If `--base` cannot be resolved, `pr-risk` emits `pr-risk.diff-unavailable` instead of silently reporting a clean or empty diff. In GitHub Actions, use `actions/checkout` with `fetch-depth: 0` when you need merge-base comparison against `origin/main`.

## Commands

| Command | Purpose |
| --- | --- |
| `scan` | Broad local launch preflight across secrets, Stripe, Supabase, MCP, API routes, and deploy config |
| `pr-risk` | Classify the current git diff or a base branch diff for review priority; supports JSON, SARIF, and PR-focused markdown |
| `check-supabase` | Inspect migrations and policy files for RLS and ownership risks; use `--doctor` for static RLS debugging steps and SQL cookbook output |
| `check-stripe` | Inspect webhook handlers and billing lifecycle coverage |
| `check-mcp` | Inventory MCP configs and classify side effects; use `--policy-template` for a local allow/deny policy and tool-call receipt format |
| `check-actions` | Inspect GitHub Actions hygiene that affects AI-built SaaS launch readiness |

## Launch Readiness Checklist

Use [docs/launch-readiness-checklist.md](docs/launch-readiness-checklist.md) when an app is close to inviting real users. It explains how to combine `ai-saas-guard` output with manual two-account authorization testing, Stripe webhook verification, MCP config review, Supabase policy review, deploy checks, rollback planning, and a clear reminder that this is not a full security audit.

## Repository Trust Hardening

See [docs/repository-trust-hardening.md](docs/repository-trust-hardening.md) for the public repository controls behind this release line: strict branch protection, required CI checks, Dependabot for npm and GitHub Actions, CodeQL SAST, fast-check fuzz/property tests, signed GitHub release assets backed by npm trusted publishing provenance, private vulnerability reporting, secret scanning, and push protection.

The latest GitHub releases mirror the npm package tarball and attach `*.tgz.sigstore.json` plus `*.tgz.intoto.jsonl` provenance assets. These assets are generated from npm provenance, with the tarball digest checked against the npm registry metadata before upload.

The current Scorecard improvement track focuses on real controls, not cosmetic score gaming: stricter review gates, detectable fuzzing, and the OpenSSF Best Practices Badge process. Some Scorecard items, such as repository age, contributor diversity, and reviewed PR history, improve only through time and normal public maintenance.

The repository now has an [OpenSSF Best Practices passing badge](https://www.bestpractices.dev/projects/12955). [.bestpractices.json](.bestpractices.json) remains the conservative evidence record for the public project entry. `dynamic_analysis_enable_assertions` is still intentionally marked unmet until runtime assertion coverage is broader than the current test, property, and fuzz assertions.

## Stripe Webhook Replay

Use [docs/stripe-webhook-replay.md](docs/stripe-webhook-replay.md) after `check-stripe` flags missing signature verification, idempotency, lifecycle handlers, or entitlement updates. The cookbook maps findings to concrete `stripe listen` and `stripe trigger` commands for checkout success, failed renewal, subscription update, cancellation, refund, duplicate delivery, and out-of-order event review.

## Hosted GitHub App Design

See [docs/github-app-design.md](docs/github-app-design.md) for the proposed hosted GitHub App layer. The note covers least-privilege permissions, selected repositories, webhook verification, PR comments, check runs, privacy, data retention, prompt injection handling, and why the hosted app should not replace the local CLI.

The first hosted service slice is defined in [docs/hosted-first-service-slice.md](docs/hosted-first-service-slice.md). It is intentionally check-run-only: signed GitHub App webhook intake, trusted scan identity, idempotent scan queueing, read-only worker behavior, compact report storage, and no PR comments, dashboard, billing, or AI summaries.

The hosted deployment model is documented in [docs/hosted-deployment-model.md](docs/hosted-deployment-model.md). It chooses a containerized Node.js ingress and worker model with a managed durable queue, platform secret manager, structured redacted logs, installation/repository rate limits, and rollback/incident response paths.

The hosted service runtime is documented in [docs/hosted-service-runtime.md](docs/hosted-service-runtime.md). It exports `createHostedServiceRuntime` from `ai-saas-guard/hosted/service` and implements the provider-independent service core for signed webhook intake, idempotent queue upsert, read-only worker orchestration, compact report storage, Check Run publication adapters, and worker cleanup planning. It does not deploy a public hosted environment by itself.

The hosted GitHub App deployment planner is documented in [docs/github-app-deployment.md](docs/github-app-deployment.md). It exports `planHostedGitHubAppDeployment` from `ai-saas-guard/hosted/github-app`, generates the least-privilege manifest for the first hosted slice, and blocks creation when the release gate, public HTTPS URLs, container digest, secret references, raw secret inputs, permissions, or events are incomplete or unsafe.

The hosted production adapter layer is documented in [docs/hosted-production-adapters.md](docs/hosted-production-adapters.md). It exports `createHostedGitHubAppJwt`, `planHostedGitHubInstallationTokenRequest`, and `planHostedProductionWorkerExecution` from `ai-saas-guard/hosted/production-adapters`. It adds RS256 GitHub App JWT generation, selected-repository installation-token request plans, separate worker and Check Run token scopes, a fixed read-only worker command, bounded timeout and output budgets, compact JSON-only output, and cleanup plans for success, failure, timeout, and cancellation. It still does not expose a public hosted service by itself.

The hosted read-only checkout worker is exported from `ai-saas-guard/hosted/worker`. It creates a temporary checkout from trusted GitHub App identity, uses a runtime installation token only through git askpass, removes askpass material before the CLI phase, rejects mutated command/checkout/token-scope plans, runs the fixed `ai-saas-guard pr-risk --json` command with bounded timeout/output, converts CLI JSON into compact findings, and deletes the checkout after success or failure. It does not return source, diffs, secrets, checkout paths, PR-authored commands, or installation tokens.

The hosted Node/container app skeleton is documented in [docs/hosted-node-container-app.md](docs/hosted-node-container-app.md). It exports `createHostedHttpApp`, `createInMemoryHostedAppPlatform`, `createHostedNodeCheckoutAppPlatform`, and `planHostedNodeContainerDeployment` from `ai-saas-guard/hosted/app`. It adds a safe `/healthz` route, signed `/github/webhook` ingress, one-job worker tick, in-memory provider adapters for tests, a concrete read-only checkout worker composition with visible timeout/output safety budgets, and deployment-plan validation for secret manager, queue, compact report store, worker sandbox, and GitHub Checks publisher references. It still does not deploy or expose a public hosted service by itself.

The hosted staging deployment planner is documented in [docs/hosted-staging-deployment.md](docs/hosted-staging-deployment.md). It exports `planHostedProviderBinding`, `planHostedStagingDeployment`, and `planHostedGitHubAppPromotion` from `ai-saas-guard/hosted/staging`. It composes real provider references, the Node/container deployment plan, hosted operational release-gate evidence, and GitHub App deployment planning so staging and production promotion stay blocked until the required queue, store, worker sandbox, Check Run publisher, logs, metrics, rollback, and incident-response references are present. It still does not call a cloud provider, create a GitHub App, or expose a public hosted service by itself.

The hosted staging harness is documented in [docs/hosted-staging-harness.md](docs/hosted-staging-harness.md). It exports `createFileBackedHostedStagingHarness`, `createHostedStagingHarnessEvidence`, `createHostedStagingReleaseEvidenceBundle`, `evaluateHostedStagingReleaseEvidenceBundle`, and `validateHostedLogBoundary` from `ai-saas-guard/hosted/staging-harness`. It runs signed webhook replay through the provider-independent hosted runtime with local file-backed queue, compact report, and Check Run adapters, verifies worker sandbox cleanup, turns success/failure cleanup probes plus log-boundary samples into release-gate evidence, and evaluates the hosted gate without cloud calls. It is a staging rehearsal tool only; it does not call cloud providers, create a GitHub App, publish live Check Runs, or expose a public hosted service.

Deployed worker staging evidence is documented in [docs/hosted-deployed-worker-staging.md](docs/hosted-deployed-worker-staging.md). It exports `createHostedDeployedWorkerStagingEvidenceAutomation`, `createHostedDeployedWorkerStagingEvidenceBundle`, and `evaluateHostedDeployedWorkerStagingReleaseGate` from `ai-saas-guard/hosted/deployed-staging`. It validates safe log samples, then turns public HTTPS health, signed webhook replay, deployed worker cleanup, and external CI/scan/rollback evidence into the hosted release gate for a Node/container read-only checkout worker candidate. It does not deploy cloud resources or claim production hosted exposure.

The first live hosted ingress is deployed on Cloudflare Workers at `https://ai-saas-guard-hosted.zr9959.workers.dev` and documented in [hosted/cloudflare-worker/README.md](hosted/cloudflare-worker/README.md). It exposes `/healthz`, `/github/app/manifest-callback`, and signed `/github/webhook` intake backed by Cloudflare KV. A private staging GitHub App, `ai-saas-guard-hosted`, is installed on `zr9959/ai-saas-guard` with selected-repository access and the first-slice permission contract. The Worker verifies signatures, stores compact pull request identity records, exchanges a scoped installation token, fetches PR file metadata from GitHub, classifies PR-risk hotspots, and publishes a bounded Check Run summary. Current deployed evidence is tracked in [docs/hosted-operations-evidence.md](docs/hosted-operations-evidence.md): health, signed webhook delivery, compact KV records, cleanup, and Check Run publication pass for the staging smoke. The Cloudflare Worker still does not run a full source checkout scan worker or store raw webhook payloads, PR title/body text, raw diffs, source, secrets, checkout paths, or installation tokens.

The hosted operational release gate is documented in [docs/hosted-operational-release-gate.md](docs/hosted-operational-release-gate.md). It defines the hosted-specific CI, replay, queue, worker cleanup, privacy, monitoring, rollback, and incident-response evidence required before any hosted environment is exposed to users. The pure gate evaluator exported from `ai-saas-guard/hosted/contracts` blocks hosted exposure unless every P0 evidence item is fresh, a container digest is recorded, and release notes avoid pentest, certification, and full-audit claims.

Hosted uninstall and data deletion behavior is documented in [docs/hosted-uninstall-data-deletion.md](docs/hosted-uninstall-data-deletion.md). It defines repository removal, full app uninstall, compact report deletion, queue cancellation, audit record retention, repeated cleanup, and user-facing deletion wording.

Hosted pricing and packaging boundaries are documented in [docs/hosted-pricing-packaging.md](docs/hosted-pricing-packaging.md). Core local scanning stays useful without an account; hosted plans may add workflow convenience, saved reports, team policy, and optional human review, but they do not gate local CLI scanning.

Hosted pre-implementation pure contracts are documented in [docs/hosted-preimplementation-contracts.md](docs/hosted-preimplementation-contracts.md). They now include a pull request webhook intake planner that verifies signatures before parsing or queueing, a durable scan queue planner that reuses queued, running, and completed jobs for the same trusted scan key, a worker read-only scan planner that fixes the CLI command and requires repository `contents: read`, a concrete Node read-only checkout scan runner, and a Check Run publication planner that requires repository `checks: write` and builds bounded check-only payloads from compact reports. They also cover queue-safe webhook event parsing, bounded check-run summary rendering, idempotent queue cleanup planning, worker checkout cleanup planning, a retention/deletion cleanup planner, an operational release gate evaluator, the production adapter plans needed for GitHub App auth and bounded worker execution, the Node/container app skeleton needed for real provider wiring, the staging deployment planner needed before production GitHub App promotion, the local staging harness needed to rehearse webhook replay, persistence, publication, and cleanup without cloud calls, and the deployed worker staging evidence helper needed to evaluate public HTTPS health, deployed cleanup, and log-boundary evidence without storing raw hosted data. The service runtime composes these contracts behind replaceable adapters. PR comments remain a later workflow or paid hosted feature, not part of the hosted MVP contract.

A public hosted compact report schema fixture is available at [examples/hosted-compact-report.json](examples/hosted-compact-report.json). It is synthetic and public-safe: compact evidence only, no raw source, raw diffs, secrets, webhook payload bodies, customer payloads, private URLs, or worker checkout paths.

The proposed hosted app permission boundary is intentionally narrow: repository contents read, pull requests read, checks write, and metadata read for the first version. Optional PR comments require repository policy opt-in, and broad permissions such as administration, deployments, Actions write, and repository secrets are out of scope.

The repository also includes hosted contract helpers and runtime tests for webhook intake order, webhook verification, installation token scoping, durable queue idempotency, compact reports, retention limits, uninstall cleanup, repeated cleanup idempotency, scoped deletion planning, operational release gate blocking, provider-independent hosted service orchestration, and GitHub App deployment planning. These helpers do not deploy a public hosted service.

Users should prefer the local CLI for private repositories, offline review, or no-account workflows where hosted code processing is not acceptable.

## Project Configuration

Add `.ai-saas-guard.json` at the repository root to tune findings without changing scanner code. The CLI auto-loads this file from `--root` when it exists. Use `--config <file>` to point to a different JSON file.

```json
{
  "failOn": "high",
  "rules": {
    "stripe.webhook.missing-signature": "off",
    "stripe.webhook.missing-idempotency": "critical",
    "deploy.env.example-missing": "info"
  },
  "suppressions": [
    {
      "ruleId": "stripe.webhook.missing-idempotency",
      "paths": ["app/api/stripe/webhook/route.ts"],
      "reason": "Temporary launch exception with duplicate-event coverage in integration tests."
    }
  ]
}
```

`rules` is keyed by published rule ID from [docs/rules.md](docs/rules.md). Set a rule to `off` to remove matching findings from terminal, JSON, SARIF, and markdown output. Set a rule to `critical`, `high`, `medium`, `low`, or `info` to override severity before summaries and `--fail-on` are evaluated.

Use `suppressions` for narrower false-positive handling when one rule is noisy only for specific generated files, fixtures, or reviewed exceptions. Each suppression must name a known `ruleId` and one or more relative `paths` globs, such as `generated/**` or `app/api/stripe/webhook/route.ts`.

`failOn` sets the default CI failure threshold for the project. A CLI `--fail-on` value takes precedence, so local runs can still use `--fail-on none` or a stricter threshold.

## GitHub Action

The repo includes a composite Action. Use `v0` for the latest compatible pre-1.0 Action, a specific release tag such as `v0.34.0` for controlled upgrades, or pin a reviewed commit SHA for stricter supply-chain control:

```yaml
name: ai-saas-guard

on:
  pull_request:

permissions:
  contents: read

jobs:
  preflight:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6.0.2
        with:
          fetch-depth: 0
      - uses: zr9959/ai-saas-guard@v0
        with:
          command: pr-risk
          root: ${{ github.workspace }}
          base: origin/main
          fail-on: high
          config: .ai-saas-guard.json
```

For SARIF upload:

```yaml
      - uses: zr9959/ai-saas-guard@v0
        with:
          command: scan
          format: sarif
          output: ai-saas-guard.sarif
      - uses: github/codeql-action/upload-sarif@v3
        with:
          sarif_file: ai-saas-guard.sarif
```

For PR-readable markdown in the Actions run:

```yaml
      - uses: zr9959/ai-saas-guard@v0
        with:
          command: pr-risk
          root: ${{ github.workspace }}
          base: origin/main
          format: markdown
          output: ai-saas-guard-pr.md
      - run: cat ai-saas-guard-pr.md >> "$GITHUB_STEP_SUMMARY"
```

Use markdown for reviewer-facing PR triage and SARIF for GitHub code scanning alerts. See [docs/github-action.md](docs/github-action.md) for copy-paste workflows and trade-offs.

For maximum reproducibility, replace `v0` with the full commit SHA from the release notes.

The GitHub Marketplace wrapper decision is documented in [docs/github-marketplace-wrapper-decision.md](docs/github-marketplace-wrapper-decision.md). The current decision is to keep this as one product repo and not create a separate listing wrapper yet.

## Ignore File

Add `.ai-saas-guardignore` at the repository root to suppress generated fixtures, snapshots, vendored output, or known noisy paths:

```gitignore
fixtures/**
snapshots/**
vendor/generated/**
```

Use this sparingly. The goal is not to hide launch blockers; it is to keep reports focused enough that reviewers act on them.

## Privacy Model

`ai-saas-guard` is designed to be safe to run against private local repositories.

- Runs locally.
- Reads repository files and git diffs.
- Makes no network calls during scan commands.
- Does not upload code.
- Requires no account or login.
- Does not modify scanned repositories.
- Limits scanned text by per-file and total scan budgets to reduce worst-case memory use.
- Redacts matched secret-like evidence.

## What This Is Not

This project deliberately avoids broad security claims.

- It is not a pentest.
- It is not a full SAST platform.
- It does not prove your app is secure.
- It does not replace manual two-account authorization testing.
- It does not execute Stripe, Supabase, Vercel, or browser flows.
- It does not inspect production settings unless they are represented locally.
- It does not try to replace Semgrep, Gitleaks, TruffleHog, Bearer, CodeQL, or human review.

## When To Use It

Use `ai-saas-guard` when:

- you are about to launch an AI-built SaaS MVP
- you are reviewing a large AI-generated pull request
- you added checkout, subscriptions, RLS, MCP tools, or deploy config
- you want a local, readable checklist before asking a human to review
- you need JSON or SARIF output for automation

Do not use it as the only launch approval signal. Treat it as a preflight that helps you decide where to spend review time.

## Development

```bash
npm ci
npm test
npm run build
node dist/cli.js scan --root .
```

Before publishing a CLI update, GitHub Action update, npm package, plugin, or public repository change, follow [docs/release-quality-knowledge-base.md](docs/release-quality-knowledge-base.md).

Contribution expectations are documented in [CONTRIBUTING.md](CONTRIBUTING.md), including pull request process, tests, rule-design requirements, release gate evidence, and public-safety constraints.

## Roadmap

Open-source core:

- local CLI
- deterministic scanner rules
- vulnerable and safe fixtures
- JSON, SARIF, and PR-focused markdown output
- GitHub Action wrapper
- rule documentation

Near-term priorities:

- Bind the Node/container read-only checkout worker to real provider references, deploy it behind staging queue/sandbox controls, and collect monitoring, rollback, incident-response, dependency, and container-scan evidence.
- Keep production hosted exposure blocked until the operational release gate has fresh evidence from the deployed checkout worker artifact.

Potential paid layer later:

- hosted GitHub App
- saved and shareable reports
- PR comments and review-first annotations
- scan history
- team policy settings
- deeper Stripe, Supabase, Vercel, and MCP integrations
- optional human launch-readiness review

The open-source CLI should remain useful on its own. Paid features should save time, preserve history, and integrate with team workflows.

## Security

Please read [SECURITY.md](SECURITY.md) before reporting vulnerabilities. Do not post real API keys, customer data, private source code, or production URLs in public issues.

## npm Publishing

The package is published as [`ai-saas-guard`](https://www.npmjs.com/package/ai-saas-guard). See [docs/npm-publishing.md](docs/npm-publishing.md) for the GitHub Actions Trusted Publisher workflow, provenance notes, and first-publish token history.
