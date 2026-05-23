<h1 align="center">ai-saas-guard</h1>

<p align="center">
  <strong>Local-first launch preflight for AI-built SaaS apps.</strong>
</p>

<p align="center">
  Find the auth, billing, data-access, secret, MCP, and deploy surfaces a human should review before launch or merge.
</p>

<p align="center">
  <a href="https://github.com/zr9959/ai-saas-guard/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/zr9959/ai-saas-guard/actions/workflows/ci.yml/badge.svg"></a>
  <a href="https://www.npmjs.com/package/ai-saas-guard"><img alt="npm" src="https://img.shields.io/npm/v/ai-saas-guard.svg"></a>
  <a href="LICENSE"><img alt="License: MIT" src="https://img.shields.io/badge/license-MIT-blue.svg"></a>
  <a href="package.json"><img alt="Node.js >=20" src="https://img.shields.io/badge/node-%3E%3D20-339933.svg"></a>
  <a href="docs/release-quality-knowledge-base.md"><img alt="Release gate documented" src="https://img.shields.io/badge/release%20gate-documented-0f766e.svg"></a>
</p>

---

## What It Does

`ai-saas-guard` is a command-line launch preflight for founders, solo builders, and reviewers shipping SaaS apps with AI coding tools.

It answers one narrow question:

> What changed in auth, billing, data access, secrets, MCP tools, or deploy config that deserves human review first?

It is built for common AI-SaaS stacks:

- Next.js and Vercel
- Supabase row-level security and storage policies
- Stripe checkout, subscriptions, and webhooks
- Prisma or SQL migrations
- MCP server configuration
- AI-generated pull requests with large mixed diffs

It is intentionally evidence-first. Findings include a rule ID, severity, file evidence, why it matters, how to verify it, and a fix direction.

## Current Status

This repository is public on GitHub.

The CLI is published on npm as `ai-saas-guard`, and the GitHub Action is available through versioned release tags. If you need stricter supply-chain pinning in CI, pin the GitHub Action to a reviewed commit SHA instead of a mutable tag.

| Area | Status |
| --- | --- |
| Public GitHub repository | Available |
| npm CLI | Published as `ai-saas-guard` |
| Local CLI from source | Available for development |
| JSON and SARIF output | Available |
| Composite GitHub Action | Available |
| Versioned Action tags | `v0.1.2` |
| npm package | `ai-saas-guard@0.1.2` |

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
| Supabase | RLS disabled on sensitive tables, `USING (true)`, missing ownership filters, public storage hints |
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

```bash
node dist/cli.js pr-risk --root /path/to/your-saas --base origin/main --json
```

## Commands

| Command | Purpose |
| --- | --- |
| `scan` | Broad local launch preflight across secrets, Stripe, Supabase, MCP, API routes, and deploy config |
| `pr-risk` | Classify the current git diff or a base branch diff for review priority |
| `check-supabase` | Inspect migrations and policy files for RLS and ownership risks |
| `check-stripe` | Inspect webhook handlers and billing lifecycle coverage |
| `check-mcp` | Inventory MCP configs and classify side effects |

## GitHub Action

The repo includes a composite Action. Use the latest release tag or pin a reviewed commit SHA for stricter supply-chain control:

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
      - uses: zr9959/ai-saas-guard@v0.1.2
        with:
          command: pr-risk
          root: ${{ github.workspace }}
          base: origin/main
          fail-on: high
```

For SARIF upload:

```yaml
      - uses: zr9959/ai-saas-guard@v0.1.2
        with:
          command: scan
          format: sarif
          output: ai-saas-guard.sarif
      - uses: github/codeql-action/upload-sarif@v3
        with:
          sarif_file: ai-saas-guard.sarif
```

For maximum reproducibility, replace `v0.1.2` with the full commit SHA from the release notes.

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
- JSON and SARIF output
- GitHub Action wrapper
- rule documentation

Near-term priorities:

- npm trusted publishing and provenance
- PR comment summary mode
- configurable severity and rule toggles
- expanded Supabase RLS fixtures
- Stripe webhook replay cookbook
- SARIF upload workflow example

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

The package is published as [`ai-saas-guard`](https://www.npmjs.com/package/ai-saas-guard). See [docs/npm-publishing.md](docs/npm-publishing.md) for the GitHub Actions provenance workflow, the first-publish token history, and the trusted-publisher follow-up.
