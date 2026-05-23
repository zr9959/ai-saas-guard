# Hosted Deployment Model

This document chooses the production deployment model for the first hosted GitHub App slice. It is intentionally narrow: it supports signed webhook intake, idempotent scan queueing, read-only worker scans, check run summaries, and compact report storage.

This model does not deploy code by itself and does not replace the local CLI.

## Selected Model

Use a portable, containerized Node.js runtime with two separately deployable roles:

1. `webhook-ingress`: a small HTTPS service that receives GitHub App webhooks, verifies signatures, builds trusted scan identity, and queues scan work.
2. `scan-worker`: a separate short-lived worker process that consumes queued jobs, obtains scoped GitHub access for the selected repository, runs the scanner in read-only mode, writes a check run summary, stores a compact report, and deletes local checkout state.

Use a managed durable queue between those roles. Do not use in-memory queues, direct synchronous scans in the webhook request, or PR-comment side effects in the first slice.

The first production deployment can run in one primary region. GitHub webhook processing is not latency-sensitive enough to justify edge-only execution before the worker isolation and logging model are proven.

## Why This Model

The scanner needs normal Node.js file-system behavior and predictable process isolation. A containerized Node.js runtime keeps the hosted worker close to the existing npm package and avoids a separate edge-only scanner implementation.

Separating ingress from workers keeps the signed webhook trust boundary small:

- ingress verifies and queues
- workers fetch and scan
- compact reports are stored separately
- check runs are the only first-slice GitHub output

This keeps operational failure modes understandable. If workers fall behind, webhook verification still stays fast and queue depth becomes the visible back-pressure signal.

## Runtime Choice

Use Node.js 24 in containers for both roles. The public package and CI already exercise Node.js 24, so the hosted runtime should match the tested package runtime before introducing additional platform variance.

Webhook ingress requirements:

- terminate HTTPS through the platform load balancer or managed route
- accept only the GitHub App webhook path
- verify the webhook signature before any queue write, repository lookup, token lookup, or worker dispatch
- reject malformed, missing, invalid, and replayed deliveries before side effects
- parse only the minimal trusted event fields needed for scan identity
- enqueue a small job payload
- return quickly without fetching repository content

Worker requirements:

- consume one queue job at a time or use bounded concurrency
- authorize installation and repository scope before source fetch
- create a short-lived checkout directory per attempt
- run the scanner package version recorded in the job
- write or update one check run summary
- store compact report metadata only
- delete checkout directories after completion or terminal failure

## Queue Choice

Use a managed durable queue with at-least-once delivery, retry controls, dead-letter support, and observable queue depth.

The queue message should contain only:

- delivery ID
- event action
- installation ID
- repository ID
- repository full name
- pull request number
- base SHA
- head SHA
- scanner version
- attempt metadata

The idempotency key remains:

```text
installationId:repositoryId:pullRequestNumber:headSha:scannerVersion
```

Queue consumers must treat duplicate delivery as normal. A duplicate message should reuse the same logical report or update the same queued/running job, not create duplicate check runs.

## Data Store Choice

Use a managed relational store for compact reports and job state. The first schema should be small:

- installations
- repositories
- scan jobs
- scan attempts
- compact reports
- delivery IDs for replay protection

The store should not contain raw source, raw diffs, secrets, customer payloads, private URLs, private comments, or full file contents.

## Worker Isolation

Each scan attempt should run in a clean working directory with no shared checkout state between repositories. A worker may reuse the container image, but it must not reuse repository files across jobs.

Minimum worker isolation rules:

- no repository write token
- no shell commands from PR title, body, comments, branch names, README, or code
- no repository identity from untrusted PR text
- no broad organization installation assumption
- no shared checkout directory
- no source retention after job completion
- no outbound calls except the platform services needed for GitHub fetch, package/runtime operation, queue, report store, and logs

Worker cleanup must be observable. A terminal success, terminal failure, timeout, or cancellation should all attempt to delete checkout directories.

## Secret Storage

Use the platform secret manager for hosted credentials and signing material. Do not store sensitive hosted credentials in the repository, queue payloads, compact reports, or logs.

Secret handling rules:

- inject credentials at runtime through the platform secret manager
- scope credentials by role where possible
- ingress can verify webhook signatures and enqueue jobs
- workers can request installation-scoped access and write check runs
- reporting jobs can write compact records only
- rotate hosted credentials without rebuilding the scanner package
- never echo credential values or transformed credential values

Local CLI usage remains account-free and does not require hosted credentials.

## Logging And Redaction

Use structured logs with redaction at every role boundary.

Allowed log fields:

- request ID
- delivery ID
- installation and repository IDs
- repository full name when needed for debugging
- PR number
- base SHA and head SHA
- scanner version
- queue job ID
- attempt number
- error class
- duration and status

Disallowed log fields:

- no raw source
- no raw diffs
- no secrets
- no customer payloads
- no private URLs
- no full file contents
- no unredacted command output from repository-controlled files

Logs should prefer error classes over raw exception strings when exceptions might contain repository-controlled text.

## Rate Limits

Apply rate limits at three levels:

- installation and repository event rate
- pull request and head SHA deduplication rate
- worker concurrency by installation

The default policy should prefer queueing and deduplication over dropping valid signed events. If an installation exceeds limits, the system should publish or preserve one visible check run state for the latest head SHA instead of creating noisy duplicate work.

Rate-limit records should use trusted installation and repository identity, not PR text.

## Rollback

Rollback must be available without changing customer repositories.

Minimum rollback path:

1. pause worker consumption
2. deploy the previous container image
3. resume queue processing after health checks pass
4. keep idempotency keys stable so duplicate work is not created
5. if ingress is faulty, route webhook traffic to a maintenance response that returns a controlled failure before queue writes

If a bad scanner version creates noisy findings, stop workers for that scanner version, deploy the previous scanner image, and rerun affected jobs only after reviewing check run output.

## Incident Response

The hosted incident response path starts by limiting blast radius:

1. pause queue consumers
2. disable optional outputs if any later slice adds them
3. preserve compact job metadata needed for investigation
4. rotate hosted credentials through the platform secret manager
5. remove temporary worker checkout data
6. notify affected installations with a concise status update
7. document whether raw source, raw diffs, secrets, customer payloads, or private URLs could have been exposed

The first slice should make that last question easy to answer by never storing those fields.

## Alternatives Considered

### Edge-only webhook and scanner

Rejected for the first slice. It makes webhook intake fast, but it pushes scanner behavior into a runtime that does not naturally match the existing Node.js package and file-system expectations.

### Single synchronous service

Rejected for the first slice. Running scans inside the webhook request path makes retries, timeouts, and duplicate delivery handling harder to reason about.

### Self-managed queue and database

Rejected for the first slice. It adds operational work before the hosted product has proven demand. A managed durable queue and managed relational store are easier to monitor and roll back.

## Implementation Stop Conditions

Do not deploy hosted code if any of these are true:

- webhook ingress can queue before signature verification
- worker jobs can fetch source before installation and repository scope authorization
- queue payloads contain raw source, raw diffs, secrets, customer payloads, or private URLs
- logs include repository-controlled source snippets by default
- checkout cleanup is not exercised in tests
- worker concurrency has no installation and repository rate limits
- rollback requires users to change their repositories
- local CLI docs imply hosted account setup is required

Before any environment is exposed to users, apply the hosted operational release gate in [docs/hosted-operational-release-gate.md](hosted-operational-release-gate.md).
