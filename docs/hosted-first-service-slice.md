# First Hosted Service Slice

This document defines the smallest hosted GitHub App implementation that is worth building for `ai-saas-guard`. It turns the existing hosted design contracts into one narrow service slice without weakening the local-first CLI.

This is a product and engineering boundary document. It is not an implementation announcement and it does not replace the local CLI.

## Goal

Prove the hosted workflow with one read-only pull request scan path:

1. Receive a signed GitHub App webhook.
2. Verify the webhook signature before any queue write, repository lookup, token lookup, or worker dispatch.
3. Build a scan identity from trusted GitHub event fields.
4. Queue one idempotent scan request.
5. Run the deterministic scanner in a read-only worker.
6. Publish a check run summary only.
7. Store a compact report record with no raw source, no raw diffs, and no secrets.

The first slice should answer:

> Which changed auth, billing, data access, secret, MCP, or deploy surfaces should a reviewer inspect first?

It should not claim that a pull request is secure.

## Non-Goals

The first hosted slice deliberately excludes:

- No PR comments.
- No saved report dashboard.
- No billing.
- No paid plan packaging.
- No AI summaries.
- No automatic fixes.
- No SARIF upload.
- No broad organization installation.
- No full production infrastructure scanning.
- No source archive or raw diff retention.

These exclusions keep the first service useful, testable, and easy to roll back.

## Entry Event

The only required event for the first slice is a GitHub App `pull_request` webhook for:

- `opened`
- `reopened`
- `synchronize`
- `ready_for_review`

The handler may ignore draft pull requests unless a later public issue scopes draft behavior.

The handler must treat PR title, body, comments, branch names, file contents, and README content as untrusted input. Untrusted PR text must never choose the repository, installation, token scope, queue key, or worker command.

## Trusted Identity

The scan identity must be derived only from trusted GitHub event fields after signature verification:

- `installationId`
- `repositoryId`
- `repositoryFullName`
- `pullRequestNumber`
- `baseSha`
- `headSha`
- `scannerVersion`

The hosted worker must use this identity to authorize installation token scope before fetching source or diffs. If the installation ID, repository ID, selected repository list, or removed repository list does not match, the worker stops before source fetch.

## Queue Contract

The webhook handler queues an idempotent scan request with this key:

```text
installationId:repositoryId:pullRequestNumber:headSha:scannerVersion
```

Duplicate webhook deliveries and repeated synchronize events for the same key must not create duplicate logical reports, duplicate check runs, or duplicate comments. Manual reruns may increment an attempt counter, but they keep the same logical report identity unless `headSha` or `scannerVersion` changes.

The queue payload should contain only:

- scan identity fields
- delivery ID
- event action
- attempt metadata
- created timestamp

It should not contain raw source, raw diffs, secrets, customer payloads, or untrusted PR prose.

## Worker Contract

The first worker is read-only:

- Fetch the repository content or PR diff needed for deterministic scanning.
- Run the same scanner package version recorded in the scan identity.
- Convert findings into a compact report.
- Write or update one GitHub check run.
- Delete the worker checkout directory after scan completion.

The worker must not:

- mutate repository contents
- push commits
- edit pull requests
- post PR comments
- open issues
- rotate secrets
- run shell commands from PR text
- follow links from PR text

## Check Run Output

The first slice publishes a check run summary only. It should include:

- scanner version
- summary counts by severity
- top review-first files
- rule IDs
- evidence file paths and line numbers
- manual verification steps
- a link to local CLI usage
- a note that the output is not a full security audit

The default conclusion should be conservative:

- `neutral` when findings exist and no repository policy has opted into blocking.
- `success` when the scan runs and no findings are present.
- `failure` only after a later policy issue explicitly defines blocking thresholds.

## Compact Report Storage

The first slice stores only compact report data:

- repository ID and name
- PR number
- base SHA and head SHA
- scanner version
- summary counts
- rule IDs
- evidence file paths and line numbers
- reviewer checklist
- suppression policy version
- scan state, attempt number, and error class

Default retention is 30 days or less. Team administrators may shorten retention. Longer retention requires a later paid-history or audit-history issue.

The first slice avoids:

- full file contents
- raw diffs
- secret values
- generated logs with unredacted code snippets
- customer data copied from application fixtures
- private issue text or comments
- unrelated repository documents that are not needed for the scan

## Local-First Boundary

The hosted slice does not replace the local CLI. Users can still run:

```bash
npx ai-saas-guard@latest scan --root .
npx ai-saas-guard@latest pr-risk --root . --base origin/main --markdown
```

The local CLI remains the right path for private repositories, offline review, strict no-account workflows, and repositories where hosted code processing is not acceptable.

## Acceptance Criteria

Before implementation starts, the repository must have tests or contract checks that cover:

- valid signed webhooks queue exactly one scan request.
- invalid, missing, malformed, or replayed signatures queue nothing and fetch no repository data.
- scan identity is built from trusted GitHub event fields, not untrusted PR text.
- installation token scope rejects mismatched, non-installed, or removed repositories.
- duplicate deliveries reuse the same idempotent scan request.
- manual reruns are visible without changing logical report identity.
- compact reports exclude raw source, raw diffs, and secrets.
- the first output surface is a check run summary only.
- PR comments, dashboard storage, billing, and AI summaries remain out of scope.

## Implementation Stop Conditions

Do not deploy the hosted slice if any of these are true:

- webhook verification is not the first trust boundary
- queue writes happen before signature verification
- token lookup can be influenced by PR text
- worker checkout cleanup is untested
- check run output includes raw source, raw diffs, or secret values
- PR comments are enabled without a separate policy issue
- local CLI docs imply an account is required

## Next Issues

After this slice is accepted, continue in this order:

1. Choose the hosted app deployment model.
2. Define the hosted operational release gate.
3. Define uninstall and data deletion behavior.
4. Define hosted pricing and packaging boundaries.
