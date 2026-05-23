# Hosted Pre-Implementation Contracts

This document collects pure hosted contracts that can be tested before any hosted GitHub App service is deployed. These contracts keep the hosted design inspectable, local-first, and implementation-ready without adding network calls, credentials, queues, workers, or GitHub API writes. They are no network calls contracts by design.

The helpers live in `src/hosted/contracts.ts` and are exported from `ai-saas-guard/hosted/contracts`.

## Pull Request Webhook Intake Planner

The pull request webhook intake planner is the first pure implementation slice for the future hosted service. It composes the earlier contracts into one safe order without starting a server or calling GitHub APIs.

Default behavior:

- verify `X-Hub-Signature-256` before parsing JSON, queueing work, authorizing token scope, or planning repository fetches
- reject invalid, missing, malformed, or replayed signatures before payload parsing
- parse only signed pull request payloads
- derive scan identity from trusted GitHub event fields through the webhook event parser
- authorize selected-repository installation scope before any fetch is planned
- upsert one idempotent scan job by installation, repository, pull request, head SHA, and scanner version
- default to check-run-only output; PR comments remain disabled for the first hosted slice

Privacy boundaries:

- return only trusted identity, queue metadata, stage, reason, and booleans needed by an ingress or worker
- do not return raw webhook payloads, untrusted PR text, raw source, raw diffs, secrets, or customer payloads
- keep local CLI usage independent from the hosted service

The exported helper is `planHostedPullRequestWebhookIntake`. It is intentionally service-free: callers still need a real webhook server, queue provider, installation token lookup, worker checkout, scanner execution, compact report storage, and GitHub Checks API writer before any hosted environment exists.

## Durable Scan Queue Planner

The durable scan queue planner defines how the future hosted service should create or reuse scan jobs once a signed pull request webhook has produced trusted scan identity. It is a pure planner only: it does not connect to a queue provider, run a worker, fetch source, write reports, or call GitHub APIs.

Default behavior:

- compute the same logical scan key from installation ID, repository ID, pull request number, head SHA, and scanner version
- create one queued job when no matching job exists
- reuse existing queued, running, or completed jobs for duplicate deliveries
- reuse completed compact reports instead of enqueueing duplicate worker work
- allow manual reruns to increment `attempt` while keeping the same logical scan key
- keep the first hosted slice check-run-only; PR comments remain disabled

Queue payload boundaries:

- include only scan identity, job key, delivery ID, attempt, requested time, and source
- do not include raw source, raw diffs, secret values, untrusted PR text, webhook payload bodies, customer payloads, private URLs, or worker checkout paths
- return safe queue metadata that can be stored by a durable queue without leaking source code

The exported helper is `planHostedScanQueueUpsert`. It is intended to be the queue-provider-independent contract for the first real hosted queue implementation.

## Worker Read-Only Scan Planner

The worker read-only scan planner defines how a future hosted worker should prepare a scan after the durable queue hands it a trusted job. It is a pure planner only: it does not request installation tokens, create directories, checkout repositories, run the CLI, persist reports, delete files, or call GitHub APIs.

Default behavior:

- authorize the same installation and selected-repository scope before any checkout is planned
- require installation token permissions to be repository `contents: read`
- derive repository ID, repository full name, pull request number, base SHA, head SHA, and scanner version only from trusted scan identity
- plan checkout of the trusted head commit into a temporary worker directory
- plan a fixed read-only CLI invocation: `ai-saas-guard pr-risk --root <worker-checkout> --base <baseSha> --json`
- collect compact JSON output only
- require checkout cleanup after every terminal worker state
- keep PR comments disabled for the first hosted slice

Trust boundaries:

- ignore PR-authored repository names, token scopes, and commands
- do not accept worker command, checkout target, installation ID, repository ID, repository name, or token permissions from PR title, body, comments, branch names, README, or code
- do not return checkout paths, raw source, raw diffs, secret values, customer payloads, private URLs, or installation token values

The exported helper is `planHostedWorkerReadOnlyScan`. It is intended to be the worker-provider-independent contract for the first real hosted worker implementation.

## Webhook Event Parser

The webhook event parser runs after webhook signature verification. It converts a reduced GitHub `pull_request` webhook payload into a queue-safe scan request identity.

Supported actions:

- opened, reopened, synchronize, and ready_for_review

Default behavior:

- accept only supported pull request actions
- reject draft pull requests unless `allowDraft` is explicitly enabled
- derive identity only from trusted GitHub event fields
- return `shouldQueueScanJob: true` only for accepted events
- return a rejection reason for unsupported, draft, or incomplete events

Trusted identity fields:

- `installation.id`
- `repository.id`
- `repository.full_name`
- `pull_request.number`
- `pull_request.base.sha`
- `pull_request.head.sha`
- scanner package version provided by the caller

Untrusted fields:

- untrusted PR title, body, comments, branch names, README, and code

Untrusted fields must not control installation ID, repository ID, repository full name, PR number, base SHA, head SHA, scanner version, token scope, queue key, or worker command.

The parser does not verify signatures itself. Signature verification remains the earlier trust boundary, and failed verification must stop before event parsing, queue writes, token lookup, repository lookup, or worker dispatch.

## Check-Run Summary Renderer

The check-run summary renderer converts a compact hosted report into a bounded Markdown payload suitable for a future GitHub Checks API write. It is a pure renderer only: it does not call GitHub, create a check run, post a PR comment, fetch source, or store report data.

Default behavior:

- use conservative check conclusions
- return `success` when the compact report has no findings
- return `neutral` when findings exist but no explicit failure threshold is configured
- return `failure` only when `failOnSeverity` is set and matching findings are present
- include review-first language that tells readers to verify findings before release
- state that the result is not a full security audit, pentest, or certification
- include a local CLI link through the exact `npx ai-saas-guard@<version> pr-risk --root .` command
- include review categories, files to review first, and verification steps
- cap check-run text with bounded Markdown so oversized reports cannot create unbounded API payloads

Privacy boundaries:

- render only compact report fields
- include rule IDs, severities, file paths, and line numbers as evidence
- do not include raw source, raw diffs, secret values, webhook payload bodies, customer payloads, or private URLs
- preserve `modelTraining: disabled`

## Check-Run Publication Planner

The check-run publication planner turns a compact hosted report into a GitHub Checks API request plan. It is a pure planner only: it does not call GitHub, request installation tokens, write check runs, post PR comments, fetch repositories, or store report data.

Default behavior:

- authorize the same installation and selected-repository scope before planning a Check Run write
- require installation token permissions to include repository `checks: write`
- create a Check Run payload for the trusted head SHA
- use conservative conclusions from the summary renderer: `success` for no findings, `neutral` for review-needed findings, and `failure` only when a configured policy threshold is met
- include bounded Markdown, annotations, categories, verification steps, and the local CLI reproduction command
- keep PR comments disabled for the MVP

Privacy boundaries:

- plan a Check Run from compact report fields only
- do not include raw source, raw diffs, secret values, untrusted PR text, webhook payload bodies, customer payloads, private URLs, or worker checkout paths
- do not create issue comments, review comments, or PR comments

The exported helper is `planHostedCheckRunPublication`. It is intended to be the GitHub-API-independent contract for the first real Check Run writer. PR comments remain an explicit later workflow or paid hosted feature, not part of this MVP contract.

## Queue Cleanup Planner

The queue cleanup planner turns repository removal, installation deletion, and repeated cleanup events into a safe cancellation plan for hosted scan jobs. It is a pure planner only: it does not connect to a queue provider, mutate jobs, delete worker files, call GitHub, or retry work.

Default behavior:

- support repository-scoped cleanup for repository removal
- support installation-scoped cleanup for full GitHub App uninstall
- keep repeated cleanup idempotent with a stable cleanup key
- cancel queued jobs that match the cleanup scope
- request running cancellation for matching jobs already in progress
- preserve terminal jobs that are already completed, failed, or cancelled
- keep unmatched jobs outside the cleanup scope
- return job keys and counts only, not full job payloads

Privacy boundaries:

- do not return raw source, raw diffs, secret values, customer payloads, or worker checkout paths
- do not delete GitHub-owned check runs
- leave worker checkout deletion to the worker checkout cleanup contract

## Worker Checkout Cleanup Planner

The worker checkout cleanup planner defines what should happen to a worker checkout after a scan reaches a terminal state. It is a pure planner only: it does not delete files, inspect the filesystem, shell out, upload logs, or expose the checkout path.

Normal terminal states:

- success
- failure
- timeout
- cancellation

Default behavior for normal terminal states:

- plan worker checkout deletion after scan completion
- remove installation credentials from the worker environment
- remove raw source, raw diffs, and generated worker artifacts from the checkout
- preserve only safe metadata: job key, installation ID, repository ID, repository full name, pull request number, scanner version, terminal state, and finished time
- return `returnsCheckoutPath: false`, `returnsRawSource: false`, `returnsRawDiffs: false`, `returnsSecrets: false`, and `returnsCustomerPayloads: false`

Cleanup failure behavior:

- record `cleanup_failure` as a terminal state
- do not return the checkout path or low-level cleanup error
- require manual cleanup review
- preserve an audit record without exposing checkout contents

## Hosted Compact Report Fixture

A public hosted compact report fixture is available at [examples/hosted-compact-report.json](../examples/hosted-compact-report.json). It is intentionally synthetic and shows the report shape future hosted components can pass between the worker, check-run summary renderer, and retention cleanup logic.

The fixture includes:

- trusted scan identity fields
- summary counts, including an explicit `total`
- rule IDs
- compact evidence with rule ID, severity, file path, and line number
- retention and privacy defaults

The fixture does not include raw source, raw diffs, secret values, webhook payload bodies, customer payloads, private URLs, installation tokens, or worker checkout paths.

## Non-Goals

These contracts do not:

- start a server
- call GitHub APIs
- make network calls
- request installation tokens
- fetch repositories
- write check runs
- post PR comments
- run workers
- store credentials

## Test Requirements

Automated tests must cover:

- signed pull request webhook intake verifies signatures before JSON parsing or queueing
- accepted pull request webhook intake queues one check-run-only scan request from trusted fields
- rejected installation scope stops before repository fetch planning
- durable scan queue planning creates one queued job for a new trusted scan key
- duplicate deliveries reuse queued, running, and completed jobs without enqueueing duplicate worker work
- completed duplicate jobs reuse compact reports
- manual reruns increment attempt without changing the logical scan key
- worker read-only scan planning requires repository `contents: read` permissions
- worker read-only scan planning uses trusted identity for checkout target and fixed CLI command
- worker read-only scan planning does not persist raw source, raw diffs, secrets, customer payloads, checkout paths, PR-authored commands, or PR-authored token scopes
- accepted pull request events build the expected trusted scan identity
- unsupported actions are rejected
- draft pull requests are rejected by default
- draft pull requests can be allowed explicitly
- missing required fields are rejected
- untrusted PR text cannot override trusted identity
- check-run summary renderer conclusions stay success, neutral, or failure based on explicit compact-report rules
- bounded Markdown truncates large check-run text and points readers to the local CLI
- rendered summaries include categories, files to review first, and verification steps
- rendered summaries do not expose raw source, raw diffs, secret values, or customer payloads
- check-run publication planning requires repository `checks: write` permissions
- check-run publication planning creates bounded Check Run payloads from compact reports only
- check-run publication planning keeps PR comments disabled
- queue cleanup planner cancels only matching repository-scoped queued work
- queue cleanup planner handles installation-scoped cleanup without touching other installations
- idempotent repeated cleanup preserves terminal jobs and does not create duplicate cancellation work
- worker checkout cleanup planner covers success, failure, timeout, cancellation, and cleanup_failure terminal states
- worker checkout cleanup planner returns safe metadata only and never returns checkout paths
- cleanup_failure requires manual cleanup review without exposing low-level cleanup errors
- hosted compact report fixture remains schema-compatible and public-safe
- summary counts with an explicit `total` are not double-counted by check-run summaries

Fixtures must be synthetic and public-safe. They must not include real credentials, customer payloads, private URLs, raw source, or raw diffs.
