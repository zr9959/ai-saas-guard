# ai-saas-guard

Local-first launch preflight for AI-built SaaS apps.

`ai-saas-guard` helps founders and reviewers answer a narrow question before launch or merge:

> What changed in auth, billing, data access, secrets, MCP tools, or deploy config that a human should verify first?

It is built for Next.js, Supabase, Stripe, Vercel, Prisma/SQL migrations, MCP configs, and AI-generated pull requests. It is not a pentest, a full SAST platform, or a promise that your app is secure.

## Why This Exists

AI coding tools make it easy to ship a polished MVP before the production trust boundaries are ready. The app can look done while these risks are still hidden:

- login exists, but users can access each other's data
- Supabase RLS is disabled or uses `USING (true)`
- Stripe webhooks accept unsigned or duplicate events
- `NEXT_PUBLIC_*` exposes a secret-like value to the browser
- MCP configs contain plaintext secrets or shell/raw SQL tools
- AI PRs mix billing, auth, migrations, deploy config, and UI refactors in one huge diff

This CLI is intentionally evidence-first. Every finding includes a file, severity, why it matters, a verification step, and a fix direction.

## Quick Start

```bash
npx ai-saas-guard scan
npx ai-saas-guard pr-risk
npx ai-saas-guard check-supabase
npx ai-saas-guard check-stripe
npx ai-saas-guard check-mcp
```

Local development:

```bash
npm install
npm test
node dist/cli.js scan --root /path/to/repo
node dist/cli.js pr-risk --root /path/to/repo --base origin/main
```

Output formats:

```bash
node dist/cli.js scan --json
node dist/cli.js scan --sarif > ai-saas-guard.sarif
node dist/cli.js scan --fail-on high
```

## The Main Bet: PR Risk Triage

Most security scanners start with "scan the whole repo." `ai-saas-guard` also supports that, but the sharper wedge is pull request review.

`pr-risk` classifies the current diff into sensitive surfaces:

- auth/session
- billing/subscription
- database schema/migration
- RLS/policy
- API contract
- env/secrets/deploy
- permissions/storage
- tests removed or weakened
- large AI-generated/refactor-like diff

The output is designed for a reviewer:

- top risky files
- review-first checklist
- suggested PR split
- required tests or manual verification

This is the part to make excellent before expanding into broader security claims.

## Commands

### `scan`

Runs the broad repo launch preflight: secrets, public env risk, Stripe webhook heuristics, Supabase policy risk, MCP config risk, sensitive API routes, and deploy/env hints.

### `pr-risk`

Classifies the current `git diff` or a base branch diff. Use it on AI-generated PRs to decide what a human should inspect first.

```bash
ai-saas-guard pr-risk --base origin/main
```

### `check-supabase`

Looks for missing RLS, broad policies, missing ownership filters, and public storage hints. It also outputs a two-account IDOR verification script.

### `check-stripe`

Looks for webhook route evidence, signature verification, raw body handling, missing failure/cancel/update/refund handlers, duplicate event idempotency, and entitlement update paths.

### `check-mcp`

Inventories repo-local MCP configs and classifies side effects: read-only, write, network, shell, database, and secret-bearing.

## GitHub Action

This repo includes a composite action:

```yaml
name: ai-saas-guard

on:
  pull_request:

jobs:
  preflight:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
        with:
          fetch-depth: 0
      - uses: your-github-user/ai-saas-guard@v0
        with:
          command: pr-risk
          root: ${{ github.workspace }}
          base: origin/main
          fail-on: high
```

For GitHub code scanning:

```yaml
      - uses: your-github-user/ai-saas-guard@v0
        with:
          command: scan
          format: sarif
          output: ai-saas-guard.sarif
      - uses: github/codeql-action/upload-sarif@v3
        with:
          sarif_file: ai-saas-guard.sarif
```

Replace `your-github-user` after publishing the public repository.

## Ignore File

Add `.ai-saas-guardignore` at the repository root to suppress generated fixtures, snapshots, or known noisy paths:

```gitignore
fixtures/**
snapshots/**
vendor/generated/**
```

Use this sparingly. The goal is not to hide launch blockers; it is to keep reports focused enough that founders and reviewers act on them.

## Rule Coverage

The first rule set includes checks for:

- secret-like values in source/config/examples
- risky `NEXT_PUBLIC_*` names or values
- Stripe webhook signature verification
- Stripe raw body compatibility
- missing Stripe failure/cancel/update/refund handlers
- missing Stripe duplicate event idempotency
- missing Stripe entitlement update paths
- Supabase sensitive tables without RLS
- broad Supabase `USING (true)` policies
- policies missing `auth.uid()` or ownership filters
- public Supabase storage hints
- auth-checked API routes without obvious ownership guards
- missing rate-limit hints on sensitive routes
- plaintext secrets in MCP configs
- MCP non-localhost bind addresses
- MCP broad filesystem/write access
- MCP shell/raw SQL tools
- Next/Vercel env and runtime footguns
- PR diff sensitive-surface classification

See [docs/rules.md](docs/rules.md) for the current rule map.

## Release Quality Gate

Before publishing a CLI update, GitHub Action update, plugin, npm package, or public repository change, follow [docs/release-quality-knowledge-base.md](docs/release-quality-knowledge-base.md).

That knowledge base is the required release checklist for code correctness, security review, GitHub repository settings, workflow hardening, dependency review, package publishing, plugin/agent risks, and release evidence.

## Privacy Model

- Runs locally.
- Reads repository files and git diffs.
- Makes no network calls.
- Does not upload code.
- Requires no account or login.
- Does not modify files.
- Redacts secret-like evidence where a value is matched.

## What This Does Not Do

- It does not prove your app is secure.
- It does not replace manual two-account authorization testing.
- It does not execute Stripe, Supabase, Vercel, or browser flows.
- It does not inspect production settings unless they are represented locally.
- It does not try to be a full Semgrep/Gitleaks/Bearer replacement.

## Open-Core Roadmap

Open-source core:

- local CLI
- deterministic rules
- JSON/SARIF output
- GitHub Action
- rule docs and fixtures

Potential paid layer:

- hosted GitHub App
- saved/shareable reports
- PR comments and review-first annotations
- scan history
- team policy settings
- deeper Stripe/Supabase/Vercel integrations
- optional human review for launch readiness

The open-source project should stay useful on its own. Paid features should save time, preserve history, integrate with GitHub, and support teams that want recurring checks.
