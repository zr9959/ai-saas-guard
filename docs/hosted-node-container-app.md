# Hosted Node Container App Skeleton

This document describes the hosted app skeleton implemented in `src/hosted/app.ts`.

It does not announce a public hosted service. The module gives the future hosted GitHub App a deployable shape: a Node.js container HTTP ingress, a scan-worker entry point, provider adapter references, and in-memory adapter tests that exercise the service without cloud credentials.

## Platform Choice

The first deployable skeleton targets a containerized Node.js service with two roles:

- `webhook-ingress`
- `scan-worker`

The platform ID returned by the helper is `node_container`.

This matches the existing scanner package because the local CLI already expects Node.js file-system behavior, process isolation, and predictable worker cleanup. It also avoids locking the open-source package to one cloud provider. A real deployment can run this shape on Fly.io, Render, AWS, GCP, Azure, Cloudflare Containers, or another container platform.

## Exports

The package exports `ai-saas-guard/hosted/app` with:

- `createHostedHttpApp`
- `createInMemoryHostedAppPlatform`
- `createHostedNodeCheckoutAppPlatform`
- `planHostedNodeContainerDeployment`

The staging deployment planner in [hosted-staging-deployment.md](hosted-staging-deployment.md) composes this Node/container deployment plan with real provider references, hosted operational release-gate evidence, and GitHub App promotion gates.

## HTTP Ingress

The HTTP app exposes two routes:

| Route | Method | Purpose |
| --- | --- | --- |
| `/healthz` | `GET` | Return a safe readiness response with platform and role names |
| `/github/webhook` | `POST` | Pass the signed GitHub webhook body to the hosted service runtime |

The HTTP layer only extracts headers and body bytes. Signature verification, trusted identity derivation, repository scope authorization, and queue upsert stay inside the hosted service runtime.

The webhook response is intentionally small:

- accepted/rejected status
- processing stage
- safe rejection reason
- delivery ID
- whether a worker was queued
- whether a Check Run should be created

It does not return raw webhook payloads, PR-authored text, source, diffs, secrets, customer payloads, checkout paths, or installation tokens.

## Worker Entry

The scan worker calls `runWorkerTick()`.

The worker tick processes at most one queued job through the hosted service runtime and returns a safe summary:

- empty queue
- completed with Check Run publication planned
- failed with a high-level error class
- cleanup planned or not planned

It does not return the raw worker exception, checkout path, source, diff, secrets, customer payloads, App JWTs, or installation tokens.

## Provider Adapter Layer

`createInMemoryHostedAppPlatform` gives tests and local smoke runs a complete in-memory platform:

- queue adapter
- compact report store adapter
- Check Run publisher adapter
- scan runner adapter
- HTTP app

These adapters are not production storage. Real providers must wire the same boundaries to:

- platform secret manager
- durable queue or job table
- compact report store
- read-only worker sandbox
- GitHub Checks API publisher

`createHostedNodeCheckoutAppPlatform` composes the same HTTP app and service runtime with the concrete read-only checkout worker from `ai-saas-guard/hosted/worker`. It is still adapter-driven: deployments must provide a runtime installation-token provider, durable queue/store, worker sandbox, and Check Run publisher. The helper exposes a safe `workerSafety` summary so deployers can verify the runtime boundary without logging private paths or tokens:

- command source: trusted runtime plan
- timeout capped at 600 seconds
- output capped at 1 MiB
- shell disabled
- CLI network access disabled
- read-only write mode
- compact JSON-only output
- checkout cleanup required
- no checkout path, source, diff, secret, or customer payload persistence

## Deployment Plan

`planHostedNodeContainerDeployment` validates the provider-facing deployment shape.

Required inputs:

- public HTTPS base URL
- `sha256:<digest>` container image digest
- GitHub App ID reference using the `secret:` prefix
- GitHub App signing-key reference using the `secret:` prefix
- GitHub webhook signing-key reference using the `secret:` prefix
- durable queue reference using the `queue:` prefix
- compact report store reference using the `store:` prefix
- read-only worker sandbox reference using the `sandbox:` prefix
- GitHub Checks publisher reference using the `github-checks:` prefix

The plan blocks deployment when:

- the public base URL is not safe HTTPS
- localhost, loopback, private, link-local, or multicast hosts are used
- the container image digest is missing or malformed
- required secret references are missing or are not platform secret references
- required provider adapter references are missing or do not use the expected provider prefixes
- raw signing material, webhook signing values, installation tokens, source, diffs, secret values, or customer payloads are passed instead of platform references

## Privacy

The app skeleton returns safe summaries only.

It does not return:

- raw webhook payloads
- untrusted PR text
- raw source
- raw diffs
- secrets
- customer payloads
- private checkout paths
- App JWTs
- installation tokens

## Current Status

The repository can now instantiate a Node/container hosted app skeleton, route signed webhooks into the hosted service runtime, process one worker tick through adapters, compose the real read-only checkout scan runner behind a token-provider boundary, expose clamped worker safety budgets, and validate provider adapter references before deployment.

A public hosted environment still requires actual platform infrastructure, a public HTTPS webhook URL, platform secrets, durable queue/storage, worker sandboxing, GitHub Checks API credentials at runtime, monitoring, rollback, incident-response evidence, and the hosted operational release gate. Use [hosted-staging-deployment.md](hosted-staging-deployment.md) to plan and block staging exposure until those provider references and evidence exist.
