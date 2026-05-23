# Hosted Operational Release Gate

This document defines the release gate required before any hosted GitHub App environment is exposed to users. It extends the CLI/npm release process with hosted-specific checks for webhook intake, queue behavior, worker isolation, privacy, monitoring, rollback, and incident response.

This gate blocks release when the hosted trust boundaries fail. Passing it does not prove that a customer application is secure, and it does not replace the local CLI.

## Release Rule

Do not expose a hosted environment to users unless every P0 item in this document has fresh evidence from the release candidate.

P0 means release blocker. P1 means fix before release unless an owner documents a narrow exception and follow-up. P2 means quality improvement.

Every hosted release must record:

- exact commit SHA and container image digest
- scanner package version
- deployment target
- local and CI verification outputs
- webhook replay evidence
- queue and worker cleanup evidence
- privacy and retention evidence
- monitoring and alerting checks
- manual rollback result
- incident response owner and escalation path

## P0 Gate Summary

1. CI checks pass from a clean install.
2. Hosted contract tests pass for signature verification, installation token scoping, idempotency, compact reports, and retention.
3. Webhook replay tests prove valid requests queue work and invalid requests queue nothing.
4. Dependency and container scanning have no unresolved high or critical production findings.
5. Queue retry, deduplication, and dead-letter behavior are verified.
6. Workers run read-only scans, delete worker checkouts, and leave no temporary files after terminal success or failure.
7. Logs contain no raw source, no raw diffs, no secrets, no customer payloads, and no private URLs.
8. Retention checks prove compact reports expire according to policy.
9. Monitoring and alerting checks cover ingress, queue depth, worker failures, check run failures, and cleanup failures.
10. Manual rollback is tested against the release candidate.

## CI Checks

Hosted release CI must include the existing public package gate:

```bash
npm ci
npm test
npm run build
node dist/cli.js --help
node dist/cli.js scan --root . --json
node dist/cli.js scan --root . --sarif
node dist/cli.js pr-risk --root . --json
npm audit --audit-level=high --registry=https://registry.npmjs.org
npm pack --dry-run --json
```

CI must also run GitHub Actions static checks:

```bash
actionlint
uvx zizmor --offline .github/workflows
```

For a hosted release candidate, CI must additionally verify the built container image or deployment artifact rather than only source files.

## Hosted Security Tests

The release blocks when any of these tests fail:

- signature verification rejects missing, malformed, invalid, and replayed webhook deliveries.
- signature verification accepts valid deliveries and queues exactly one scan request.
- installation token scoping rejects mismatched, non-installed, and removed repositories.
- idempotency prevents duplicate check runs for repeated deliveries.
- compact reports exclude raw source, raw diffs, secrets, customer payloads, and private URLs.
- retention policy caps compact report storage at the configured limit.
- worker cleanup deletes checkout directories after success, failure, timeout, and cancellation.

Fixtures must use synthetic repository names, inert IDs, and fake SHAs. They must not include real credentials, customer data, or production repository content.

## Webhook Replay

Before release, replay reduced GitHub-shaped webhook events against the release candidate:

- valid `pull_request.opened`
- valid `pull_request.synchronize`
- invalid signature
- missing signature
- malformed signature
- replayed delivery ID
- repository removed from installation
- non-installed repository

Expected result:

- valid signed events queue one idempotent scan request.
- rejected events queue no job, fetch no repository content, and write no check run.
- duplicate delivery reuses the existing logical report.

## Queue And Worker Checks

The release blocks when queue or worker behavior is not observable.

Required evidence:

- queue depth metric exists.
- retry count metric exists.
- dead-letter count metric exists.
- worker duration metric exists.
- cleanup failure metric exists.
- duplicate delivery test does not create duplicate logical reports.
- worker cancellation still attempts checkout cleanup.
- temporary files and worker checkouts are removed after terminal states.
- long-running processes are stopped after test and release tasks complete.

The worker must not persist repository files across jobs.

## Dependency And Container Scanning

Hosted releases must include dependency and container scanning for the deployed artifact.

Minimum evidence:

- npm audit has no unresolved high or critical production vulnerability.
- container image scan has no unresolved high or critical finding in runtime layers.
- base image digest is recorded.
- dependency lockfile changes are reviewed.
- no dependency is pulled from a personal fork, git URL, or unreviewed tarball URL.

If a high or critical finding is intentionally accepted, the release notes must name the finding, affected package or image layer, exploitability assessment, compensating control, owner, and expiration date.

## Privacy And Retention Verification

The release blocks when privacy behavior cannot be demonstrated.

Required checks:

- compact report schema excludes raw source, raw diffs, secrets, customer payloads, private URLs, and full file contents.
- log sampling confirms redaction at ingress, queue, worker, and report boundaries.
- retention job deletes or expires compact records according to policy.
- uninstall cleanup follows [docs/hosted-uninstall-data-deletion.md](hosted-uninstall-data-deletion.md) for repository removal, installation deletion, repeated cleanup, and audit record retention.
- worker checkout directories are deleted after scan completion.
- model training remains disabled for customer code and findings.
- local CLI usage remains documented as account-free.

## Monitoring And Alerting

Before release, verify alerts for:

- webhook rejection spike
- queue depth above threshold
- dead-letter queue growth
- worker failure rate
- check run write failure rate
- cleanup failure rate
- report store write failure rate
- credential rotation failure
- retention job failure

Each alert must have an owner, severity, first response expectation, and rollback or mitigation note.

## Manual Rollback

Every hosted release candidate needs one manual rollback test before exposure.

Rollback evidence must show:

1. worker consumption can be paused.
2. the previous container image or artifact can be redeployed.
3. queue processing can resume without changing idempotency keys.
4. webhook ingress can return a controlled failure before queue writes if ingress is unhealthy.
5. affected check runs can be identified by installation, repository, PR, head SHA, and scanner version.

Rollback must not require users to change repository code or reinstall the GitHub App.

## Incident Response Check

Before release, confirm:

- incident owner and backup owner are named.
- credential rotation path is documented for hosted credentials and signing material.
- queue pause and worker pause commands are documented.
- customer communication template exists.
- status update path exists.
- evidence collection avoids raw source and raw diffs by default.
- deletion and retention behavior is known for the release candidate.

If raw source, raw diffs, secrets, customer payloads, or private URLs could be exposed by the incident path, release is blocked until the design is corrected.

## Cleanup Expectations

Each hosted release run must clean:

- temporary files
- package tarballs that are not release assets
- worker checkouts
- generated SARIF and JSON scratch files
- dead test queues or local stores
- long-running processes started during verification

After cleanup, `git status --short --branch` should be clean, and process checks should show no test, build, watch, queue, worker, or dev-server processes left behind.

## Release Evidence Template

Use this template in the release record:

```markdown
## Hosted Release Evidence

- Commit:
- Container image digest:
- Scanner version:
- Deployment target:
- CI:
- Webhook replay:
- Contract tests:
- Queue and worker cleanup:
- Dependency and container scanning:
- Privacy and retention:
- Monitoring and alerting:
- Manual rollback:
- Incident owner:
- Cleanup:
- Rollback target:
```

## Local-First Boundary

The hosted release gate does not replace the local CLI. Users can continue to run local scans without an account, hosted installation, network calls, or source upload.
