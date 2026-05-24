<h1 align="center">ai-saas-guard</h1>

<p align="center">
  <strong>You used AI to build your SaaS. Now you need to know what is risky before launch.</strong>
</p>

<p align="center">
  ai-saas-guard points reviewers to the auth, billing, data access, secrets, MCP, and deploy changes that deserve human attention first. It runs locally, reads your repo only, and does not upload code.
</p>

<p align="center">
  It is not a pentest. It is a practical review checklist for launch-risk hotspots.
</p>

<p align="center">
  English | <a href="README.zh-CN.md">中文 README</a>
</p>

<p align="center">
  <a href="https://github.com/zr9959/ai-saas-guard/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/zr9959/ai-saas-guard/actions/workflows/ci.yml/badge.svg"></a>
  <a href="https://www.npmjs.com/package/ai-saas-guard"><img alt="npm" src="https://img.shields.io/npm/v/ai-saas-guard.svg"></a>
  <a href="LICENSE"><img alt="License: MIT" src="https://img.shields.io/badge/license-MIT-blue.svg"></a>
  <a href="package.json"><img alt="Node.js >=20" src="https://img.shields.io/badge/node-%3E%3D20-339933.svg"></a>
  <a href="docs/release-quality-knowledge-base.md"><img alt="Release gate documented" src="https://img.shields.io/badge/release%20gate-documented-0f766e.svg"></a>
</p>

---

## The Problem It Solves

AI can turn an idea into a working SaaS quickly. The harder question is whether the app is ready for real users.

The risky parts are often not the obvious UI bugs. They are the small changes that decide who can see data, who gets paid access, where secrets are exposed, and what an AI tool is allowed to do:

- Can one customer read another customer's data?
- Can a Stripe webhook grant access twice, miss a failed payment, or trust an unsigned request?
- Did a public environment variable expose a secret?
- Did an MCP tool get shell, database, or broad filesystem access?
- Did a pull request hide auth, billing, or deploy changes inside a large AI-generated diff?

`ai-saas-guard` is a local-first, review-first preflight for that moment. It does not try to prove your app is secure. It is not a pentest, certification, or full audit. It gives founders, solo builders, small teams, and reviewers a short, evidence-backed list of what to check before launch or merge.

## What You Get

Run it against a repository or pull request and get findings with:

- the rule that matched
- severity and file evidence
- why the issue matters in a SaaS launch
- how to verify it manually
- a practical fix direction

It is built for common AI-SaaS stacks:

- Next.js and Vercel
- Supabase row-level security and storage policies
- Stripe checkout, subscriptions, and webhooks
- Prisma or SQL migrations
- MCP server configuration
- AI-generated pull requests with large mixed diffs

## Current Status

This repository is public on GitHub.

The CLI is published on npm as `ai-saas-guard`, and the GitHub Action is available through versioned release tags. Use `v0` for the latest compatible pre-1.0 Action, a specific release tag for controlled upgrades, or a reviewed commit SHA for stricter supply-chain pinning.

| Area | Status |
| --- | --- |
| Public GitHub repository | Available |
| npm CLI | Published as `ai-saas-guard` |
| Local CLI from source | Available for development |
| JSON and SARIF output | Available |
| Composite GitHub Action | Available |
| Project config | `.ai-saas-guard.json` rule toggles, severity overrides, and fail thresholds |
| Versioned Action tags | `v0.24.0`, `v0` |
| npm package | `ai-saas-guard@0.24.0` |
| npm publishing | Trusted Publisher/OIDC, no long-lived publish token |
| Repository trust hardening | Strict branch protection, Dependabot, CodeQL, fast-check fuzzing, private vulnerability reporting, secret scanning, and push protection |
| Runtime hardening | Per-file and total text scan caps, escaped markdown evidence, stricter hosted deployment blockers |
| Hosted production adapters | GitHub App JWT signing, installation-token request planning, bounded worker execution, and terminal-state cleanup planning |
| Hosted app skeleton | Node/container HTTP ingress, health route, worker tick, in-memory provider adapters, and deployment plan validation |
| Hosted staging deployment planner | Provider binding, staging release-gate evidence, Node/container deployment composition, and GitHub App promotion gating |
| Hosted staging harness | File-backed webhook replay, queue/report/Check Run artifacts, worker cleanup verification, and local release-gate evidence fixtures |

## Quick Start

Run the published CLI without installing it globally:

```bash
npx ai-saas-guard@latest scan --root /path/to/your-saas
```

Run focused checks:

```bash
npx ai-saas-guard@latest pr-risk --root /path/to/your-saas --base origin/main
npx ai-saas-guard@latest check-supabase --root /path/to/your-saas
npx ai-saas-guard@latest check-stripe --root /path/to/your-saas
npx ai-saas-guard@latest check-mcp --root /path/to/your-saas
```

Machine-readable output:

```bash
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
```

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
| API routes | Auth checks without obvious ownership guards, missing rate-limit hints on sensitive mutation routes |
| MCP | Plaintext secrets, non-localhost binds, broad filesystem/write access, shell tools, raw SQL tools |
| Deploy config | Next static export/runtime mismatches, Edge runtime with Node-only APIs, missing important env documentation |
| PR risk | Auth, billing, RLS, env, deploy, API, storage, test-removal, and large mixed-diff classification |

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
| `check-supabase` | Inspect migrations and policy files for RLS and ownership risks |
| `check-stripe` | Inspect webhook handlers and billing lifecycle coverage |
| `check-mcp` | Inventory MCP configs and classify side effects |

## Launch Readiness Checklist

Use [docs/launch-readiness-checklist.md](docs/launch-readiness-checklist.md) when an app is close to inviting real users. It explains how to combine `ai-saas-guard` output with manual two-account authorization testing, Stripe webhook verification, MCP config review, Supabase policy review, deploy checks, rollback planning, and a clear reminder that this is not a full security audit.

## Repository Trust Hardening

See [docs/repository-trust-hardening.md](docs/repository-trust-hardening.md) for the public repository controls behind this release line: strict branch protection, required CI checks, Dependabot for npm and GitHub Actions, CodeQL SAST, fast-check fuzz/property tests, private vulnerability reporting, secret scanning, and push protection.

The current Scorecard improvement track focuses on real controls, not cosmetic score gaming: stricter review gates, detectable fuzzing, and the OpenSSF Best Practices Badge process. Some Scorecard items, such as repository age, contributor diversity, and reviewed PR history, improve only through time and normal public maintenance.

## Stripe Webhook Replay

Use [docs/stripe-webhook-replay.md](docs/stripe-webhook-replay.md) after `check-stripe` flags missing signature verification, idempotency, lifecycle handlers, or entitlement updates. The cookbook maps findings to concrete `stripe listen` and `stripe trigger` commands for checkout success, failed renewal, subscription update, cancellation, refund, duplicate delivery, and out-of-order event review.

## Hosted GitHub App Design

See [docs/github-app-design.md](docs/github-app-design.md) for the proposed hosted GitHub App layer. The note covers least-privilege permissions, selected repositories, webhook verification, PR comments, check runs, privacy, data retention, prompt injection handling, and why the hosted app should not replace the local CLI.

The first hosted service slice is defined in [docs/hosted-first-service-slice.md](docs/hosted-first-service-slice.md). It is intentionally check-run-only: signed GitHub App webhook intake, trusted scan identity, idempotent scan queueing, read-only worker behavior, compact report storage, and no PR comments, dashboard, billing, or AI summaries.

The hosted deployment model is documented in [docs/hosted-deployment-model.md](docs/hosted-deployment-model.md). It chooses a containerized Node.js ingress and worker model with a managed durable queue, platform secret manager, structured redacted logs, installation/repository rate limits, and rollback/incident response paths.

The hosted service runtime is documented in [docs/hosted-service-runtime.md](docs/hosted-service-runtime.md). It exports `createHostedServiceRuntime` from `ai-saas-guard/hosted/service` and implements the provider-independent service core for signed webhook intake, idempotent queue upsert, read-only worker orchestration, compact report storage, Check Run publication adapters, and worker cleanup planning. It does not deploy a public hosted environment by itself.

The hosted GitHub App deployment planner is documented in [docs/github-app-deployment.md](docs/github-app-deployment.md). It exports `planHostedGitHubAppDeployment` from `ai-saas-guard/hosted/github-app`, generates the least-privilege manifest for the first hosted slice, and blocks creation when the release gate, public HTTPS URLs, container digest, secret references, raw secret inputs, permissions, or events are incomplete or unsafe.

The hosted production adapter layer is documented in [docs/hosted-production-adapters.md](docs/hosted-production-adapters.md). It exports `createHostedGitHubAppJwt`, `planHostedGitHubInstallationTokenRequest`, and `planHostedProductionWorkerExecution` from `ai-saas-guard/hosted/production-adapters`. It adds RS256 GitHub App JWT generation, selected-repository installation-token request plans, separate worker and Check Run token scopes, a fixed read-only worker command, bounded timeout and output budgets, compact JSON-only output, and cleanup plans for success, failure, timeout, and cancellation. It still does not expose a public hosted service by itself.

The hosted Node/container app skeleton is documented in [docs/hosted-node-container-app.md](docs/hosted-node-container-app.md). It exports `createHostedHttpApp`, `createInMemoryHostedAppPlatform`, and `planHostedNodeContainerDeployment` from `ai-saas-guard/hosted/app`. It adds a safe `/healthz` route, signed `/github/webhook` ingress, one-job worker tick, in-memory provider adapters for tests, and deployment-plan validation for secret manager, queue, compact report store, worker sandbox, and GitHub Checks publisher references. It still does not deploy or expose a public hosted service by itself.

The hosted staging deployment planner is documented in [docs/hosted-staging-deployment.md](docs/hosted-staging-deployment.md). It exports `planHostedProviderBinding`, `planHostedStagingDeployment`, and `planHostedGitHubAppPromotion` from `ai-saas-guard/hosted/staging`. It composes real provider references, the Node/container deployment plan, hosted operational release-gate evidence, and GitHub App deployment planning so staging and production promotion stay blocked until the required queue, store, worker sandbox, Check Run publisher, logs, metrics, rollback, and incident-response references are present. It still does not call a cloud provider, create a GitHub App, or expose a public hosted service by itself.

The hosted staging harness is documented in [docs/hosted-staging-harness.md](docs/hosted-staging-harness.md). It exports `createFileBackedHostedStagingHarness` and `createHostedStagingHarnessEvidence` from `ai-saas-guard/hosted/staging-harness`. It runs signed webhook replay through the provider-independent hosted runtime with local file-backed queue, compact report, and Check Run adapters, then verifies worker sandbox cleanup. It is a staging rehearsal tool only; it does not call cloud providers, create a GitHub App, publish live Check Runs, or expose a public hosted service.

The hosted operational release gate is documented in [docs/hosted-operational-release-gate.md](docs/hosted-operational-release-gate.md). It defines the hosted-specific CI, replay, queue, worker cleanup, privacy, monitoring, rollback, and incident-response evidence required before any hosted environment is exposed to users. The pure gate evaluator exported from `ai-saas-guard/hosted/contracts` blocks hosted exposure unless every P0 evidence item is fresh, a container digest is recorded, and release notes avoid pentest, certification, and full-audit claims.

Hosted uninstall and data deletion behavior is documented in [docs/hosted-uninstall-data-deletion.md](docs/hosted-uninstall-data-deletion.md). It defines repository removal, full app uninstall, compact report deletion, queue cancellation, audit record retention, repeated cleanup, and user-facing deletion wording.

Hosted pricing and packaging boundaries are documented in [docs/hosted-pricing-packaging.md](docs/hosted-pricing-packaging.md). Core local scanning stays useful without an account; hosted plans may add workflow convenience, saved reports, team policy, and optional human review, but they do not gate local CLI scanning.

Hosted pre-implementation pure contracts are documented in [docs/hosted-preimplementation-contracts.md](docs/hosted-preimplementation-contracts.md). They now include a pull request webhook intake planner that verifies signatures before parsing or queueing, a durable scan queue planner that reuses queued, running, and completed jobs for the same trusted scan key, a worker read-only scan planner that fixes the CLI command and requires repository `contents: read`, and a Check Run publication planner that requires repository `checks: write` and builds bounded check-only payloads from compact reports. They also cover queue-safe webhook event parsing, bounded check-run summary rendering, idempotent queue cleanup planning, worker checkout cleanup planning, a retention/deletion cleanup planner, an operational release gate evaluator, the production adapter plans needed for GitHub App auth and bounded worker execution, the Node/container app skeleton needed for real provider wiring, the staging deployment planner needed before production GitHub App promotion, and the local staging harness needed to rehearse webhook replay, persistence, publication, and cleanup without cloud calls. The service runtime composes these contracts behind replaceable adapters. PR comments remain a later workflow or paid hosted feature, not part of the hosted MVP contract.

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

The repo includes a composite Action. Use `v0` for the latest compatible pre-1.0 Action, a specific release tag such as `v0.24.0` for controlled upgrades, or pin a reviewed commit SHA for stricter supply-chain control:

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

## Roadmap

Open-source core:

- local CLI
- deterministic scanner rules
- vulnerable and safe fixtures
- JSON, SARIF, and PR-focused markdown output
- GitHub Action wrapper
- rule documentation

Near-term priorities:

- Use the hosted staging harness to rehearse webhook replay, Check Run publication, compact report persistence, and worker cleanup locally; then bind real provider references, deploy a staging artifact, and collect monitoring, rollback, and incident-response evidence from that artifact.
- Keep hosted exposure blocked until the operational release gate has fresh evidence from a deployed artifact.

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
