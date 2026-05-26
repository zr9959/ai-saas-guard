# Hosted Operator Runbook

This runbook defines the minimum privacy-safe operator workflow before hosted public beta. It is an operating checklist, not evidence by itself. Public beta remains blocked until these steps are exercised against deployed artifacts and recorded in [hosted-operations-evidence.md](hosted-operations-evidence.md).

Use this with:

- [hosted-operational-release-gate.md](hosted-operational-release-gate.md)
- [hosted-operations-evidence.md](hosted-operations-evidence.md)
- [hosted-support-incident-ownership.md](hosted-support-incident-ownership.md)
- [public-beta-evidence-feedback.md](public-beta-evidence-feedback.md)
- GitHub issue [#94](https://github.com/zr9959/ai-saas-guard/issues/94)

## Safety Boundary

Never print, commit, paste, or store:

- `WEBHOOK_SECRET`
- `GITHUB_APP_PRIVATE_KEY`
- installation tokens
- raw webhook payloads
- PR title, body, comments, or untrusted prose
- source files
- raw diffs
- customer payloads
- private URLs
- checkout paths
- database URLs

Every operator note should use safe IDs, counts, timestamps, scanner version, status class, and compact record prefixes only.

## Current Hosted Shape

The current deployed hosted path is the Cloudflare Worker ingress at:

```text
https://ai-saas-guard-hosted.zr9959.workers.dev
```

It currently handles signed webhook intake, compact KV records, PR file metadata classification, and bounded Check Run publication. It is not yet a full deployed source-checkout scan worker.

## Health Check

Run before and after any hosted operation:

```bash
curl --retry 3 --retry-delay 2 -fsSL https://ai-saas-guard-hosted.zr9959.workers.dev/healthz
curl --retry 3 --retry-delay 2 -fsSL https://ai-saas-guard-hosted.zr9959.workers.dev/github/app/install-info
```

Expected safe result:

- HTTP success
- `scannerVersion` matches the intended release
- privacy flags remain false for raw webhook payloads, PR text, source, diffs, secrets, customer payloads, checkout paths, and installation tokens
- selected-repository permission wording remains present

If any privacy flag changes to true, stop exposure and treat it as a release blocker.

## Pause Workflow

Use the narrowest pause that stops new hosted side effects without requiring users to change repository code.

Preferred pause order:

1. Pause or disable worker consumption if a queue-backed worker is deployed.
2. If only the Cloudflare ingress is deployed, set the runtime KV pause key so eligible pull request webhooks are accepted as paused before compact records or Check Runs are written.
3. If the issue is GitHub App-specific, temporarily suspend webhook delivery or selected-repository installation only after recording the affected installation and repository IDs.

Current Cloudflare ingress pause:

```bash
npx wrangler kv key put control:hosted_processing_paused true --namespace-id fa5344fbd7944de6a776bf8731d58460 --remote
curl --retry 3 --retry-delay 2 -fsSL https://ai-saas-guard-hosted.zr9959.workers.dev/healthz
```

Resume after mitigation:

```bash
npx wrangler kv key put control:hosted_processing_paused false --namespace-id fa5344fbd7944de6a776bf8731d58460 --remote
curl --retry 3 --retry-delay 2 -fsSL https://ai-saas-guard-hosted.zr9959.workers.dev/healthz
```

Evidence to record:

- pause method
- timestamp
- operator
- affected environment
- scanner version
- whether new compact records stopped appearing
- whether new Check Runs stopped appearing

Do not record raw webhook payloads or PR text.

## Queue And Failure Checks

For the current Cloudflare KV-backed staging ingress, inspect compact record presence by prefix:

```bash
npx wrangler kv key list --namespace-id fa5344fbd7944de6a776bf8731d58460 --remote
```

Current eligible pull request webhook rate limit:

- key shape: `rate:pull_request:<installation-id>:<repository-id>`
- configured staging limit: 30 accepted eligible pull request webhooks per installation and repository per 60 seconds
- rejection response: HTTP 429 with `stage: rate_limit`, `reason: repository_rate_limited`, and a compact retry window

Rate-limit counters are compact operational records only. Do not record PR title/body text, raw webhook payloads, source, diffs, secrets, installation tokens, private URLs, customer payloads, or checkout paths.

For a future durable queue-backed worker, collect provider metrics for:

- queue depth
- retry count
- dead-letter count
- worker failure rate
- worker timeout rate
- Check Run write failure rate
- cleanup failure rate
- retention failure rate

Evidence to record:

- metric or key prefix inspected
- safe count
- threshold
- owner
- first response expectation
- status: passed, failed, or blocked

Do not paste raw log lines unless they have been reviewed against the privacy boundary.

## Rollback Workflow

Rollback must not require users to change repository code or reinstall the GitHub App.

Minimum rollback drill:

1. Record the current deployed Worker version.
2. Identify the previous known-good Worker version or container artifact.
3. Pause worker consumption or controlled ingress processing.
4. Redeploy the previous artifact.
5. Run the health check.
6. Confirm affected Check Runs can be identified by installation ID, repository ID, PR number, head SHA, and scanner version.
7. Resume processing only after health and privacy flags are safe.

Current version lookup:

```bash
npx wrangler deployments list
```

Evidence to record:

- previous artifact reference
- rollback start and end time
- pause/resume result
- health result
- affected Check Run identification method
- operator
- whether rollback avoided raw source, diffs, secrets, private URLs, checkout paths, and installation tokens

## Compact Record Deletion

Only delete compact records during an explicit smoke cleanup, uninstall cleanup, repository removal cleanup, retention job, or approved support/deletion request.

Before deleting:

1. Confirm the deletion reason.
2. Confirm the exact selected repository or smoke test label.
3. List matching compact keys by safe prefix.
4. Record count before deletion.
5. Delete only the matching keys.
6. Record count after deletion.

Safe prefixes:

- `delivery:`
- `scan:`

Do not bulk-delete all keys unless the task is an explicit staging smoke cleanup and the cleanup target is known.

Evidence to record:

- deletion reason
- safe prefix
- count before
- count after
- operator
- timestamp
- whether any remaining matching records need follow-up

## Incident Escalation

Ownership and support routing are recorded in [hosted-support-incident-ownership.md](hosted-support-incident-ownership.md). During staging, `@zr9959` is the primary incident and support triage owner. If no independent backup is staffed, hosted beta must stay paused or closed rather than rely on unattended operations.

Open an incident when any of these happen:

- privacy flag unexpectedly changes
- webhook rejection or 5xx rate spikes
- queue depth exceeds threshold
- worker failure or timeout rate exceeds threshold
- Check Run write failures exceed threshold
- cleanup failure occurs
- compact record deletion fails
- uninstall cleanup fails
- credential rotation fails

Minimum incident record:

- incident owner
- backup owner
- environment
- scanner version
- safe impact summary
- first mitigation
- rollback decision
- support/status path
- privacy review result

Do not include raw source, raw diffs, PR prose, secrets, customer payloads, private URLs, checkout paths, installation tokens, or raw provider logs.

## Support Triage

Public-safe hosted support requests use the `Hosted support request` GitHub issue template. Sensitive reports must use GitHub private vulnerability reporting instead of public issues.

For install failures, false positives, false negatives, Check Run confusion, or deletion requests:

1. Ask for scanner version and path used: local CLI, GitHub Action, or hosted Check Run.
2. Ask for rule IDs, severity counts, and sanitized file categories.
3. Ask what the user expected and whether the output affects launch or merge behavior.
4. Do not ask for source, raw diffs, PR text, secrets, raw logs, customer payloads, or private URLs.
5. Link the support item to a public-safe GitHub issue only after sanitizing details.

## Evidence Template

```markdown
## Operator Evidence

- Date:
- Operator:
- Environment:
- Scanner version:
- Operation: health | pause | queue-check | rollback | deletion | incident | support
- Safe evidence source:
- Safe summary:
- Privacy review: no source, diffs, PR prose, secrets, customer payloads, private URLs, checkout paths, or installation tokens
- Result: passed | failed | blocked
- Follow-up owner:
- Follow-up due:
```

## Cleanup

Every operator task must end with:

- temporary files removed from `/tmp` unless intentionally retained outside the repo
- smoke PRs closed
- smoke branches deleted locally and remotely
- staging KV smoke records cleaned only when the task is an explicit smoke cleanup
- package tarballs and scratch SARIF/JSON removed
- no long-running test, worker, queue, watcher, or dev-server process left running
- `git status --short --branch` reviewed before handoff
