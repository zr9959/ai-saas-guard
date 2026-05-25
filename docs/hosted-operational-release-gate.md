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
- real hosted PR smoke result, when a live GitHub App ingress is deployed
- staging KV cleanup result for `delivery:` and `scan:` smoke records
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
11. Any deployed GitHub App ingress passes a real temporary PR smoke with Check Run evidence and post-smoke branch, PR, and KV cleanup.

## Current Source Candidate Evidence Notes

The current public package release is still a local CLI and pure hosted-contract release. No hosted production environment is exposed by this release.

The pure evaluator `evaluateHostedOperationalReleaseGate` and the exported `HOSTED_OPERATIONAL_RELEASE_GATE_REQUIREMENTS` list make the gate machine-checkable for the next hosted service stage. The staging harness also exports `createHostedStagingReleaseEvidenceBundle`, `evaluateHostedStagingReleaseEvidenceBundle`, and `validateHostedLogBoundary` so source-candidate rehearsals can turn webhook replay, success/failure cleanup probes, required safe failure reasons, and log samples into an executable gate decision.

Deployed worker staging evidence is documented in [hosted-deployed-worker-staging.md](hosted-deployed-worker-staging.md). The `ai-saas-guard/hosted/deployed-staging` export adds `createHostedDeployedWorkerStagingEvidenceBundle` and `evaluateHostedDeployedWorkerStagingReleaseGate` so a deployed Node/container read-only checkout worker candidate can turn public HTTPS health, signed webhook replay, deployed success/failure cleanup probes, log-boundary samples, and external CI/scan/rollback evidence into this same gate. It does not deploy cloud resources and is not production hosted exposure.

The evaluator blocks hosted exposure unless every P0 item has fresh evidence, a `sha256:<digest>` container image digest is recorded, and release notes avoid positive pentest, certification, and full-audit claims. Explicit wording such as "not a pentest, certification, or full security audit" remains allowed.

Source-level evidence notes for this release candidate:

| Gate ID | Requirement | Evidence link or note | Current source status |
| --- | --- | --- | --- |
| `clean_ci` | Clean install, tests, build, CLI help, JSON/SARIF scan, PR-risk, npm audit, pack dry-run | Local release gate plus GitHub Actions CI run from the release commit | Passed for source package |
| `hosted_contract_tests` | Hosted contract tests for webhook, scope, queue, worker, check summaries, cleanup, retention, and release gate evaluation | `tests/hosted-contracts.test.mjs` | Passed for pure contracts |
| `webhook_replay` | Valid events queue work; invalid, missing, malformed, replayed, removed, and non-installed events queue nothing | Pure replay coverage in hosted webhook intake tests plus deployed worker staging evidence helper | Passed for pure contracts; deployed helper can record public HTTPS staging replay before exposure |
| `workflow_static_checks` | GitHub Actions static analysis | `actionlint` and `uvx zizmor --offline .github/workflows` | Passed for repository workflows |
| `dependency_scan` | Dependency scan has no unresolved high or critical production findings | `npm audit --audit-level=high --registry=https://registry.npmjs.org` | Passed for source package |
| `container_scan` | Container image scan has no unresolved high or critical runtime-layer findings | No hosted container image exists in the public package release | Not applicable to current non-hosted release; required before hosted exposure |
| `queue_worker_cleanup` | Queue dedupe, running cancellation, terminal cleanup, worker checkout deletion, and no long-running processes | Pure queue, worker, checkout, retention cleanup planner tests, staging harness success/failure cleanup probes, and deployed worker staging cleanup evidence helper | Passed for source candidate; deployed helper can record success/failure cleanup before exposure |
| `privacy_retention` | No raw source, raw diffs, secrets, customer payloads, private URLs, or full file contents; retention and uninstall cleanup are proven | Compact report, Check Run publication, retention/deletion cleanup, docs tests, `validateHostedLogBoundary` source-candidate log checks, and deployed log-boundary staging evidence | Passed for source candidate; deployed log sampling still required before exposure |
| `hosted_pr_smoke` | Deployed GitHub App ingress creates a temporary PR, publishes `ai-saas-guard PR risk`, closes the PR, deletes the branch, and clears staging `delivery:` / `scan:` KV records | `node scripts/hosted-pr-smoke.mjs --plan` plus `node scripts/hosted-pr-smoke.mjs` after deployment | Required for any release that changes the live hosted Worker or GitHub App wiring |
| `monitoring_alerting` | Ingress, queue depth, worker failures, Check Run failures, cleanup failures, retention failures, and credential rotation alerts | Required alert list remains in this document | Documented; must attach provider evidence before exposure |
| `manual_rollback` | Worker pause, previous artifact redeploy, queue resume, controlled ingress failure, and affected Check Run identification | Manual rollback procedure remains in this document | Documented; must execute against deployed artifact before exposure |
| `incident_response` | Owner, backup, credential rotation, queue pause, customer communication, status path, and privacy-safe evidence collection | Incident response checklist remains in this document | Documented; must name live owners before exposure |
| `release_cleanup` | Temporary files, package tarballs, scratch SARIF/JSON, test queues/stores, and long-running processes are removed | Local cleanup checks after each release task | Passed for local release run |

For the current non-hosted package, these notes are enough to keep the repository implementation-ready while still blocking real hosted exposure until the deployment-specific evidence rows are completed with live provider links or notes.

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
node scripts/hosted-pr-smoke.mjs --plan
```

CI must also run GitHub Actions static checks:

```bash
actionlint
uvx zizmor --offline .github/workflows
```

For a hosted release candidate, CI must additionally verify the built container image or deployment artifact rather than only source files.

For any release that changes the deployed Cloudflare GitHub App ingress, run the real smoke after deployment:

```bash
node scripts/hosted-pr-smoke.mjs --evidence-file /tmp/ai-saas-guard-hosted-smoke.json
```

The script must refuse a dirty working tree, target only `zr9959/ai-saas-guard`, create a `codex/hosted-smoke-*` branch, query Check Runs with a GET request on the trusted head SHA, write a public-safe machine-readable evidence record, close the temporary PR, delete the remote and local branch, and bulk-delete staging KV `delivery:` / `scan:` records.

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

### Read-Only Checkout Worker Evidence

For the first source checkout worker, the release blocks unless the deployed artifact records fresh evidence for both success and failure cleanup.

Required proof:

- checkout identity comes only from signed GitHub event fields and selected-repository installation scope.
- repository token permissions are limited to `contents: read` for checkout.
- runtime credentials reach git through temporary askpass material only.
- the CLI phase runs after credential material is removed from the environment.
- the worker command is fixed to the deterministic read-only `pr-risk --json` shape.
- the worker rejects accepted-looking plans if command, checkout identity, or token scope differs from trusted GitHub event identity.
- success deletes the worker checkout, askpass material, generated JSON/SARIF scratch files, and local package tarballs.
- failure cleanup covers clone failure, timeout, CLI failure, malformed JSON output, Check Run write failure, cancellation, and process interruption.
- cleanup failures create an operator-review event without returning raw source, raw diffs, installation tokens, checkout paths, private URLs, or low-level filesystem errors to users.

### Log Boundary Evidence

Before exposure, sample ingress, queue, worker, report, and Check Run logs for the release candidate. The sample may contain scan key, installation ID, repository ID, PR number, head SHA, scanner version, duration, summary counts, error class, and cleanup status.

The sample must show no raw source, no raw diffs, no secrets, no installation tokens, no customer payloads, no private URLs, no checkout paths, and no untrusted PR prose.

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
- temporary smoke PRs and `codex/hosted-smoke-*` branches
- worker checkouts
- generated SARIF and JSON scratch files
- dead test queues or local stores
- staging KV `delivery:` and `scan:` smoke records
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
