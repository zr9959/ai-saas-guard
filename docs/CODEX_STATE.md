# Codex State

Last updated: 2026-07-15, Asia/Shanghai.

## Current Running Environment

- Project path: `/Volumes/MyPSSD/app/ai-saas-guard`
- Shell: `zsh`
- Branch: `main` remains the public source of truth; active review branch is `codex/ui-quality-audit`, based on current `main` commit `96ea609` after the published `v0.43.3` release
- Latest release commit: `1db0253e0d57198060d5227a1f85668004242429`
- Current local and tracked `origin/main` HEAD at the 2026-07-15 branch check: `96ea609ba4f03db4f59470340df242ea0cbabf71`
- Package version: `0.43.3`
- Observed Node: `v25.8.0`
- Package engine: Node `>=20`
- Network: available in the last session
- Current review work does not require a persistent local server; final cleanup must leave no test, Worker, or browser-test server process running
- Worktree note: `.local/project-handoff.md` is intentionally ignored and must not be force-added

## Main Directory Structure

- `src/` - TypeScript source for CLI, scanners, report output, hosted contracts, and hosted gates.
- `src/scanners/` - deterministic launch-risk scanners.
- `src/commands/` - command adapters for scanner/report flows.
- `src/report/` - terminal, JSON, SARIF, markdown, summary, and launch-gate formatting.
- `src/hosted/` - hosted contracts, service runtime, app skeleton, worker gates, beta/team gates.
- `tests/` - Node test suite and fixtures.
- `examples/` - demo risky/safe SaaS fixtures and sample reports.
- `docs/` - public docs, hosted design/evidence docs, release docs, and this Codex handoff package.
- `hosted/cloudflare-worker/` - deployed Cloudflare Worker source and Wrangler config.
- `.github/` - CI, CodeQL, npm publish, Dependabot, templates, CODEOWNERS.
- `.local/` - local-only handoff context, ignored by git.

## Current Review Branch

The `codex/ui-quality-audit` branch contains:

- consistent terminal, summary, Markdown, and hosted Check Run report hierarchy
- responsive Worker source for `GET/HEAD /github/app`; it is not deployed by this branch
- hardened browser headers, terminal/Markdown normalization, safe Git refs, UUID delivery keys, and pinned GitHub API destinations
- incomplete scan coverage gating and more precise stack applicability
- deterministic file and finding ordering
- synchronized English/Chinese examples and a 100-dimension quality audit

Latest local verification on 2026-07-15:

- `npm test`: 221 passed, 0 failed
- npm audit at high threshold: 0 vulnerabilities
- repository scan: 0 findings; 116 files scanned; no skipped or unreadable inputs; Cloudflare and GitHub Actions detected
- focused Actions, Supabase, MCP, and Stripe scans: 0 findings
- demo: risky fixture 19 findings; safe fixture 0 findings
- package dry run: 175 files and no AppleDouble or `.DS_Store` metadata
- Wrangler 4.110.0 deploy dry run: passed; no deployment performed
- local browser QA: 1440x900, 390x844, and 320x568 without horizontal overflow; 44px primary controls; mobile continuation cue visible

No Cloudflare deployment, GitHub App mutation, KV deletion, npm publication, release tag, or commercial feature is included.

GitHub review state:

- draft PR: `#134`, `https://github.com/zr9959/ai-saas-guard/pull/134`
- current branch head before this handoff-status update: `3d30e5b`
- passing checks: test, fuzz, actionlint, zizmor, workflow CodeQL, and Advanced Security CodeQL
- the initial Advanced Security high finding for polynomial ANSI/OSC regex backtracking was fixed with a linear scanner and disappeared on the rerun

## Key Files

CLI:

- `src/cli.ts` - command parsing and output routing.
- `src/index.ts` - public package exports.
- `src/types.ts` - shared report/scanner types.
- `src/config.ts` - `.ai-saas-guard.json` config, severity overrides, suppressions, fail thresholds.
- `action.yml` - composite GitHub Action wrapper.

Scanners:

- `src/scanners/secrets.ts`
- `src/scanners/stripe.ts`
- `src/scanners/supabase.ts`
- `src/scanners/apiRoutes.ts`
- `src/scanners/deploy.ts`
- `src/scanners/silentSuccess.ts`
- `src/scanners/mcp.ts`
- `src/scanners/actions.ts`
- `src/scanners/gitDiff.ts`

Hosted:

- `src/hosted/contracts.ts` - pure hosted contracts and release-gate logic.
- `src/hosted/service.ts` - provider-independent hosted runtime.
- `src/hosted/app.ts` - Node/container hosted app skeleton.
- `src/hosted/worker.ts` - Phase 3 source-checkout trial planning/evidence/gate.
- `src/hosted/beta.ts` - Phase 4 hosted beta and Phase 5 team launch readiness gates.
- `hosted/cloudflare-worker/src/index.js` - live Cloudflare Worker ingress.
- `hosted/cloudflare-worker/wrangler.jsonc` - Worker config, currently `SCANNER_VERSION: "0.43.0"` for the live ingress line.

Docs:

- `README.md`
- `docs/README.zh-CN.md`
- `docs/rules.md`
- `docs/positioning.md`
- `docs/release-quality-knowledge-base.md`
- `docs/hosted-operational-release-gate.md`
- `docs/hosted-operations-evidence.md`
- `docs/public-beta-evidence-feedback.md`
- `docs/npm-publishing.md`

## Database, Configuration, And Environment Variables

Database:

- No production app database exists.
- No database migration was added for a real customer system.
- Supabase migration files in the repo are fixtures/examples.
- Live hosted ingress uses Cloudflare KV only for compact records.

Cloudflare:

- Worker URL: `https://ai-saas-guard-hosted.zr9959.workers.dev`
- Worker mode: webhook ingress with compact PR file metadata Check Run publishing.
- KV binding: `HOSTED_EVENTS`
- Public Worker vars:
  - `SCANNER_VERSION="0.43.0"`
  - `GITHUB_APP_ID="3834787"`
  - `GITHUB_APP_SLUG="ai-saas-guard-hosted"`
  - `GITHUB_APP_INSTALLATION_ID="135085075"`
- Required Cloudflare secrets:
  - `WEBHOOK_SECRET`
  - `GITHUB_APP_PRIVATE_KEY`
- Do not print, export, commit, or rotate secrets without an explicit task.

GitHub:

- Repo: `https://github.com/zr9959/ai-saas-guard`
- GitHub App: `ai-saas-guard-hosted`
- App ID: `3834787`
- Installation ID: `135085075`
- Installed on selected repository `zr9959/ai-saas-guard`
- Permissions include selected-repository `checks: write`, `contents: read`, `metadata: read`, `pull_requests: read`.

npm:

- Package: `ai-saas-guard`
- Latest published version: `0.43.3`
- Publish uses GitHub Actions Trusted Publisher/OIDC.
- Do not add long-lived npm publish tokens.

## Local Run Commands

Install/build:

```bash
npm ci
npm run build
```

CLI examples:

```bash
node dist/cli.js --help
node dist/cli.js demo
node dist/cli.js scan --root . --json
node dist/cli.js scan --root . --sarif
node dist/cli.js pr-risk --root . --json
node dist/cli.js check-supabase --root . --doctor
node dist/cli.js check-mcp --root . --policy-template
node dist/cli.js check-actions --root .
```

## Test Commands

Standard:

```bash
npm test
npm run build
```

Release gate:

```bash
npm audit --audit-level=high --registry=https://registry.npmjs.org
npm pack --dry-run --json
uvx zizmor --offline .github/workflows
go run github.com/rhysd/actionlint/cmd/actionlint@latest
node dist/cli.js scan --root . --json
node dist/cli.js pr-risk --root . --json
node dist/cli.js scan --root . --sarif
```

Hosted smoke:

```bash
node scripts/hosted-pr-smoke.mjs --evidence-file /tmp/ai-saas-guard-hosted-smoke.json
```

## Deploy Commands

Cloudflare Worker:

```bash
cd hosted/cloudflare-worker
npx wrangler deploy --dry-run
npx wrangler deploy
curl --retry 3 --retry-delay 2 -fsSL https://ai-saas-guard-hosted.zr9959.workers.dev/healthz
curl --retry 3 --retry-delay 2 -fsSL https://ai-saas-guard-hosted.zr9959.workers.dev/github/app/install-info
```

GitHub/npm release:

```bash
gh release create vX.Y.Z --target main --title "vX.Y.Z" --notes-file /tmp/release-notes.md
gh run watch <npm-publish-run-id> --interval 5 --exit-status
npm view ai-saas-guard version dist-tags.latest --registry=https://registry.npmjs.org
npm pack --json
gh release upload vX.Y.Z ai-saas-guard-X.Y.Z.tgz --clobber
git tag -f v0 <release-commit>
git push origin refs/tags/v0 --force
```

Use a notes file for release notes; do not inline shell text with backticks.

## Latest Verified Results

For the latest published line:

- `v0.43.3` release exists on GitHub and npm `latest` is `ai-saas-guard@0.43.3`
- `v0` points to `1db0253e0d57198060d5227a1f85668004242429`
- latest observed `main` CI, CodeQL, Metrics Snapshot, and Cross-Project Discovery runs completed successfully on 2026-05-27
- hosted public health returned `ok: true`, `mode: webhook-ingress`, `processingPaused: false`, safe privacy flags, and `scannerVersion: "0.43.0"`
- issue `#93` still has no real DP-1, DP-2, or DP-3 feedback
- issue `#94` still has source-checkout, full GitHub App deletion, and provider-monitoring evidence blockers

For `v0.43.0`:

- `npm test`: 188 tests passed
- `npm audit --audit-level=high --registry=https://registry.npmjs.org`: 0 vulnerabilities
- `npm pack --dry-run --json`: passed
- `uvx zizmor --offline .github/workflows`: no findings, 11 suppressed
- `actionlint`: passed
- CLI self-scan JSON, PR-risk JSON, SARIF: generated successfully
- PR `#92` CI passed: test, fuzz, actionlint, zizmor, CodeQL
- Cloudflare Worker deployed version: `8744d3db-0114-4653-85e2-f1554ff1b26b`
- hosted smoke: PR `#91`, Check Run `77724168740`, success, KV cleanup `[]`
- public beta intake issues opened: GitHub `#93` for design-partner feedback and `#94` for provider evidence
- hosted beta focused test: `npm run build && node --test tests/hosted-beta.test.mjs`, 2 tests passed
- Phase 4 gate recheck: `readyForPublicBeta: false`
- Phase 5 gate recheck: `readyForTeamUse: false`
- draft PR `#95` contains the docs-only handoff/evidence/runbook branch
- PR `#95` merged into `main` with merge commit `9f780bc9151502e4e9cc674fa0c220457e1ae8d7`
- post-merge read-only provider check: public endpoints returned HTTP 200, Worker version remained `8744d3db-0114-4653-85e2-f1554ff1b26b`, and KV had 15 compact records with TTL
- `docs/hosted-operator-runbook.md` is documented but not yet exercised as provider evidence
- post-merge hosted beta focused test: `npm run build && node --test tests/hosted-beta.test.mjs`, 2 tests passed
- post-merge Phase 4 gate recheck: `readyForPublicBeta: false`
- post-merge Phase 5 gate recheck: `readyForTeamUse: false`
- after PR `#96`, read-only provider recheck still showed Worker version `8744d3db-0114-4653-85e2-f1554ff1b26b`, public endpoints healthy, and 21 compact KV records with TTL
- post-PR `#96` hosted beta focused test: `npm run build && node --test tests/hosted-beta.test.mjs`, 2 tests passed
- post-PR `#96` Phase 4 gate recheck: `readyForPublicBeta: false`
- post-PR `#96` Phase 5 gate recheck: `readyForTeamUse: false`
- 2026-05-26 ordered evidence recheck: public `/healthz` and `/github/app/install-info` returned HTTP 200 with `scannerVersion: "0.43.0"` and safe privacy flags; Worker version remained `8744d3db-0114-4653-85e2-f1554ff1b26b`; KV had 28 compact records with TTL; issue `#93` still had no real design-partner feedback; issue `#94` still lacked rollback, uninstall/deletion, provider alert, incident, and support evidence
- 2026-05-26 npm/npx recheck: npm `latest` remained `ai-saas-guard@0.43.0`; `npx --yes ai-saas-guard@latest demo --summary` ran successfully; no npm publish was attempted because no package version or runtime artifact changed
- 2026-05-26 staging rollback drill: Worker rollback from `8744d3db-0114-4653-85e2-f1554ff1b26b` to previous known-good `6de0811e-11bf-46a6-9b7b-cbecda409695` passed health/privacy checks, then restored to `8744d3db-0114-4653-85e2-f1554ff1b26b` and passed health/privacy checks again
- 2026-05-26 provider-store deletion drill: dedicated test compact key prefix `scan:135085075:900000526:` was created, listed, deleted by exact key, and verified empty; no existing project `scan:` evidence was deleted
- 2026-05-26 human support routing: `docs/hosted-support-incident-ownership.md` records `@zr9959` as primary hosted staging incident/support owner, defines a pause-hosted fallback when no independent backup is staffed, adds a public-safe hosted support issue template, and routes sensitive reports to GitHub private vulnerability reporting
- 2026-05-26 GitHub App management proof attempt: temporary repo `zr9959/ai-saas-guard-app-proof-20260526` was created, add-to-installation API returned HTTP 403 because the session cannot modify the `ai-saas-guard-hosted` installation, and the temporary repo was deleted
- 2026-05-27 beta readiness review branch: `npm run build`, repository self-scan, `pr-risk`, and focused Supabase/Actions/MCP/Stripe checks were run locally; self-scan and focused checks returned 0 findings, and `demo --summary` still showed the expected risky fixture with 19 findings and safe fixture with 0 findings

## Known Failures Or Unverified Items

- No current failing tests are known.
- Full source-checkout scan worker is implemented as code/gates but not deployed as the live hosted scan worker.
- Provider monitoring/rollback/incident evidence is partial for the current ingress path but still missing for the deployed source-checkout path.
- Public beta feedback/provider-evidence intake is documented in `docs/public-beta-evidence-feedback.md`, but no real design-partner feedback has been recorded.
- Hosted beta/team gates are implemented as readiness checks, but public beta has not started.
- GitHub issue `#93` has no recorded real participant feedback yet.
- GitHub issue `#94` still lacks provider monitoring for source-checkout and full GitHub App uninstall/repository-removal proof.
- Operator runbook evidence is missing until the runbook is exercised against deployed artifacts.
- The post-merge provider check was read-only and did not satisfy rollback, incident, uninstall/deletion, support, or alert evidence.
- The post-merge gate recheck still blocks public beta and team use.
- Issue `#93` still has no real DP-1, DP-2, or DP-3 feedback.
- Issue `#94` still lacks provider alert exports for the source-checkout path and full GitHub App uninstall/repository-removal proof. A GitHub App management proof attempt was blocked by installation-management permissions, and the temporary test repo was cleaned up. Staging Worker rollback evidence, exact compact-record deletion evidence, primary incident owner evidence, and public-safe support path evidence now exist.
- The post-PR `#96` gate recheck still blocks public beta and team use.
- The 2026-05-26 ordered evidence recheck was read-only; it did not satisfy provider monitoring or design-partner evidence. The later 2026-05-26 staging drills satisfied rollback evidence, exact compact-record deletion, and human support routing.
- No admin dashboard exists.
- No mobile app exists; this branch only adds a responsive hosted install/privacy information page.
- No SEO/GEO website or analytics exists.
- No payment, membership, customer login, or billing system exists.
- No production database schema exists.
