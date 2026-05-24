# Hosted Service Runtime

This document describes the first real hosted service runtime now implemented in `src/hosted/service.ts`.

It is not a public hosted deployment announcement. The runtime is a provider-independent service core that can be wired to a real queue, compact report store, GitHub Checks API client, and scanner worker in the next deployment stage. It does not deploy a public hosted environment.

## What Exists

The runtime exports `createHostedServiceRuntime` from `ai-saas-guard/hosted/service`.

It implements the first hosted service slice:

- signed GitHub App pull request webhook intake
- signature verification before JSON parsing, queue writes, repository lookup, token scope checks, or worker dispatch
- trusted scan identity from GitHub event fields only
- selected-repository installation authorization
- idempotent durable queue upsert through an adapter
- read-only worker planning
- scan runner adapter boundary
- compact report storage adapter boundary
- Check Run publication adapter boundary
- worker checkout cleanup planning after success or failure

## Runtime Roles

The service core keeps the two production roles from the deployment model:

- `webhook-ingress`: call `handlePullRequestWebhook`.
- `scan-worker`: call `runNextQueuedScan`.

The runtime does not start an HTTP server by itself. That keeps framework and cloud choices out of the package while preserving the exact trust-boundary order the hosted service needs.

## Adapter Boundaries

Production deployments must provide durable adapters:

- queue adapter backed by a managed durable queue or relational job table
- compact report store backed by managed storage
- Check Run publisher backed by GitHub App installation authentication
- scan runner backed by isolated worker checkout and the deterministic CLI

The exported `createInMemoryHostedServiceAdapters` is only for tests, local smoke runs, and examples. It is not a production queue or production data store.

The production adapter layer in [hosted-production-adapters.md](hosted-production-adapters.md) now defines the next boundary around this runtime: GitHub App JWT creation, selected-repository installation-token request planning, separate worker and Check Run token scopes, fixed read-only worker execution, bounded timeout/output settings, compact JSON-only output, and cleanup planning for success, failure, timeout, and cancellation.

## Privacy

The runtime intentionally returns safe planning and status objects only.

It does not return:

- raw webhook payloads
- untrusted PR text
- raw source
- raw diffs
- secrets
- customer payloads
- private checkout paths
- low-level worker exception messages

Compact reports continue to include only trusted identity, summary counts, rule IDs, compact evidence paths and line numbers, retention metadata, and model-training disabled status.

## Failure Behavior

Invalid webhooks stop at the signature stage and create no queue, worker, report, or Check Run side effects.

Worker failures are recorded with a cleanup-safe `scan_runner_failed` error class. The runtime still plans worker checkout deletion, but it does not expose raw exception text or private checkout paths.

## Tests

`tests/hosted-service.test.mjs` covers:

- a signed pull request webhook queues one idempotent job and the worker publishes one Check Run request
- duplicate deliveries reuse the logical queue record
- invalid signatures create no side effects
- worker failures preserve cleanup behavior without leaking private paths or low-level errors

## Deployment Status

This runtime makes the hosted service implementation-ready inside the repository. A public hosted environment still requires the next deployment stage:

- real GitHub App credentials
- platform secret manager
- managed queue
- compact report storage
- production adapters wired to the platform secret manager and GitHub Checks API
- container image and digest
- live monitoring and rollback evidence
- hosted operational release gate evidence from the deployed artifact
