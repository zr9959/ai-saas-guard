# Codex Recent Changes

Last updated: 2026-05-26, Asia/Shanghai.

## Private Pilot Rule-Quality Feedback Update

Why:

- A real local scan of a private SaaS worktree produced a sanitized feedback summary with several high-noise false-positive categories and one useful provider debug endpoint risk.
- The repository should capture the feedback as public-safe rule-quality evidence without copying private source, raw reports, private paths, credentials, or customer data.

Changed:

- added synthetic regression fixtures for the reported patterns
- tuned Supabase RLS checks to require Supabase context before flagging generic SQL schemas
- tuned API ownership heuristics for admin guards and `req.userId` scoping
- added `api.route.provider-debug-exposed`
- tuned obvious placeholder/test-token secret handling
- recorded the sanitized feedback in public-beta evidence docs as rule-quality evidence, not public beta readiness evidence

Tested:

- `npm test`: 195 pass

## Current Release: v0.43.0

Latest main commit:

- `7318c04 Add v0.43 pre-commercial beta and team gates`

Why:

- The user wanted the project advanced automatically until the pre-commercial boundary, then stopped before billing/commercialization.
- The project needed explicit gates for hosted beta readiness and team launch readiness instead of endless five-item rolling plans.

Changed files:

- `src/hosted/beta.ts`
- `tests/hosted-beta.test.mjs`
- `package.json`
- `package-lock.json`
- `README.md`
- `docs/README.zh-CN.md`
- `docs/hosted-node-container-app.md`
- `docs/hosted-operational-release-gate.md`
- `docs/hosted-operations-evidence.md`
- `docs/npm-publishing.md`
- `hosted/cloudflare-worker/README.md`
- `hosted/cloudflare-worker/wrangler.jsonc`
- `.github/workflows/npm-publish.yml`
- `tests/guard.test.mjs`

What changed:

- added `evaluateHostedBetaReadinessGate`
- added `evaluateTeamLaunchGateReadiness`
- exported `./hosted/beta`
- documented Phase 4 hosted beta readiness and Phase 5 team launch gates
- kept billing disabled and commercialization out of scope
- bumped version/config/docs to `0.43.0`
- recorded v0.43 Cloudflare Worker and real hosted smoke evidence

Tested:

```bash
npm test
npm audit --audit-level=high --registry=https://registry.npmjs.org
npm pack --dry-run --json
uvx zizmor --offline .github/workflows
go run github.com/rhysd/actionlint/cmd/actionlint@latest
node dist/cli.js scan --root . --json
node dist/cli.js pr-risk --root . --json
node dist/cli.js scan --root . --sarif
```

Results:

- `npm test`: 188 pass
- `npm audit`: 0 vulnerabilities
- `zizmor`: no findings, 11 suppressed
- `actionlint`: passed
- CLI self-scan outputs generated successfully
- PR `#92` CI passed: test, fuzz, actionlint, zizmor, CodeQL

Deployed:

```bash
cd hosted/cloudflare-worker
npx wrangler deploy --dry-run
npx wrangler deploy
curl --retry 3 --retry-delay 2 -fsSL https://ai-saas-guard-hosted.zr9959.workers.dev/healthz
curl --retry 3 --retry-delay 2 -fsSL https://ai-saas-guard-hosted.zr9959.workers.dev/github/app/install-info
node scripts/hosted-pr-smoke.mjs --evidence-file /tmp/ai-saas-guard-hosted-smoke-v0.43.json
```

Deployment result:

- Cloudflare Worker `SCANNER_VERSION`: `0.43.0`
- deployed Worker version: `8744d3db-0114-4653-85e2-f1554ff1b26b`
- hosted smoke PR: `#91`
- hosted smoke Check Run: `77724168740`
- conclusion: `success`
- KV cleanup: `[]`

Published:

- GitHub Release: `v0.43.0`
- npm latest: `ai-saas-guard@0.43.0`
- release asset: `ai-saas-guard-0.43.0.tgz`
- `v0` tag points to `7318c04f2ade79861c198e00e42ec6c32b90f9b9`

## Prior Recent Releases

### v0.42.0

Commit:

- `b65ff22 Add v0.42 Phase 3 source checkout trial gate`

Why:

- Close Phase 3 with a single machine-checkable gate rather than repeated ad hoc plans.

Changed:

- added `evaluateHostedSourceCheckoutTrialGate`
- combined source-checkout trial plan, stage evidence, read-only checkout scan proof, live smoke, rollback, monitoring, and incident-owner proof
- documented Phase 3 as the gate before hosted beta

Test/deploy:

- local release gate passed
- GitHub CI passed
- Worker deployed as `0.42.0`
- hosted smoke PR `#89`, Check Run `77721238202`, success
- npm and GitHub Release published

### v0.41.0

Commit:

- `f46170d Prepare v0.41.0 source checkout trial`

Why:

- Add source-checkout trial planning/evidence contracts and compress hosted Check Run reviewer output.

Changed:

- added `createHostedSourceCheckoutTrialPlan`
- added `createHostedSourceCheckoutEvidence`
- compressed hosted Check Run summary around risk areas, manual proof, boundary, and privacy
- documented the next hosted source-checkout gate

Test/deploy:

- local release gate passed
- GitHub CI passed
- Worker deployed as `0.41.0`
- hosted smoke PR `#87`, Check Run `77718782535`, success
- npm and GitHub Release published

### v0.40.0

Commit:

- `5a05fca Prepare v0.40.0 hosted review evidence`

Why:

- Improve hosted Check Run grouping and machine-readable smoke evidence.

Changed:

- grouped hosted Check Run output by launch-risk area
- clarified CLI/Action/Hosted path selection
- recorded next source-checkout boundary

Test/deploy:

- local release gate passed
- GitHub CI passed
- Worker deployed as `0.40.0`
- hosted smoke PR `#85`, Check Run `77714061842`, success
- npm and GitHub Release published

## Current Handoff Package Changes

This handoff request created or updated:

- `docs/CODEX_HANDOFF.md`
- `docs/CODEX_STATE.md`
- `docs/CODEX_TODO.md`
- `docs/CODEX_RECENT_CHANGES.md`
- `docs/project-handoff.md`
- `.local/project-handoff.md`

Why:

- The user asked to stop development and create a complete new-Codex handoff package so the next conversation can continue without reading the long chat history.

Tested:

- keyword self-check across the new handoff files
- process check for lingering dev/test/deploy tasks

## Post-Handoff Documentation Follow-Up

The follow-up after the initial handoff added:

- `docs/public-beta-evidence-feedback.md`
- a cross-reference from `docs/hosted-operational-release-gate.md`

Why:

- The next work priority is real design-partner feedback and provider evidence, not more speculative features.
- The new document turns that priority into a privacy-safe intake process with design-partner targets, feedback templates, provider evidence matrix, public beta block conditions, and cleanup requirements.
- It explicitly keeps billing, pricing, paid packaging, marketplace conversion, sales funnel, broad analytics, and customer account systems out of scope.

Tested:

- `git diff --check`
- verified linked docs exist
- checked for trailing whitespace in the new and modified docs
- process check for lingering dev/test/deploy tasks

Not deployed:

- handoff docs are documentation only
- no business code changed during handoff generation

## Step 1-5 Execution After Handoff

The user asked to proceed through the five-step plan in order.

Completed:

- Step 1: committed docs-only handoff and public beta evidence intake as `3177e99 docs: add codex handoff and beta evidence intake`
- Step 2: opened GitHub issue `#93`, "Design partner feedback intake for public beta readiness"
- Step 3: checked public hosted health and install info, checked deployed Worker version and compact KV key count, opened GitHub issue `#94`, and committed `58cb8dc docs: record public beta evidence intake status`
- Step 4: added `docs/hosted-operator-runbook.md` for health checks, pause, queue/failure checks, rollback, compact record deletion, incident escalation, support triage, and cleanup
- Step 5: ran `npm run build && node --test tests/hosted-beta.test.mjs`, then mapped current evidence into Phase 4/5 gates and commented the blocked result on issue `#94`

Gate result:

- Phase 4 `readyForPublicBeta: false`
- Phase 4 blocked reasons: `phase3_gate_missing`, `rate_limit_missing`, `abuse_kill_switch_missing`, `uninstall_deletion_proof_missing`, `rollback_test_missing`, `incident_owner_missing`, `support_path_missing`
- Phase 5 `readyForTeamUse: false`
- Phase 5 blocked reasons: `hosted_beta_gate_missing`, `org_policy_config_missing`, `required_status_check_docs_missing`, `suppression_audit_missing`, `reviewer_checklist_missing`, `release_evidence_export_missing`, `team_docs_missing`, `admin_bypass_docs_missing`, `retention_policy_docs_missing`

Decision:

- do not open public beta
- do not invite teams beyond beta
- do not commercialize
- continue with real design-partner feedback and provider evidence collection

## Post-PR 95 Follow-Up

After PR `#95` was merged:

- local `main` was synchronized to `origin/main` at merge commit `9f780bc9151502e4e9cc674fa0c220457e1ae8d7`
- read-only provider checks confirmed public `/healthz` and `/github/app/install-info` still return HTTP `200`, `scannerVersion: "0.43.0"`, selected-repository permissions, and safe privacy flags
- `wrangler deployments list` still showed Worker version `8744d3db-0114-4653-85e2-f1554ff1b26b`
- `wrangler kv key list` returned 15 compact records with TTL; no records were deleted
- issue `#93` was updated to clarify that real DP-1/DP-2/DP-3 inputs are still required
- issue `#94` was updated with the safe provider check result and remaining provider evidence blockers
- `npm run build && node --test tests/hosted-beta.test.mjs` passed with 2 tests after the read-only provider check
- Phase 4 remained `readyForPublicBeta: false`
- Phase 5 remained `readyForTeamUse: false`

Still blocked:

- no real design-partner feedback is recorded
- no provider alert export is attached
- no rollback drill has been run
- no incident owner/backup/support evidence is attached
- no uninstall/deletion proof is attached

## Post-PR 96 Recheck

After PR `#96` was merged:

- public `/healthz` and `/github/app/install-info` still returned HTTP `200`, `scannerVersion: "0.43.0"`, selected-repository permissions, and safe privacy flags
- `wrangler deployments list` still showed Worker version `8744d3db-0114-4653-85e2-f1554ff1b26b`
- `wrangler kv key list` returned 21 compact records with TTL, including PR `#96` records; no records were deleted
- PR `#96` had successful CI, CodeQL, and hosted `ai-saas-guard PR risk` Check Run results
- issue `#93` was rechecked and still has no real design-partner feedback
- issue `#94` was updated with the read-only provider check and remains blocked on real alert, rollback, incident, uninstall/deletion, and support evidence
- `npm run build && node --test tests/hosted-beta.test.mjs` passed with 2 tests
- Phase 4 remained `readyForPublicBeta: false`
- Phase 5 remained `readyForTeamUse: false`

## 2026-05-26 Ordered Evidence Recheck

The user asked to execute the next 1-5 plan in order and update GitHub plus npx/npm status.

Completed:

- Step 1: rechecked public hosted `/healthz`, `/github/app/install-info`, current Worker deployment, compact KV key count, and issue `#94`
- Step 2: confirmed rollback/recovery drill is still blocked until an explicit staging rollback window, target artifact, and operation boundary are provided
- Step 3: confirmed uninstall/deletion proof is still blocked until an explicit staging/test uninstall or deletion scope is provided
- Step 4: rechecked issue `#93`; no real DP-1, DP-2, or DP-3 feedback is recorded
- Step 5: verified npm `latest` remains `ai-saas-guard@0.43.0` and `npx --yes ai-saas-guard@latest demo --summary` runs successfully

Not done:

- no Cloudflare rollback was executed
- no KV records were deleted
- no uninstall/repository-removal flow was triggered
- no npm package was published because the package version remains `0.43.0` and this run is documentation/evidence only

Decision:

- public beta remains blocked
- team use remains blocked
- commercialization remains blocked
- continue only with real provider evidence or real design-partner feedback

## 2026-05-26 Staging Provider Drill

The user approved continuing with staging provider drills.

Completed:

- ran a Cloudflare Worker rollback from current v0.43 Worker version `8744d3db-0114-4653-85e2-f1554ff1b26b` to previous known-good v0.42 Worker version `6de0811e-11bf-46a6-9b7b-cbecda409695`
- verified `/healthz` and `/github/app/install-info` returned `scannerVersion: "0.42.0"` with safe privacy flags after rollback
- restored the Worker to v0.43 version `8744d3db-0114-4653-85e2-f1554ff1b26b`
- verified `/healthz` and `/github/app/install-info` returned `scannerVersion: "0.43.0"` with safe privacy flags after restore
- created a dedicated test compact KV key under `scan:135085075:900000526:`, deleted only that exact key, and verified the prefix returned `[]`
- sent a synthetic invalid-signature webhook request and confirmed HTTP `400` with safe privacy flags

Still blocked:

- no full GitHub App uninstall/repository-removal cleanup proof, because the current `gh` token cannot list or manage installation repositories and no safe test installation was available
- no provider alert/export evidence
- no incident owner/backup/support evidence
- no real design-partner feedback

Decision:

- rollback evidence is now present for staging
- exact compact-record deletion evidence is present for a dedicated test key
- public beta and team launch remain blocked until the remaining real evidence exists

## 2026-05-26 Human Support Routing

The user asked to process the remaining human blockers.

Completed:

- added `docs/hosted-support-incident-ownership.md`
- recorded `@zr9959` as primary hosted staging incident and support triage owner
- recorded a pause-hosted fallback when no independent backup operator is staffed
- added `.github/ISSUE_TEMPLATE/hosted_support.yml`
- added private vulnerability reporting as the sensitive-report route in issue template config
- updated hosted operator, release gate, public beta evidence, operations evidence, CODEX state, and TODO docs

Still blocked:

- no real DP-1, DP-2, or DP-3 feedback has been received
- provider alert/export evidence is still missing
- full GitHub App uninstall/repository-removal proof still needs a safe test installation or authorized App-management session

Decision:

- incident owner and support path can be treated as recorded for staging
- do not treat the pause fallback as a staffed second human
- public beta and team launch remain blocked until the remaining real evidence exists

## 2026-05-26 GitHub App Management Attempt

The user authorized an app-management session attempt.

Completed:

- created temporary private repository `zr9959/ai-saas-guard-app-proof-20260526`
- recorded temporary repository ID `1249767506`
- attempted to add the temporary repository to installation `135085075` with `PUT /user/installations/135085075/repositories/1249767506`
- received HTTP `403`: `You do not have permission to modify this app on zr9959.`
- deleted the temporary repository afterward
- updated issue `#94` with the blocked proof attempt

Decision:

- do not remove the current `zr9959/ai-saas-guard` installation because it would delete existing evidence
- full GitHub App add/remove proof remains blocked until a session can modify the `ai-saas-guard-hosted` installation, or a separate safe test installation exists
