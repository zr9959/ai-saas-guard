# Hosted Staging Harness

This document describes the local hosted staging harness implemented in `src/hosted/staging-harness.ts`.

It does not announce a public hosted service. The harness is a local, file-backed way to exercise the hosted runtime end to end before a real staging platform exists.

## What Exists

The package exports `ai-saas-guard/hosted/staging-harness` with:

- `createFileBackedHostedStagingHarness`
- `createHostedStagingHarnessEvidence`
- `createHostedStagingReleaseEvidenceBundle`
- `evaluateHostedStagingReleaseEvidenceBundle`
- `validateHostedLogBoundary`

The harness composes the hosted service runtime with local adapters:

- signed pull request webhook replay
- queue snapshots written to `queue/jobs.json`
- compact report files written under `reports/`
- fake GitHub Check Run requests written under `check-runs/`
- a temporary worker sandbox under `worker-sandbox/`
- cleanup verification after a worker tick
- local hosted release-gate evidence fixtures
- executable evidence bundles for success and failure cleanup probes
- log boundary validation for safe hosted metadata samples

## Replay Flow

The expected staging rehearsal is:

1. create a temporary harness root
2. replay a signed pull request webhook with `runWebhookReplay`
3. process one queued scan with `runWorkerTick`
4. inspect the queue, report, and Check Run request files
5. verify that the worker sandbox is empty after cleanup

Invalid signatures stop at the signature stage and create no queue, report, or Check Run side effects.

## Evidence Fixture

`createHostedStagingHarnessEvidence` creates one passed evidence item for each hosted operational release-gate requirement. This is useful for local tests and staging rehearsals that need the same evidence shape as a deployed environment.

The generated notes are explicit that the evidence is local harness evidence, not hosted exposure.

## Executable Evidence Bundle

`createHostedStagingReleaseEvidenceBundle` turns concrete harness results into release-gate evidence:

- signed webhook replay must queue a check-run-only worker from trusted GitHub event fields
- worker success must delete the worker sandbox
- worker failure must still delete the worker sandbox and expose only a safe failure reason
- callers can require explicit failure reasons such as checkout failure, CLI failure, malformed output, Check Run publication failure, timeout, and cancellation before cleanup evidence passes
- log boundary validation must pass before `privacy_retention` is marked passed
- external evidence is still required for CI, workflow static checks, dependency scan, container scan, monitoring, rollback, and incident response

`evaluateHostedStagingReleaseEvidenceBundle` passes that bundle into the hosted operational release gate evaluator with the release commit, scanner version, deployment target, container digest, and release notes. This makes the local staging gate executable instead of a hand-maintained checklist.

The bundle is still source-candidate evidence. It does not prove a deployed hosted service is ready, and it does not replace deployed provider evidence.

## Log Boundary Validation

`validateHostedLogBoundary` accepts sampled log metadata and a forbidden-value list for raw source, raw diffs, secret values, customer payloads, installation tokens, checkout paths, private URLs, and untrusted PR prose.

The returned result contains only:

- pass/fail status
- blocked reason IDs
- sample count
- allowed field names
- privacy flags

It does not return the sampled log lines or the forbidden values. This keeps the evidence useful while avoiding accidental leakage in release notes, compact reports, or Check Runs.

## Privacy

The harness returns safe status objects and compact artifacts only.

It does not return:

- raw webhook payloads
- untrusted PR text
- raw source
- raw diffs
- secrets
- customer payloads
- private checkout paths
- installation tokens

The worker sandbox may contain temporary scan input during a worker tick. The harness removes that sandbox before returning the worker result and reports whether cleanup was verified.

## Current Status

The repository can now run a local staging rehearsal across webhook intake, queue persistence, worker execution, compact report storage, Check Run publication, worker cleanup, success and failure cleanup probes, log boundary validation, and executable release-gate evaluation from the generated evidence bundle.

This still is not a live hosted service. A real staging environment still requires deployed platform infrastructure, public HTTPS ingress, platform secret references, durable queue/storage resources, worker isolation, GitHub Checks runtime credentials, monitoring, rollback evidence, and incident-response evidence collected from the deployed artifact.
