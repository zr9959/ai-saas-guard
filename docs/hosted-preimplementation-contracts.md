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

Fixtures must be synthetic and public-safe. They must not include real credentials, customer payloads, private URLs, raw source, or raw diffs.
