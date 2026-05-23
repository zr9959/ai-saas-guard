# Hosted Pre-Implementation Contracts

This document collects pure hosted contracts that can be tested before any hosted GitHub App service is deployed. These contracts keep the hosted design inspectable, local-first, and implementation-ready without adding network calls, credentials, queues, workers, or GitHub API writes. They are no network calls contracts by design.

The helpers live in `src/hosted/contracts.ts` and are exported from `ai-saas-guard/hosted/contracts`.

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
- cap check-run text with bounded Markdown so oversized reports cannot create unbounded API payloads

Privacy boundaries:

- render only compact report fields
- include rule IDs, severities, file paths, and line numbers as evidence
- do not include raw source, raw diffs, secret values, webhook payload bodies, customer payloads, or private URLs
- preserve `modelTraining: disabled`

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

- accepted pull request events build the expected trusted scan identity
- unsupported actions are rejected
- draft pull requests are rejected by default
- draft pull requests can be allowed explicitly
- missing required fields are rejected
- untrusted PR text cannot override trusted identity
- check-run summary renderer conclusions stay success, neutral, or failure based on explicit compact-report rules
- bounded Markdown truncates large check-run text and points readers to the local CLI
- rendered summaries do not expose raw source, raw diffs, secret values, or customer payloads
- queue cleanup planner cancels only matching repository-scoped queued work
- queue cleanup planner handles installation-scoped cleanup without touching other installations
- idempotent repeated cleanup preserves terminal jobs and does not create duplicate cancellation work
- worker checkout cleanup planner covers success, failure, timeout, cancellation, and cleanup_failure terminal states
- worker checkout cleanup planner returns safe metadata only and never returns checkout paths
- cleanup_failure requires manual cleanup review without exposing low-level cleanup errors

Fixtures must be synthetic and public-safe. They must not include real credentials, customer payloads, private URLs, raw source, or raw diffs.
