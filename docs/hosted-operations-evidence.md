# Hosted Operations Evidence

This document records deployed hosted-service evidence for `ai-saas-guard`.

Passing these checks does not make the project a pentest, certification, or full security audit. The goal is narrower: keep hosted rollout claims tied to fresh operational evidence.

## Current Evidence

Recorded on 2026-05-25 from the deployed Cloudflare Worker plus temporary GitHub PR smokes.

| Check | Evidence | Result |
| --- | --- | --- |
| Cloudflare Worker health, v0.43.0 | `GET https://ai-saas-guard-hosted.zr9959.workers.dev/healthz` returned `ok: true`, routes including `/github/app/install-info`, `checkRunPublisher: "configured"`, `scannerVersion: "0.43.0"`, and all privacy flags set to false for raw payloads, PR text, source, diffs, secrets, customer payloads, checkout paths, and installation tokens | Passed |
| Public install guidance, v0.43.0 | `GET https://ai-saas-guard-hosted.zr9959.workers.dev/github/app/install-info` returned the `ai-saas-guard-hosted` install URL, selected-repository boundary wording, first-slice permissions `checks: write`, `contents: read`, `metadata: read`, `pull_requests: read`, subscribed events `pull_request`, `installation`, and `installation_repositories`, uninstall cleanup wording, `scannerVersion: "0.43.0"`, and no private keys, webhook secrets, installation tokens, source, diffs, or customer payloads | Passed |
| Deployed Worker version, v0.43.0 | `wrangler deploy` uploaded 38.57 KiB / gzip 9.86 KiB and deployed version `8744d3db-0114-4653-85e2-f1554ff1b26b` at `2026-05-25T14:00:03Z` verification time | Passed |
| Real hosted PR smoke, v0.43.0 | `node scripts/hosted-pr-smoke.mjs --evidence-file /tmp/ai-saas-guard-hosted-smoke-v0.43.json` opened temporary PR `#91`, waited for Check Run `77724168740` on head SHA `6d62e52b243d657dd949b48c3333224905caa830`, received conclusion `success`, closed the PR, restored the original branch, deleted the local branch, and deleted 9 staging KV records with `remainingSmokeKeys: 0`; `gh pr view 91` returned `state: "CLOSED"`, `git ls-remote --heads origin codex/hosted-smoke-20260525140128` returned no remote branch, and `wrangler kv key list --namespace-id fa5344fbd7944de6a776bf8731d58460 --remote` returned `[]` after cleanup | Passed |
| Cloudflare Worker health, v0.42.0 | `GET https://ai-saas-guard-hosted.zr9959.workers.dev/healthz` returned `ok: true`, routes including `/github/app/install-info`, `checkRunPublisher: "configured"`, `scannerVersion: "0.42.0"`, and all privacy flags set to false for raw payloads, PR text, source, diffs, secrets, customer payloads, checkout paths, and installation tokens | Passed |
| Public install guidance, v0.42.0 | `GET https://ai-saas-guard-hosted.zr9959.workers.dev/github/app/install-info` returned the `ai-saas-guard-hosted` install URL, selected-repository boundary wording, first-slice permissions `checks: write`, `contents: read`, `metadata: read`, `pull_requests: read`, subscribed events `pull_request`, `installation`, and `installation_repositories`, uninstall cleanup wording, `scannerVersion: "0.42.0"`, and no private keys, webhook secrets, installation tokens, source, diffs, or customer payloads | Passed |
| Deployed Worker version, v0.42.0 | `wrangler deploy` uploaded 38.57 KiB / gzip 9.86 KiB and deployed version `6de0811e-11bf-46a6-9b7b-cbecda409695` at `2026-05-25T13:40:11Z` verification time | Passed |
| Real hosted PR smoke, v0.42.0 | `node scripts/hosted-pr-smoke.mjs --evidence-file /tmp/ai-saas-guard-hosted-smoke-v0.42.json` opened temporary PR `#89`, waited for Check Run `77721238202` on head SHA `66dfffde2ffa1a563ebc45fe7b22468d2f060e22`, received conclusion `success`, closed the PR, restored the original branch, deleted the local branch, and deleted 9 staging KV records with `remainingSmokeKeys: 0`; `gh pr view 89` returned `state: "CLOSED"`, `git ls-remote --heads origin codex/hosted-smoke-20260525134106` returned no remote branch, and `wrangler kv key list --namespace-id fa5344fbd7944de6a776bf8731d58460 --remote` returned `[]` after cleanup | Passed |
| Cloudflare Worker health, v0.41.0 | `GET https://ai-saas-guard-hosted.zr9959.workers.dev/healthz` returned `ok: true`, routes including `/github/app/install-info`, `checkRunPublisher: "configured"`, `scannerVersion: "0.41.0"`, and all privacy flags set to false for raw payloads, PR text, source, diffs, secrets, customer payloads, checkout paths, and installation tokens | Passed |
| Public install guidance, v0.41.0 | `GET https://ai-saas-guard-hosted.zr9959.workers.dev/github/app/install-info` returned the `ai-saas-guard-hosted` install URL, selected-repository boundary wording, first-slice permissions `checks: write`, `contents: read`, `metadata: read`, `pull_requests: read`, subscribed events `pull_request`, `installation`, and `installation_repositories`, uninstall cleanup wording, `scannerVersion: "0.41.0"`, and no private keys, webhook secrets, installation tokens, source, diffs, or customer payloads | Passed |
| Deployed Worker version, v0.41.0 | `wrangler deploy` uploaded 38.57 KiB / gzip 9.86 KiB and deployed version `fb0b4726-ac75-4577-942b-fdeed7752979` at `2026-05-25T13:22:28Z` verification time | Passed |
| Real hosted PR smoke, v0.41.0 | `node scripts/hosted-pr-smoke.mjs --evidence-file /tmp/ai-saas-guard-hosted-smoke-v0.41.json` opened temporary PR `#87`, waited for Check Run `77718782535` on head SHA `83a341dcba63ad9a30aabdfec1de4f874a3c0b11`, received conclusion `success`, closed the PR, restored the original branch, deleted the local branch, and deleted 9 staging KV records with `remainingSmokeKeys: 0`; `gh pr view 87` returned `state: "CLOSED"`, `git ls-remote --heads origin codex/hosted-smoke-20260525132327` returned no remote branch, and `wrangler kv key list --namespace-id fa5344fbd7944de6a776bf8731d58460 --remote` returned `[]` after cleanup | Passed |
| Cloudflare Worker health, v0.40.0 | `GET https://ai-saas-guard-hosted.zr9959.workers.dev/healthz` returned `ok: true`, routes including `/github/app/install-info`, `checkRunPublisher: "configured"`, `scannerVersion: "0.40.0"`, and all privacy flags set to false for raw payloads, PR text, source, diffs, secrets, customer payloads, checkout paths, and installation tokens | Passed |
| Public install guidance, v0.40.0 | `GET https://ai-saas-guard-hosted.zr9959.workers.dev/github/app/install-info` returned the `ai-saas-guard-hosted` install URL, selected-repository boundary wording, first-slice permissions `checks: write`, `contents: read`, `metadata: read`, `pull_requests: read`, subscribed events `pull_request`, `installation`, and `installation_repositories`, uninstall cleanup wording, `scannerVersion: "0.40.0"`, and no private keys, webhook secrets, installation tokens, source, diffs, or customer payloads | Passed |
| Deployed Worker version, v0.40.0 | `wrangler deploy` uploaded 38.99 KiB / gzip 10.01 KiB and deployed version `47e90d1c-0d7b-455f-b1a4-1ec7ee10d58b` at `2026-05-25T12:47:28Z` verification time | Passed |
| Real hosted PR smoke, v0.40.0 | `node scripts/hosted-pr-smoke.mjs --evidence-file /tmp/ai-saas-guard-hosted-smoke-v0.40.json` opened temporary PR `#85`, waited for Check Run `77714061842` on head SHA `e312073d12dffdca3358edfce17869adac48d7f4`, received conclusion `success`, closed the PR, restored the original branch, deleted the local branch, and deleted 4 staging KV records with `remainingSmokeKeys: 0`; `gh pr view 85` returned `state: "CLOSED"`, `git ls-remote --heads origin codex/hosted-smoke-20260525124817` returned no remote branch, and `wrangler kv key list --namespace-id fa5344fbd7944de6a776bf8731d58460 --remote` returned `[]` after cleanup | Passed |
| Cloudflare Worker health, v0.39.0 | `GET https://ai-saas-guard-hosted.zr9959.workers.dev/healthz` returned `ok: true`, routes including `/github/app/install-info`, `checkRunPublisher: "configured"`, `scannerVersion: "0.39.0"`, and all privacy flags set to false for raw payloads, PR text, source, diffs, secrets, customer payloads, checkout paths, and installation tokens | Passed |
| Public install guidance, v0.39.0 | `GET https://ai-saas-guard-hosted.zr9959.workers.dev/github/app/install-info` returned the `ai-saas-guard-hosted` install URL, selected-repository boundary wording, first-slice permissions `checks: write`, `contents: read`, `metadata: read`, `pull_requests: read`, subscribed events `pull_request`, `installation`, and `installation_repositories`, uninstall cleanup wording, `scannerVersion: "0.39.0"`, and no private keys, webhook secrets, installation tokens, source, diffs, or customer payloads | Passed |
| Deployed Worker version, v0.39.0 | `wrangler deploy` uploaded 36.25 KiB / gzip 9.26 KiB and deployed version `91aebf30-4c25-4639-bf5c-6f8be4e85690` at `2026-05-25T12:26:24Z` verification time | Passed |
| Real hosted PR smoke, v0.39.0 | `node scripts/hosted-pr-smoke.mjs` opened temporary PR `#82`, waited for Check Run `77711358510` on head SHA `64fa25f631a78131b19ee33094c9469736f151dc`, received conclusion `success`, closed the PR, deleted branch `codex/hosted-smoke-20260525122732`, and `wrangler kv key list --namespace-id fa5344fbd7944de6a776bf8731d58460 --remote` returned `[]` after cleanup | Passed |
| Cloudflare Worker health, v0.38.0 | `GET https://ai-saas-guard-hosted.zr9959.workers.dev/healthz` returned `ok: true`, routes including `/github/app/install-info`, `checkRunPublisher: "configured"`, `scannerVersion: "0.38.0"`, and all privacy flags set to false for raw payloads, PR text, source, diffs, secrets, customer payloads, checkout paths, and installation tokens | Passed |
| Public install guidance, v0.38.0 | `GET https://ai-saas-guard-hosted.zr9959.workers.dev/github/app/install-info` returned the `ai-saas-guard-hosted` install URL, selected-repository boundary wording, first-slice permissions `checks: write`, `contents: read`, `metadata: read`, `pull_requests: read`, subscribed events `pull_request`, `installation`, and `installation_repositories`, uninstall cleanup wording, `scannerVersion: "0.38.0"`, and no private keys, webhook secrets, installation tokens, source, diffs, or customer payloads | Passed |
| Deployed Worker version, v0.38.0 | `wrangler deploy` uploaded 36.35 KiB / gzip 9.30 KiB and deployed version `5999ccce-c64d-4f3f-96c9-b46cff5a2aed` at `2026-05-25T10:51:30Z` verification time | Passed |
| Staging KV cleanup, v0.38.0 | `wrangler kv bulk delete` removed 104 old `delivery:` and `scan:` staging records, then `wrangler kv key list --namespace-id fa5344fbd7944de6a776bf8731d58460 --remote` returned `[]` | Passed |
| Cloudflare Worker health | `GET https://ai-saas-guard-hosted.zr9959.workers.dev/healthz` returned `ok: true`, `checkRunPublisher: "configured"`, `scannerVersion: "0.28.0"`, and all privacy flags set to false for raw payloads, PR text, source, diffs, secrets, customer payloads, checkout paths, and installation tokens | Passed |
| Deployed Worker version | `wrangler deployments list` showed current version `531d2286-86c6-4327-bfd0-67cad8693c10`, deployed at `2026-05-24T09:01:25.706Z` | Passed |
| KV cleanup | `wrangler kv key list --namespace-id fa5344fbd7944de6a776bf8731d58460 --remote` returned `[]` after smoke cleanup | Passed |
| Temporary smoke PR cleanup | Temporary PR `#52` was closed, branch `codex/hosted-smoke-20260524170208` was deleted, and in-progress workflow run `26357038569` was cancelled | Passed |
| End-to-end GitHub App delivery | Temporary PR `#52` created `ai-saas-guard PR risk` from GitHub App `ai-saas-guard-hosted`; Check Run `77585561127` completed with conclusion `success` for head SHA `408925d2bf4df564082dabc3e1893a72c25bdd19` | Passed |
| Compact hosted record | KV scan record `scan:135085075:1247239389:52:408925d2bf4df564082dabc3e1893a72c25bdd19:0.28.0` completed with zero findings, `conclusion: "success"`, and all privacy flags set to false for raw payloads, PR text, source, diffs, secrets, customer payloads, checkout paths, and installation tokens | Passed |

## Public Beta Evidence Intake Status

Recorded on 2026-05-25 after the `v0.43.0` handoff package was committed.

This is public beta intake status only. It does not make hosted beta ready, and it does not replace the P0 hosted release gate.

| Area | Evidence | Status |
| --- | --- | --- |
| Design-partner intake | GitHub issue [#93](https://github.com/zr9959/ai-saas-guard/issues/93) tracks privacy-safe feedback for DP-1 solo founder, DP-2 small team PR review, and DP-3 MCP or AI-generated integration contexts. No real design-partner feedback has been recorded yet. | Open, blocked on real participants |
| Provider evidence intake | GitHub issue [#94](https://github.com/zr9959/ai-saas-guard/issues/94) tracks ingress, queue, worker, Check Run, cleanup, retention, rollback, incident, uninstall/deletion, and support evidence before public beta. | Open, blocked on provider evidence |
| Public hosted health | `GET https://ai-saas-guard-hosted.zr9959.workers.dev/healthz` returned HTTP `200`, `ok: true`, `scannerVersion: "0.43.0"`, `checkRunPublisher: "configured"`, and privacy flags set to false for raw webhook payloads, PR text, raw source, raw diffs, secrets, customer payloads, private checkout paths, and installation tokens. | Passed for public endpoint health only |
| Public install info | `GET https://ai-saas-guard-hosted.zr9959.workers.dev/github/app/install-info` returned HTTP `200`, selected-repository permissions `checks: write`, `contents: read`, `metadata: read`, `pull_requests: read`, events `pull_request`, `installation`, and `installation_repositories`, and the same privacy flags set to false. | Passed for public install wording only |
| Deployed Worker version | `wrangler deployments list` showed current deployed version `8744d3db-0114-4653-85e2-f1554ff1b26b`, created at `2026-05-25T14:00:00.153Z`. | Passed for deployed version lookup |
| Compact KV records | `wrangler kv key list --namespace-id fa5344fbd7944de6a776bf8731d58460 --remote` returned 5 compact `delivery:` / `scan:` records with expirations. The records were not bulk-deleted because this was not an explicit smoke cleanup task. | Present; not a cleanup proof |
| Provider monitoring | No provider dashboard or alert evidence has been attached for ingress errors, queue depth, worker failure, Check Run failure, cleanup failure, or retention failure. | Missing |
| Rollback and incident response | No manual rollback drill, incident owner, backup owner, queue pause, worker pause, credential rotation, status update, or customer communication evidence has been attached for the deployed artifact. | Missing |

## Phase 4 And Phase 5 Gate Recheck

Recorded on 2026-05-25 from the current source checkout after public beta intake issue creation.

Verification command:

```bash
npm run build && node --test tests/hosted-beta.test.mjs
```

Result: 2 hosted beta tests passed.

The current evidence was then mapped into `evaluateHostedBetaReadinessGate` and `evaluateTeamLaunchGateReadiness` with only currently proven items set to true. Public endpoint health, selected-repository install wording, safe privacy flags, no-audit-claim wording, no raw source/diff/PR-text storage, and the prior v0.43 hosted smoke were treated as available evidence. Full deployed source-checkout proof, rate limiting, abuse kill switch, uninstall/deletion proof, rollback, incident owner, support path, and team workflow controls were treated as missing because no fresh provider or design-partner evidence has been attached.

| Gate | Result | Blocked reasons |
| --- | --- | --- |
| Phase 4 hosted beta readiness | `readyForPublicBeta: false` | `phase3_gate_missing`, `rate_limit_missing`, `abuse_kill_switch_missing`, `uninstall_deletion_proof_missing`, `rollback_test_missing`, `incident_owner_missing`, `support_path_missing` |
| Phase 5 team launch gate | `readyForTeamUse: false` | `hosted_beta_gate_missing`, `org_policy_config_missing`, `required_status_check_docs_missing`, `suppression_audit_missing`, `reviewer_checklist_missing`, `release_evidence_export_missing`, `team_docs_missing`, `admin_bypass_docs_missing`, `retention_policy_docs_missing` |

Decision: do not open public beta, do not invite teams beyond beta, and do not sell or commercialize. Continue with design-partner feedback issue [#93](https://github.com/zr9959/ai-saas-guard/issues/93) and provider evidence issue [#94](https://github.com/zr9959/ai-saas-guard/issues/94).

## Operator Runbook Recheck

Recorded on 2026-05-25 after adding [hosted-operator-runbook.md](hosted-operator-runbook.md) on PR [#95](https://github.com/zr9959/ai-saas-guard/pull/95).

The runbook now documents health checks, pause workflow, queue and failure checks, rollback workflow, compact record deletion, incident escalation, support triage, evidence templates, and cleanup expectations. This improves operator readiness documentation, but it is not provider evidence by itself.

Verification command:

```bash
npm run build && node --test tests/hosted-beta.test.mjs
```

Result: 2 hosted beta tests passed.

The Phase 4 and Phase 5 gate recheck still returned the same blocked result:

- Phase 4 `readyForPublicBeta: false`
- Phase 4 blocked reasons: `phase3_gate_missing`, `rate_limit_missing`, `abuse_kill_switch_missing`, `uninstall_deletion_proof_missing`, `rollback_test_missing`, `incident_owner_missing`, `support_path_missing`
- Phase 5 `readyForTeamUse: false`
- Phase 5 blocked reasons: `hosted_beta_gate_missing`, `org_policy_config_missing`, `required_status_check_docs_missing`, `suppression_audit_missing`, `reviewer_checklist_missing`, `release_evidence_export_missing`, `team_docs_missing`, `admin_bypass_docs_missing`, `retention_policy_docs_missing`

Decision: keep public beta, team use, and commercialization blocked until issue [#93](https://github.com/zr9959/ai-saas-guard/issues/93) has real design-partner feedback and issue [#94](https://github.com/zr9959/ai-saas-guard/issues/94) has real provider evidence.

## Post-PR 95 Safe Provider Check

Recorded on 2026-05-25 after PR [#95](https://github.com/zr9959/ai-saas-guard/pull/95) was merged into `main`.

Only read-only checks were run. No secrets were read or printed, no KV records were deleted, and no rollback or deployment mutation was performed.

| Area | Evidence | Status |
| --- | --- | --- |
| PR merge | PR `#95` was marked ready, passed CI and CodeQL checks, and merged with merge commit `9f780bc9151502e4e9cc674fa0c220457e1ae8d7`. | Passed |
| Public hosted health | `GET https://ai-saas-guard-hosted.zr9959.workers.dev/healthz` returned HTTP `200`, `ok: true`, `scannerVersion: "0.43.0"`, `checkRunPublisher: "configured"`, and privacy flags set to false for raw webhook payloads, PR text, raw source, raw diffs, secrets, customer payloads, private checkout paths, and installation tokens. | Passed for public endpoint health only |
| Public install info | `GET https://ai-saas-guard-hosted.zr9959.workers.dev/github/app/install-info` returned HTTP `200`, selected-repository permissions `checks: write`, `contents: read`, `metadata: read`, `pull_requests: read`, events `pull_request`, `installation`, and `installation_repositories`, and the same privacy flags set to false. | Passed for public install wording only |
| Deployed Worker version | `wrangler deployments list` still showed current deployed version `8744d3db-0114-4653-85e2-f1554ff1b26b`, created at `2026-05-25T14:00:00.153Z`. | Passed for deployed version lookup |
| Compact KV records | `wrangler kv key list --namespace-id fa5344fbd7944de6a776bf8731d58460 --remote` returned 15 compact `delivery:` / `scan:` records with TTL, including PR `#95` records. They were not deleted because this was not a smoke cleanup, uninstall cleanup, retention job, or approved deletion request. | Present; not a cleanup proof |
| Design-partner feedback | Issue [#93](https://github.com/zr9959/ai-saas-guard/issues/93) was updated to clarify the minimum sanitized input needed from real DP-1, DP-2, and DP-3 contexts. No real feedback has been recorded. | Missing |
| Provider drills | Issue [#94](https://github.com/zr9959/ai-saas-guard/issues/94) was updated with the safe check result and remaining provider evidence blockers. No rollback drill, incident drill, uninstall/deletion proof, or support evidence has been attached. | Missing |

## Post-Merge Phase 4 And Phase 5 Recheck

Recorded on 2026-05-25 after the read-only provider check and design-partner intake blocker update.

Verification command:

```bash
npm run build && node --test tests/hosted-beta.test.mjs
```

Result: 2 hosted beta tests passed.

The current evidence was mapped into `evaluateHostedBetaReadinessGate` and `evaluateTeamLaunchGateReadiness` with only currently proven items set to true. The new read-only provider check confirms endpoint health and privacy flags, but it does not prove rate limits, abuse kill switch, uninstall/deletion cleanup, rollback, incident ownership, support path, or provider alerting.

| Gate | Result | Blocked reasons |
| --- | --- | --- |
| Phase 4 hosted beta readiness | `readyForPublicBeta: false` | `phase3_gate_missing`, `rate_limit_missing`, `abuse_kill_switch_missing`, `uninstall_deletion_proof_missing`, `rollback_test_missing`, `incident_owner_missing`, `support_path_missing` |
| Phase 5 team launch gate | `readyForTeamUse: false` | `hosted_beta_gate_missing`, `org_policy_config_missing`, `required_status_check_docs_missing`, `suppression_audit_missing`, `reviewer_checklist_missing`, `release_evidence_export_missing`, `team_docs_missing`, `admin_bypass_docs_missing`, `retention_policy_docs_missing` |

Decision: public beta, team use, and commercialization remain blocked.

## Post-PR 96 Safe Provider And Feedback Recheck

Recorded on 2026-05-25 after PR [#96](https://github.com/zr9959/ai-saas-guard/pull/96) was merged into `main`.

Only read-only checks were run. No secrets were read or printed, no KV records were deleted, and no rollback or deployment mutation was performed.

| Area | Evidence | Status |
| --- | --- | --- |
| PR merge | PR `#96` was merged with commit `ab86824bbb91f49bc69c0e8890295f62838ed7db`. CI, CodeQL, and the hosted `ai-saas-guard PR risk` Check Run completed successfully. | Passed |
| Public hosted health | `GET https://ai-saas-guard-hosted.zr9959.workers.dev/healthz` returned HTTP `200`, `ok: true`, `scannerVersion: "0.43.0"`, `checkRunPublisher: "configured"`, and privacy flags set to false for raw webhook payloads, PR text, raw source, raw diffs, secrets, customer payloads, private checkout paths, and installation tokens. | Passed for public endpoint health only |
| Public install info | `GET https://ai-saas-guard-hosted.zr9959.workers.dev/github/app/install-info` returned HTTP `200`, selected-repository permissions `checks: write`, `contents: read`, `metadata: read`, `pull_requests: read`, events `pull_request`, `installation`, and `installation_repositories`, and the same privacy flags set to false. | Passed for public install wording only |
| Deployed Worker version | `wrangler deployments list` still showed current deployed version `8744d3db-0114-4653-85e2-f1554ff1b26b`, created at `2026-05-25T14:00:00.153Z`. | Passed for deployed version lookup |
| Compact KV records | `wrangler kv key list --namespace-id fa5344fbd7944de6a776bf8731d58460 --remote` returned 21 compact `delivery:` / `scan:` records with TTL, including PR `#96` records. They were not deleted because this was not a smoke cleanup, uninstall cleanup, retention job, or approved deletion request. | Present; not a cleanup proof |
| Design-partner feedback | Issue [#93](https://github.com/zr9959/ai-saas-guard/issues/93) was rechecked and still contains no real DP-1, DP-2, or DP-3 feedback. A sanitized feedback template was added as a comment. | Missing |
| Provider drills | Issue [#94](https://github.com/zr9959/ai-saas-guard/issues/94) was updated with the safe check result and remaining provider evidence blockers. No provider alert export, rollback drill, incident owner/backup evidence, uninstall/deletion proof, or support evidence has been attached. | Missing |

## Post-PR 96 Phase 4 And Phase 5 Recheck

Recorded on 2026-05-25 after the post-PR `#96` provider and feedback recheck.

Verification command:

```bash
npm run build && node --test tests/hosted-beta.test.mjs
```

Result: 2 hosted beta tests passed.

The current evidence was mapped into `evaluateHostedBetaReadinessGate` and `evaluateTeamLaunchGateReadiness` with only currently proven items set to true. The read-only provider check still does not prove rate limits, abuse kill switch, uninstall/deletion cleanup, rollback, incident ownership, support path, or provider alerting. Issue `#93` still has no real design-partner feedback.

| Gate | Result | Blocked reasons |
| --- | --- | --- |
| Phase 4 hosted beta readiness | `readyForPublicBeta: false` | `phase3_gate_missing`, `rate_limit_missing`, `abuse_kill_switch_missing`, `uninstall_deletion_proof_missing`, `rollback_test_missing`, `incident_owner_missing`, `support_path_missing` |
| Phase 5 team launch gate | `readyForTeamUse: false` | `hosted_beta_gate_missing`, `org_policy_config_missing`, `required_status_check_docs_missing`, `suppression_audit_missing`, `reviewer_checklist_missing`, `release_evidence_export_missing`, `team_docs_missing`, `admin_bypass_docs_missing`, `retention_policy_docs_missing` |

Decision: public beta, team use, and commercialization remain blocked.

## 2026-05-26 Ordered Evidence Recheck

Recorded on 2026-05-26 after the user asked to execute the next 1-5 plan in order and update GitHub plus npx/npm status.

Only read-only checks were run. No secrets were read or printed, no KV records were deleted, no rollback was executed, no deployment was changed, and no uninstall/deletion mutation was performed.

| Step | Evidence | Status |
| --- | --- | --- |
| 1. Provider evidence recheck | `/healthz` returned HTTP `200`, `ok: true`, `scannerVersion: "0.43.0"`, `checkRunPublisher: "configured"`, and all privacy flags false for raw webhook payloads, PR text, source, diffs, secrets, customer payloads, checkout paths, and installation tokens. `/github/app/install-info` returned HTTP `200`, selected-repository permissions `checks: write`, `contents: read`, `metadata: read`, `pull_requests: read`, events `pull_request`, `installation`, and `installation_repositories`, and the same privacy flags false. `wrangler deployments list` showed current Worker version `8744d3db-0114-4653-85e2-f1554ff1b26b`, created at `2026-05-25T14:00:00.153Z`. `wrangler kv key list --remote` returned 28 compact `delivery:` / `scan:` records with expirations. | Endpoint health passed; provider monitoring evidence still missing |
| 2. Rollback/recovery drill | The current deployed version and earlier deployment IDs are visible through `wrangler deployments list`, but no rollback or recovery mutation was executed because no explicit staging rollback window, target previous artifact, or approval boundary was provided for this run. | Blocked on approved staging drill |
| 3. Uninstall/deletion proof | No uninstall, repository-removal, KV delete, or retention cleanup mutation was executed. Existing compact records were observed only by key name and expiration. | Blocked on approved staging/test uninstall or deletion scope |
| 4. Design-partner feedback | Issue [#93](https://github.com/zr9959/ai-saas-guard/issues/93) was rechecked. It still has no real DP-1, DP-2, or DP-3 feedback. | Blocked on real participants |
| 5. npx/npm and gate status | `npm view ai-saas-guard version dist-tags --json` returned `0.43.0` and `latest: "0.43.0"`. `npx --yes ai-saas-guard@latest demo --summary` ran successfully. `npx --yes ai-saas-guard@latest --version` is not a supported CLI command and returned usage text. No npm publish was attempted because the package version remains `0.43.0` and this run changed documentation/evidence only. | npx latest verified; no new package publish |

Decision: do not open public beta, do not invite teams beyond beta, and do not commercialize. The next valid progress is real provider evidence or real design-partner feedback, not more feature work.

Validation:

```bash
git diff --check
npm run build && node --test tests/hosted-beta.test.mjs
```

Result: docs diff check passed, build passed, and 2 hosted beta tests passed.

Gate recheck with only currently proven evidence still returned:

- Phase 4 `readyForPublicBeta: false`
- Phase 4 blocked reasons: `phase3_gate_missing`, `rate_limit_missing`, `abuse_kill_switch_missing`, `uninstall_deletion_proof_missing`, `rollback_test_missing`, `incident_owner_missing`, `support_path_missing`
- Phase 5 `readyForTeamUse: false`
- Phase 5 blocked reasons: `hosted_beta_gate_missing`, `org_policy_config_missing`, `required_status_check_docs_missing`, `suppression_audit_missing`, `reviewer_checklist_missing`, `release_evidence_export_missing`, `team_docs_missing`, `admin_bypass_docs_missing`, `retention_policy_docs_missing`

## 2026-05-26 Staging Rollback And Deletion Drill

Recorded on 2026-05-26 after the user approved doing staging provider drills.

No secrets were read or printed. No source, raw diffs, PR text, customer payloads, checkout paths, installation tokens, or private keys were recorded. No existing `zr9959/ai-saas-guard` compact `scan:` records were deleted.

| Area | Evidence | Status |
| --- | --- | --- |
| Rollback target | Current Worker version before the drill was `8744d3db-0114-4653-85e2-f1554ff1b26b` (`scannerVersion: "0.43.0"`). Previous known-good rollback target was `6de0811e-11bf-46a6-9b7b-cbecda409695` (`scannerVersion: "0.42.0"`). | Passed |
| Rollback execution | `npx wrangler rollback 6de0811e-11bf-46a6-9b7b-cbecda409695 --message "staging rollback drill to previous known-good v0.42"` completed successfully and created active deployment `7b73687d-a6d7-409f-b6f8-fd29f592706e` at `2026-05-26T02:18:38.627515Z`. | Passed |
| Rollback health | After rollback, `/healthz` and `/github/app/install-info` returned HTTP success with `scannerVersion: "0.42.0"` and all privacy flags false for raw webhook payloads, PR text, source, diffs, secrets, customer payloads, checkout paths, and installation tokens. | Passed |
| Restore execution | `npx wrangler rollback 8744d3db-0114-4653-85e2-f1554ff1b26b --message "staging rollback drill restore current v0.43"` completed successfully and created active deployment `b6d59d34-5f93-45b9-8777-0ba0aee9273d` at `2026-05-26T02:19:07.697861Z`. | Passed |
| Restore health | After restore, `/healthz` and `/github/app/install-info` returned HTTP success with `scannerVersion: "0.43.0"`, selected-repository install wording, and all privacy flags false. | Passed |
| Affected Check Run identification | Hosted `scan:` keys identify records by installation ID, repository ID, PR number, head SHA, and scanner version. The current repository records use prefix `scan:135085075:1247239389:`. | Passed |
| Provider-store deletion drill | A dedicated test compact key under prefix `scan:135085075:900000526:` was created with TTL, listed, deleted by exact key, and the same prefix listed as `[]` afterward. Existing repository records were not deleted. | Passed for exact compact-record deletion |
| Webhook rejection check | A synthetic invalid-signature webhook request returned HTTP `400`, `stage: "signature"`, `reason: "invalid_signature"`, and privacy flags false. | Passed for controlled rejection behavior |
| GitHub App repository-removal cleanup event | Attempting to list installation repositories through the current `gh` user token returned HTTP `403` requiring additional user-to-server App authorization. No temporary GitHub repo was created because deletion could not be guaranteed, and the current `ai-saas-guard` repository installation was not removed because that would delete existing evidence. | Blocked on safe test installation or authorized App-management session |

Gate impact: rollback evidence is now present for the staging Worker, and exact compact-record deletion was proven for a dedicated test key. Full uninstall/repository-removal proof remains blocked until a safe test repository or installation can be added and removed without touching existing project evidence.

Validation:

```bash
git diff --check
npm run build && node --test tests/hosted-beta.test.mjs
```

Result: docs diff check passed, build passed, and 2 hosted beta tests passed.

Gate recheck with the new rollback evidence set to true still returned:

- Phase 4 `readyForPublicBeta: false`
- Phase 4 blocked reasons: `phase3_gate_missing`, `rate_limit_missing`, `abuse_kill_switch_missing`, `uninstall_deletion_proof_missing`, `incident_owner_missing`, `support_path_missing`
- Phase 5 `readyForTeamUse: false`
- Phase 5 blocked reasons: `hosted_beta_gate_missing`, `org_policy_config_missing`, `required_status_check_docs_missing`, `suppression_audit_missing`, `reviewer_checklist_missing`, `release_evidence_export_missing`, `team_docs_missing`, `admin_bypass_docs_missing`, `retention_policy_docs_missing`

## 2026-05-26 Human Support And Incident Routing

Recorded on 2026-05-26 after the user asked to process the remaining human blockers.

This evidence covers human routing and support ownership only. It does not fabricate design-partner feedback, provider alert exports, or GitHub App uninstall/repository-removal proof.

| Area | Evidence | Status |
| --- | --- | --- |
| Incident owner | [hosted-support-incident-ownership.md](hosted-support-incident-ownership.md) records `@zr9959` as primary incident owner for hosted staging Worker, GitHub App selected-repository install, compact KV records, and public docs. | Passed for primary ownership |
| Backup coverage | The same document records a pause-hosted fallback: if no independent backup human is available, hosted beta must stay paused or closed rather than rely on unattended operations. | Passed as safety fallback; not a staffed second operator |
| Support path | Public-safe support routes now include GitHub issue templates for bug reports, false positives, false negatives, quickstart feedback, rule requests, security-safe reports, and hosted support requests. Sensitive reports route to GitHub private vulnerability reporting. | Passed |
| Response expectations | Hosted install failure and deletion requests have a 2-business-day staging first-response expectation; false positives and false negatives have a 5-business-day staging first-response expectation; incidents require same-day action when actively operating hosted staging. | Passed |
| Public safety boundary | Support and incident docs forbid source files, raw diffs, PR title/body/comments, secrets, tokens, cookies, certificates, database URLs, customer payloads, private URLs, checkout paths, installation tokens, and raw provider logs in public issues. | Passed |
| Design-partner feedback | Issue [#93](https://github.com/zr9959/ai-saas-guard/issues/93) still has no real DP-1, DP-2, or DP-3 feedback. | Still blocked on real participants |

Gate impact: `incident_owner_missing` and `support_path_missing` can now be treated as resolved for staging gate rechecks that accept a pause fallback instead of an independent backup operator. Public beta remains blocked on missing provider controls, full deletion proof, provider alert evidence, and real design-partner feedback.

Validation:

```bash
git diff --check
ruby -e 'require "yaml"; Dir[".github/ISSUE_TEMPLATE/*.yml"].each { |f| YAML.load_file(f); puts "ok #{f}" }'
npm run build && node --test tests/hosted-beta.test.mjs
```

Result: docs diff check passed, GitHub issue template YAML parsed, build passed, and 2 hosted beta tests passed.

Gate recheck with rollback, primary incident owner, and support path evidence set to true still returned:

- Phase 4 `readyForPublicBeta: false`
- Phase 4 blocked reasons: `phase3_gate_missing`, `rate_limit_missing`, `abuse_kill_switch_missing`, `uninstall_deletion_proof_missing`
- Phase 5 `readyForTeamUse: false`
- Phase 5 blocked reasons: `hosted_beta_gate_missing`, `org_policy_config_missing`, `required_status_check_docs_missing`, `suppression_audit_missing`, `reviewer_checklist_missing`, `release_evidence_export_missing`, `team_docs_missing`, `admin_bypass_docs_missing`, `retention_policy_docs_missing`

## 2026-05-26 GitHub App Management Proof Attempt

Recorded on 2026-05-26 after the user authorized an app-management session attempt.

The proof was scoped to a temporary private test repository. The current `zr9959/ai-saas-guard` repository was not removed from the GitHub App installation, and existing project compact `scan:` records were not deleted.

| Area | Evidence | Status |
| --- | --- | --- |
| Temporary test repository | Temporary private repository `zr9959/ai-saas-guard-app-proof-20260526` was created for proof only. Its REST repository ID was `1249767506`. | Created for proof |
| Add to GitHub App installation | Attempted `PUT /user/installations/135085075/repositories/1249767506` using a classic PAT session with `repo` and `user` scopes. GitHub returned HTTP `403` with message `You do not have permission to modify this app on zr9959.` | Blocked by GitHub App installation management permission |
| Repository-removal webhook proof | Not attempted because adding the temporary repository to the installation failed. No repository-removal event could be generated safely. | Blocked |
| Cleanup | The temporary private repository was deleted after the failed add attempt. | Passed |
| Privacy review | No secrets, tokens, private keys, installation tokens, source, diffs, PR text, checkout paths, customer payloads, private URLs, or raw provider logs were recorded. | Passed |

Result: full GitHub App add/remove uninstall proof remains blocked on an App-management session with permission to modify the `ai-saas-guard-hosted` installation, or on a separate safe test installation controlled for this proof.

## 2026-05-26 Phase 3 Source-Checkout Gate Recheck

Recorded on 2026-05-26 before working on the remaining hosted beta blockers.

This was a read-only recheck against the current live hosted Worker and current repository evidence. It did not change Cloudflare configuration, GitHub App installation state, npm packaging, or compact KV records.

| Area | Evidence | Status |
| --- | --- | --- |
| Live hosted endpoint | `https://ai-saas-guard-hosted.zr9959.workers.dev/healthz` returned `ok: true`, `mode: webhook-ingress`, `storage: cloudflare_kv`, `checkRunPublisher: configured`, and `scannerVersion: 0.43.0`. | Healthy webhook ingress |
| Privacy flags | The health response reported no raw webhook payload, PR text, source, diffs, secrets, customer payloads, private checkout paths, or installation tokens. | Passed |
| Phase 3 source-checkout worker shape | The live endpoint did not report the Node/container source-checkout platform or both `webhook-ingress` and `scan-worker` roles required by the deployed source-checkout evidence path. | Still blocked |

Result: `phase3_gate_missing` remains a real blocker. Do not mark `phase3GatePassed` true until a deployed source-checkout worker or equivalent deployed scan-worker evidence proves trusted checkout identity, temporary credential cleanup, fixed scanner command, success and failure cleanup, safe log boundary, and retention/uninstall cleanup.

## 2026-05-26 Hosted Rate Limit And Kill Switch Evidence

Recorded on 2026-05-26 after adding deployed Cloudflare ingress controls.

| Area | Evidence | Status |
| --- | --- | --- |
| Rate-limit implementation | `tests/cloudflare-worker.test.mjs` covers per-installation and per-repository pull request webhook rate limiting. Over-limit requests return HTTP `429`, `stage: rate_limit`, `reason: repository_rate_limited`, a compact retry window, no Check Run side effect, and no new `delivery:` or `scan:` record for the blocked delivery. | Passed |
| Rate-limit deployment | `npx wrangler deploy --dry-run` showed `RATE_LIMIT_MAX_EVENTS_PER_REPOSITORY_PER_MINUTE` and `RATE_LIMIT_WINDOW_SECONDS` bindings. `npx wrangler deploy` published Worker version `83592bb8-1059-4d5e-b581-3e4d44b5d58b`. | Passed |
| Public health evidence | `GET /healthz` returned `rateLimit: configured`, `abuseKillSwitch: configured`, `processingPaused: false`, `scannerVersion: 0.43.0`, and safe privacy flags. | Passed |
| Kill switch implementation | `tests/cloudflare-worker.test.mjs` covers `HOSTED_PROCESSING_PAUSED=true`; eligible signed pull request webhooks are accepted as `stage: paused`, no compact delivery/scan records are written, and no GitHub network call is made. | Passed |
| Runtime pause drill | Set KV key `control:hosted_processing_paused` to `true`; `/healthz` returned `processingPaused: true`. Reset the same key to `false`; `/healthz` returned `processingPaused: false`. | Passed and restored |
| Privacy review | No raw webhook payloads, PR title/body text, source, diffs, secrets, customer payloads, private checkout paths, installation tokens, or private URLs were recorded. | Passed |

Validation:

```bash
npm run build && node --test tests/cloudflare-worker.test.mjs tests/hosted-beta.test.mjs
npx wrangler deploy --dry-run
npx wrangler deploy
curl -fsSL https://ai-saas-guard-hosted.zr9959.workers.dev/healthz
npx wrangler kv key put control:hosted_processing_paused true --namespace-id fa5344fbd7944de6a776bf8731d58460 --remote
curl -fsSL https://ai-saas-guard-hosted.zr9959.workers.dev/healthz
npx wrangler kv key put control:hosted_processing_paused false --namespace-id fa5344fbd7944de6a776bf8731d58460 --remote
curl -fsSL https://ai-saas-guard-hosted.zr9959.workers.dev/healthz
```

Gate recheck with rate-limit and abuse kill-switch evidence set to true returned:

- Phase 4 `readyForPublicBeta: false`
- Phase 4 blocked reasons: `phase3_gate_missing`, `uninstall_deletion_proof_missing`
- Phase 5 `readyForTeamUse: false`
- Phase 5 blocked reasons: `hosted_beta_gate_missing`, `org_policy_config_missing`, `required_status_check_docs_missing`, `suppression_audit_missing`, `reviewer_checklist_missing`, `release_evidence_export_missing`, `team_docs_missing`, `admin_bypass_docs_missing`, `retention_policy_docs_missing`

## Remaining Release Gate Gaps

The deployed Cloudflare Worker now receives signed GitHub App webhook delivery for pull request events and publishes bounded compact Check Runs. This is still staging evidence, not production hosted exposure.

The hosted release gate still requires fresh deployed evidence for:

- full Node/container read-only checkout scan worker deployment
- worker sandbox network restrictions and cleanup evidence
- logs, metrics, alerting, rollback, and incident-response drills
- dependency and container artifact scanning for the deployed worker image
- retention and uninstall cleanup against the deployed provider stores

Source-candidate executable evidence now exists in `ai-saas-guard/hosted/staging-harness`: `createHostedStagingReleaseEvidenceBundle` combines signed webhook replay, success and failure cleanup probes, safe worker failure reasons, and `validateHostedLogBoundary` samples into hosted release-gate evidence, then `evaluateHostedStagingReleaseEvidenceBundle` runs the same gate evaluator used by deployment planning. This improves local release readiness, but it is still not production hosted exposure and does not replace deployed worker, logging, metrics, rollback, incident-response, dependency, or container evidence.

Deployed worker staging evidence now has its own helper in `ai-saas-guard/hosted/deployed-staging`: `createHostedDeployedWorkerStagingEvidenceBundle` accepts public HTTPS health, deployed webhook replay, worker cleanup, log-boundary, and external CI/scan/rollback evidence summaries, then `evaluateHostedDeployedWorkerStagingReleaseGate` evaluates the same hosted release gate. Use [hosted-deployed-worker-staging.md](hosted-deployed-worker-staging.md) before exposing a Node/container read-only checkout worker beyond staging.

## Read-Only Checkout Worker Evidence Checklist

Before any hosted source checkout worker is exposed beyond staging, attach fresh evidence for each row below. The current Cloudflare ingress evidence above does not satisfy these rows because it publishes compact PR-risk signals without running a full source checkout scan worker.

| Evidence area | Required proof | Status before hosted exposure |
| --- | --- | --- |
| Trusted checkout identity | Worker input is derived from signed GitHub event identity, selected-repository installation scope, and repository `contents: read`; PR title, body, branch names, README, and code cannot choose the repository, token scope, checkout path, or command | Required |
| Runtime credential boundary | Installation credentials are passed to git only through temporary askpass material, are removed before the CLI scan phase, and are never returned in worker output, compact reports, Check Runs, or logs | Required |
| Fixed scanner command | Worker runs the fixed read-only command shape `ai-saas-guard pr-risk --root <worker-checkout> --base <trusted-base-sha> --json` without shell parsing or PR-authored arguments, and rejects command, checkout, or token-scope mutations before running git | Required |
| Success cleanup | A successful worker run deletes the checkout directory, askpass material, generated JSON/SARIF scratch files, and any local package tarballs | Required |
| Failure cleanup | A failed clone, timeout, CLI non-zero exit, malformed JSON output, Check Run write failure, cancellation, or process interruption still attempts checkout deletion and records only a safe cleanup status | Required |
| Log boundary | Logs may include scan key, installation ID, repository ID, PR number, head SHA, scanner version, duration, summary counts, error class, and cleanup status; logs must include no raw source, no raw diffs, no secrets, no installation tokens, no customer payloads, no private URLs, and no checkout paths | Required |
| Retention boundary | Compact report retention and uninstall cleanup delete repository-scoped records and worker checkout references without exposing low-level cleanup errors | Required |

Use the checklist above together with [hosted-operational-release-gate.md](hosted-operational-release-gate.md). The release remains blocked until deployed worker evidence covers success, failure cleanup, log boundary sampling, monitoring, rollback, and incident response.

## Smoke Procedure

Use this sequence after each hosted Worker deployment:

```bash
curl -fsSL https://ai-saas-guard-hosted.zr9959.workers.dev/healthz
npx wrangler deployments list
npx wrangler kv key list --namespace-id fa5344fbd7944de6a776bf8731d58460 --remote
```

Then open a temporary no-file-change PR, wait for an `ai-saas-guard PR risk` Check Run on the smoke commit, and close the PR plus delete the branch. After the smoke run, verify no temporary KV records remain unless a retained compact report is intentionally part of that test.

Do not leave smoke PRs, scratch branches, package tarballs, SARIF files, or test KV records behind.

The executable path for this procedure is:

```bash
node scripts/hosted-pr-smoke.mjs --plan
node scripts/hosted-pr-smoke.mjs --evidence-file /tmp/ai-saas-guard-hosted-smoke.json
```

The script is the preferred release-gate evidence path for the current Cloudflare hosted ingress. It creates a temporary `codex/hosted-smoke-*` branch and PR, waits for the hosted `ai-saas-guard PR risk` Check Run, records only public-safe Check Run metadata plus cleanup status, closes the PR, deletes the branch, restores the local branch, and bulk-deletes staging KV `delivery:` and `scan:` records. It refuses to target repositories outside `zr9959/ai-saas-guard` and does not print source, diffs, secrets, installation tokens, customer payloads, or checkout paths.

The script also refuses to run against a dirty working tree, queries the trusted head SHA Check Run through `gh api --method GET`, writes an optional `--evidence-file` JSON record with mode `0600`, and attempts remote branch deletion even if PR creation or Check Run polling fails. That makes it suitable for release evidence because failure paths still exercise cleanup instead of leaving smoke resources behind.
