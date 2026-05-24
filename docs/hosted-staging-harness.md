# Hosted Staging Harness

This document describes the local hosted staging harness implemented in `src/hosted/staging-harness.ts`.

It does not announce a public hosted service. The harness is a local, file-backed way to exercise the hosted runtime end to end before a real staging platform exists.

## What Exists

The package exports `ai-saas-guard/hosted/staging-harness` with:

- `createFileBackedHostedStagingHarness`
- `createHostedStagingHarnessEvidence`

The harness composes the hosted service runtime with local adapters:

- signed pull request webhook replay
- queue snapshots written to `queue/jobs.json`
- compact report files written under `reports/`
- fake GitHub Check Run requests written under `check-runs/`
- a temporary worker sandbox under `worker-sandbox/`
- cleanup verification after a worker tick
- local hosted release-gate evidence fixtures

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

The repository can now run a local staging rehearsal across webhook intake, queue persistence, worker execution, compact report storage, Check Run publication, and worker cleanup.

This still is not a live hosted service. A real staging environment still requires deployed platform infrastructure, public HTTPS ingress, platform secret references, durable queue/storage resources, worker isolation, GitHub Checks runtime credentials, monitoring, rollback evidence, and incident-response evidence collected from the deployed artifact.
