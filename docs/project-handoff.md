# Project Handoff

Last updated: 2026-05-23

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
- Stripe webhook signature, raw body, idempotency, and lifecycle handler heuristics
- Supabase RLS, broad policy, ownership filter, and public storage heuristics
- sensitive API route heuristics
- MCP config side-effect and secret-bearing risk inventory
- Next/Vercel deploy and runtime footguns
- PR diff risk triage for auth, billing, RLS, env, tests removed, and large mixed diffs
- JSON output
- SARIF output
- composite GitHub Action wrapper

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

- #1 Add launch-readiness checklist content
- #2 Add GitHub Action release packaging
- #3 Add configurable rule severity and rule toggles
- #4 Add PR comment summary mode
- #5 Write Stripe webhook replay cookbook
- #6 Add SARIF upload workflow example
- #7 Expand Supabase RLS fixtures and ownership patterns
- #8 Publish ai-saas-guard to npm

CI:

- Workflow: `.github/workflows/ci.yml`
- Runs on pull requests and pushes to `main`
- Uses `permissions: contents: read`
- Latest verified run after setup succeeded

## Repository Boundaries

Allowed in this public repository:

- CLI source code
- tests and intentionally vulnerable fixtures
- public docs
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

1. Prepare npm publishing plan with trusted publishing/provenance.
2. Add GitHub Action release packaging and example workflow.
3. Add PR comment summary mode.
4. Add configurable severity and rule toggles.
5. Expand Supabase RLS fixtures and ownership patterns.
6. Write Stripe webhook replay cookbook.
7. Add SARIF upload workflow example.
8. Improve false-positive suppression and rule stability labels.

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
