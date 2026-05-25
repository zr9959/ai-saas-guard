# Hosted Operations Evidence

This document records deployed hosted-service evidence for `ai-saas-guard`.

Passing these checks does not make the project a pentest, certification, or full security audit. The goal is narrower: keep hosted rollout claims tied to fresh operational evidence.

## Current Evidence

Recorded on 2026-05-25 from the deployed Cloudflare Worker plus temporary GitHub PR smokes.

| Check | Evidence | Result |
| --- | --- | --- |
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
