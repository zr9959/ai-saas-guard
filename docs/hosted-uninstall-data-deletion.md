# Hosted Uninstall And Data Deletion

This document defines how the hosted GitHub App should clean app-side records when a repository is removed from an installation, when the full app is uninstalled, or when cleanup is requested more than once.

The local CLI remains available without the hosted app. Uninstalling the hosted app never removes the ability to run local scans from a repository checkout.

## Scope

This policy covers hosted app-side data:

- compact reports
- scan jobs
- scan attempts
- queued work
- replay-protection delivery IDs
- installation and repository metadata
- audit records needed to prove cleanup happened
- temporary worker checkouts

This policy does not control GitHub-owned records such as check runs, audit logs, or repository events retained by GitHub according to customer repository settings.

## Data The Hosted App Should Not Have

The hosted app should not store these fields by design:

- no raw source
- no raw diffs
- no secrets
- no customer payloads
- no full file contents
- no private URLs
- no private comments or unrelated repository documents

Cleanup should still be written defensively, but normal deletion should not need to delete these fields because they should never be stored.

## Repository Removal From Installation

When a repository is removed from an installation, cleanup is scoped to that repository and installation.

Compact report deletion is part of repository-scoped cleanup.

Deleted immediately:

- queued scan jobs for that repository
- pending scan attempts for that repository
- compact reports for that repository
- repository-specific replay-protection delivery IDs where safe
- temporary worker checkouts for that repository

May remain briefly:

- in-flight worker attempts until cancellation or timeout is observed
- retry metadata until the cleanup job marks it canceled
- platform log entries that contain only allowed structured fields

Why brief retention can happen:

- queue systems are usually at-least-once and asynchronous
- a worker may already be executing when the removal event arrives
- structured logs may be retained by the platform until their normal retention window expires

GitHub-owned check runs are not deleted by the hosted app. They remain in GitHub according to repository settings and GitHub retention behavior.

## Full App Uninstall

When the full app is uninstalled, cleanup is scoped to the installation.

Deleted immediately:

- queued scan jobs for all repositories in the installation
- pending scan attempts for the installation
- compact reports for all repositories in the installation
- installation-scoped replay-protection delivery IDs where safe
- temporary worker checkouts for repositories in the installation
- repository selection metadata for the installation

May remain briefly:

- in-flight worker attempts until cancellation or timeout is observed
- dead-letter metadata until the cleanup job records terminal cancellation
- platform logs with allowed structured fields

Preserved for limited audit record retention:

- cleanup request ID
- installation ID
- repository ID when scoped to one repository
- cleanup trigger
- cleanup status
- timestamp
- error class if cleanup failed

Audit records exist to prove that cleanup happened and to diagnose failed cleanup jobs. They must not include raw source, raw diffs, secrets, customer payloads, private URLs, or full file contents.

Default audit record retention is 90 days unless a stricter hosted policy shortens it.

## Queue Cancellation

Cleanup should cancel queued and pending work before deleting compact reports. Worker consumers must check installation and repository scope before source fetch and before writing check runs.

If a worker already fetched repository content before cleanup started, the worker must:

- stop before writing a new check run when cancellation is observed
- delete checkout directories
- avoid storing compact reports
- record only a cleanup-safe error class

## Repeated Cleanup

Cleanup is idempotent. Repeated cleanup requests for the same installation and repository should return the same user-facing result:

> Hosted app-side compact reports and queued work are removed; GitHub-owned check runs remain in GitHub according to repository settings.

Repeated cleanup must not recreate deleted records, requeue scans, or fetch repository content.

Idempotency keys:

```text
repository_removed:<installationId>:<repositoryId>
installation_deleted:<installationId>:all
repeated_cleanup:<installationId>:<repositoryId>
```

## User-Facing Deletion Wording

Use precise wording:

- "We removed hosted app-side compact reports and queued work for this repository."
- "GitHub-owned check runs may remain in GitHub according to your repository settings."
- "The local CLI remains available and does not require the hosted app."
- "The hosted app does not store raw source, raw diffs, secrets, or customer payloads by default."

Avoid overclaiming:

- Do not say all traces are erased.
- Do not claim GitHub-owned records were deleted by the hosted app.
- Do not imply local CLI access depends on hosted account state.

## Test Contract

Automated tests must cover:

- repository removal from installation creates a repository-scoped deletion plan.
- full app uninstall creates an installation-scoped deletion plan.
- repeated cleanup requests are idempotent and do not requeue work.
- cleanup cancels queued jobs.
- cleanup deletes compact reports.
- cleanup deletes worker checkouts when present.
- cleanup preserves only limited audit records.
- cleanup does not store or emit raw source, raw diffs, secrets, customer payloads, or private URLs.

The current pure contract helpers live in `src/hosted/contracts.ts` and are tested by `tests/hosted-contracts.test.mjs`.

## Operational Gate

The hosted operational release gate must include cleanup evidence before deployment:

- repository removal cleanup test
- full app uninstall cleanup test
- repeated cleanup idempotency test
- worker checkout deletion test
- log redaction sample
- audit record retention check
- queue cancellation check

If cleanup evidence is missing, hosted release is blocked.
