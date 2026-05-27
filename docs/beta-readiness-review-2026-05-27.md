# Beta Readiness Review - 2026-05-27

This review records the current pre-commercial state for `ai-saas-guard`. It is public-safe and must not be used as a public beta launch approval by itself.

## Scope

Sources checked:

- local repository files on branch `main` before this documentation branch
- GitHub issue `#93` for design-partner feedback
- GitHub issue `#94` for provider evidence
- hosted public health endpoint
- npm and GitHub release metadata
- public documentation under `docs/`

Out of scope:

- billing, pricing, paid packaging, marketplace conversion, sales funnel work, broad analytics, customer accounts, or commercialization
- collecting source, raw diffs, PR text, raw logs, secrets, customer data, private URLs, checkout paths, or installation tokens
- deleting Cloudflare KV records or changing Cloudflare/GitHub App/npm secrets

## Current Verified State

As of 2026-05-27:

| Area | Status |
| --- | --- |
| Git branch before review branch | `main` clean and in sync with `origin/main` |
| Latest GitHub release | `v0.43.1`, published 2026-05-26 |
| npm latest | `ai-saas-guard@0.43.1` |
| Floating Action tag | `v0` points at `v0.43.1` |
| Current `package.json` version | `0.43.1` |
| Hosted public health | `ok: true`, `mode: webhook-ingress`, `processingPaused: false`, safe privacy flags |
| Hosted scanner version | live Cloudflare ingress still reports `scannerVersion: "0.43.0"` |
| Recent GitHub checks | latest CI, CodeQL, Metrics Snapshot, and Cross-Project Discovery runs on `main` completed successfully |

The live hosted endpoint being healthy is ingress evidence only. It does not prove a deployed source-checkout worker.

## Evidence Already Present

- Local CLI and GitHub Action release path exist and are published.
- Repository hardening exists: branch protection, CodeQL, Dependabot, secret scanning, push protection, OpenSSF Best Practices, and Trusted Publisher npm release flow.
- Cloudflare hosted ingress has staging evidence for signed webhook intake, compact KV records, selected-repository install guidance, bounded Check Run publishing, safe privacy flags, rate limiting, abuse kill switch, runtime pause, ingress rollback, invalid-signature rejection, exact compact-record deletion for a dedicated test prefix, and public-safe support routing.
- Public docs record the privacy boundary and no-audit/no-pentest/no-certification wording.
- `docs/design-partner-outreach-kit.md`, `.local/design-partner-private-feedback-template.md`, and `docs/public-beta-evidence-feedback.md` provide safe collection templates.

## Current Blockers

Public beta, team rollout, and commercialization remain blocked by evidence:

| Blocker | Current state | Next valid proof |
| --- | --- | --- |
| Real design-partner feedback | Issue `#93` has no valid DP-1, DP-2, or DP-3 feedback record yet | Three real people or teams run or review one workflow and provide sanitized summaries |
| Deployed source-checkout worker | Live hosted service reports `mode: webhook-ingress`, not a deployed source-checkout worker | Deployed worker evidence with trusted checkout identity, success/failure cleanup, Check Run publication, safe logs, and retention cleanup |
| GitHub App uninstall/repository-removal proof | Previous safe test add/remove attempt was blocked by App-management permissions | Authorized safe test installation or App-management session that can add/remove a temporary repository |
| Provider monitoring for source-checkout path | Ingress controls have partial evidence; source-checkout metrics/alerts are not proven | Safe alert/metric exports for ingress, queue, worker, Check Run, cleanup, and retention failures |
| Source-checkout rollback/incident drill | Ingress rollback is proven; source-checkout rollback cannot run until that artifact exists | Pause and rollback drill against deployed source-checkout worker |
| External validation of support/privacy wording | Support path is documented; no participant has validated it | At least one real participant confirms install/privacy/support wording is clear |

## Design-Partner Trial Pack

Use this exact low-risk path first:

```bash
npx --yes ai-saas-guard@latest demo --summary
npx --yes ai-saas-guard@latest scan --root <your-low-risk-demo-repo> --summary
```

Ask for only these public-safe fields:

- target label: DP-1 solo founder, DP-2 small team reviewer, or DP-3 MCP/AI-integration builder
- package version used, or `ai-saas-guard@latest` with date if version is unavailable
- path used: local CLI, GitHub Action, or hosted Check Run
- stack category and public-safe repository category
- severity counts and rule IDs only
- install or first-scan friction
- confusing, noisy, missing, false-positive, or possible false-negative categories by rule ID
- whether the result would change launch or merge behavior
- privacy or support confusion

Do not ask for or store source, raw diffs, PR text, raw logs, secrets, customer data, private URLs, checkout paths, personal contact details, or installation tokens in the public repository.

Valid public evidence can be posted to issue `#93` only after a real person or team runs or reviews one workflow. Platform metrics, stars, likes, downloads, page views, anonymous comments, simulated scans, and internal assumptions do not count.

## Provider Proof Order

Work the remaining provider blockers in this order:

1. Deploy or stage the source-checkout worker artifact with public-safe health and role evidence.
2. Prove source-checkout success and failure cleanup, compact report storage, Check Run publication, and log-boundary samples.
3. Establish provider alerts/metrics for ingress, queue, worker, Check Run, cleanup, and retention failure classes.
4. Run source-checkout pause, rollback, and incident drill.
5. Complete GitHub App repository-removal or uninstall deletion proof with a safe test installation.

Do not remove the current `zr9959/ai-saas-guard` installation just to create evidence, because it would delete useful staging records.

## Self-Scan Review

Fresh local checks run on 2026-05-27:

```bash
npm run build
node dist/cli.js scan --root . --summary
node dist/cli.js scan --root . --json > /tmp/ai-saas-guard-self-scan-20260527.json
node dist/cli.js scan --root . --sarif > /tmp/ai-saas-guard-self-scan-20260527.sarif
node dist/cli.js pr-risk --root . --json > /tmp/ai-saas-guard-pr-risk-20260527.json
node dist/cli.js check-supabase --root .
node dist/cli.js check-actions --root .
node dist/cli.js check-mcp --root .
node dist/cli.js check-stripe --root .
node dist/cli.js demo --summary
```

Result:

- build completed successfully
- repository self-scan returned 0 findings
- PR-risk JSON returned 0 findings for the current docs-only branch state
- Supabase, Actions, MCP, and Stripe focused checks returned 0 findings
- demo still reports the intentional risky fixture with 19 findings and the safe fixture with 0 findings

The self-scan result is a heuristic cleanliness check, not a certification or proof of hosted public beta readiness.

## Onboarding Review

Updated in this branch:

- `README.md` now has a short pre-commercial feedback section that points to issue `#93`, recommends the local CLI path first, and states the privacy boundary.
- `docs/README.zh-CN.md` has the matching Chinese section.
- `docs/README.zh-CN.md` also fixes the local terminal screenshot link so it resolves correctly from the `docs/` directory.
- The current-status tables in both READMEs now say public beta readiness is blocked on real design-partner feedback, deployed source-checkout proof, full GitHub App deletion proof, and source-checkout provider monitoring evidence.

The README changes do not add billing, pricing, paid packaging, marketplace conversion, sales funnel wording, broad analytics, or customer account flows.

## Decision

Continue evidence work, real design-partner feedback collection, and provider proof. Do not open public beta, invite teams broadly, or start commercialization from the evidence available on 2026-05-27.

## Final Verification

Fresh verification for this branch:

```bash
git diff --check
npm test
```

Result:

- `git diff --check` passed
- `npm test` passed with 208 tests

Temporary self-scan outputs were written under `/tmp` and must be removed before final handoff.
