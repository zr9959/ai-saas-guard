# Hosted Next Proof Plan

This plan is for the remaining non-user blockers after the hosted ingress rate limit and abuse kill switch evidence passed.

It does not open public beta. It does not add billing, pricing, paid packaging, marketplace conversion, sales funnel, customer accounts, or commercialization.

## Current Blocking State

The current live hosted endpoint is the Cloudflare Worker ingress:

- mode: `webhook-ingress`
- storage: `cloudflare_kv`
- check-run publisher: configured
- rate limit: configured
- abuse kill switch: configured
- scanner version: `0.43.0`

It is not a deployed `node_container` source-checkout worker and does not expose both `webhook-ingress` and `scan-worker` roles.

## Proof 1: Deployed Source-Checkout Worker

Goal: replace `phase3_gate_missing` with real deployed evidence, not a boolean override.

Required before attempting proof:

- a deployed Node/container artifact or equivalent worker runtime
- public HTTPS `/healthz`
- roles reported as `webhook-ingress` and `scan-worker`
- scanner version matching the candidate
- platform secrets managed outside the repository
- durable queue or job table
- compact report store
- sandboxed read-only checkout runner
- GitHub Checks publisher
- no raw source, raw diff, PR text, checkout path, customer payload, or installation token in logs or outputs

Evidence to collect:

- public-safe health response
- signed webhook replay summary
- successful source-checkout run with cleanup
- failure source-checkout run with cleanup
- log-boundary sample review
- compact report storage proof
- Check Run publication proof
- release gate output from `ai-saas-guard/hosted/deployed-staging`

Pass condition:

- `evaluateHostedDeployedWorkerStagingReleaseGate` has no blocker for the deployed source-checkout candidate
- `evaluateHostedSourceCheckoutTrialGate` can be set true from real evidence

## Proof 2: GitHub App Uninstall And Repository Removal

Goal: replace `uninstall_deletion_proof_missing` with a real GitHub App event proof.

Required before attempting proof:

- a GitHub session that can modify the `ai-saas-guard-hosted` installation, or
- a separate safe test installation controlled for this proof

Do not remove the current `zr9959/ai-saas-guard` installation just to create evidence.

Safe proof path:

1. Create a temporary private test repository.
2. Add only that repository to the safe test installation.
3. Create one dedicated compact `scan:<installation>:<repository>:` test record.
4. Remove the repository from the installation.
5. Wait for the signed `installation_repositories` event.
6. Verify only the matching compact `scan:` records were deleted.
7. Delete the temporary repository.
8. Verify no test records, temp repo, smoke branches, or temp files remain.

Pass condition:

- compact record count before and after is recorded safely
- unrelated installation or repository records remain untouched
- the event path is signed and processed by the deployed Worker

## Proof 3: Provider Monitoring And Alerts

Goal: show operators can see and respond to failures without raw logs.

Current ingress evidence exists for health, rollback, rate limit, pause, and primary ownership. Full source-checkout monitoring evidence still requires a deployed source-checkout worker.

Required evidence:

- webhook rejection and 5xx alert
- queue depth or job backlog metric
- worker failure and timeout metric
- Check Run write failure metric
- checkout cleanup failure metric
- compact retention/deletion failure metric
- owner and response expectation for each alert

Pass condition:

- each metric or alert has safe name, threshold, owner, sample timestamp, and result
- no raw logs, source, diffs, tokens, private URLs, customer payloads, or checkout paths are recorded

## Proof 4: Source-Checkout Rollback And Incident Drill

Goal: prove a bad source-checkout worker can be paused and rolled back without asking users to change repository code.

Required before attempting proof:

- at least two deployed source-checkout worker artifacts
- known-good previous artifact reference
- runtime pause path
- health check for each artifact
- affected Check Run identification by installation ID, repository ID, PR number, head SHA, and scanner version

Pass condition:

- rollback starts from the source-checkout candidate
- pause prevents new source-checkout side effects
- previous artifact restores healthy source-checkout status
- privacy flags remain safe
- incident owner and support path are recorded

## Proof 5: Release Health Maintenance

Run these checks at the end of hosted evidence tasks:

```bash
git status --short --branch
npm view ai-saas-guard version
npx --yes ai-saas-guard@latest demo --summary
curl -fsSL https://ai-saas-guard-hosted.zr9959.workers.dev/healthz
```

Expected:

- git worktree is clean or only intentional files are changed
- npm latest remains the intended release
- npx demo runs
- hosted health returns safe privacy flags
- `processingPaused` is `false` unless there is an active incident

Do not publish a new npm package unless `package.json` is intentionally bumped, a reviewed tag exists, and the trusted publish workflow is used.
