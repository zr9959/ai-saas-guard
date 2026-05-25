# Codex State

Last updated: 2026-05-25, Asia/Shanghai.

## Current Running Environment

- Project path: `/Volumes/MyPSSD/app/ai-saas-guard`
- Shell: `zsh`
- Branch: `main`
- Latest release commit: `7318c04f2ade79861c198e00e42ec6c32b90f9b9`
- Post-release local docs-only commits include `3177e99` and `58cb8dc`; run `git log -3 --oneline` for the current local HEAD.
- Package version: `0.43.0`
- Observed Node: `v25.8.0`
- Package engine: Node `>=20`
- Network: available in the last session
- Current process check: no lingering `node --test`, `wrangler`, `vite`, `next dev`, `tsx`, `ts-node`, or `hosted-pr-smoke` process was found
- Worktree note: `docs/project-handoff.md` was already modified before this handoff package was generated

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
- `hosted/cloudflare-worker/wrangler.jsonc` - Worker config, `SCANNER_VERSION: "0.43.0"`.

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
- Latest published version: `0.43.0`
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
- `docs/hosted-operator-runbook.md` is documented but not yet exercised as provider evidence

## Known Failures Or Unverified Items

- No current failing tests are known.
- Full source-checkout scan worker is implemented as code/gates but not deployed as the live hosted scan worker.
- Provider monitoring/rollback/incident evidence is not yet collected.
- Public beta feedback/provider-evidence intake is documented in `docs/public-beta-evidence-feedback.md`, but no real design-partner feedback or provider evidence has been recorded.
- Hosted beta/team gates are implemented as readiness checks, but public beta has not started.
- GitHub issue `#93` has no recorded real participant feedback yet.
- GitHub issue `#94` has missing provider monitoring, rollback, incident, uninstall/deletion, and support evidence.
- Operator runbook evidence is missing until the runbook is exercised against deployed artifacts.
- No admin dashboard exists.
- No mobile UI exists.
- No SEO/GEO website or analytics exists.
- No payment, membership, customer login, or billing system exists.
- No production database schema exists.
