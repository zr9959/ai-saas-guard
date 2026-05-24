# Hosted Production Adapters

This document describes the hosted production adapter layer implemented in `src/hosted/production-adapters.ts`.

It does not announce a public hosted service. The module provides provider-independent auth, token-request, worker-execution, timeout, output, and cleanup plans that can be wired to a real hosted platform after the operational release gate has evidence.

The Node/container app skeleton in [hosted-node-container-app.md](hosted-node-container-app.md) composes this layer with HTTP ingress, worker tick, and provider adapter references.

## What Exists

The package exports `ai-saas-guard/hosted/production-adapters` with:

- `createHostedGitHubAppJwt`
- `planHostedGitHubInstallationTokenRequest`
- `planHostedProductionWorkerExecution`

The layer covers the next hosted build step:

- GitHub App JWT generation with RS256 signing
- 60-second issued-at clock skew
- 10-minute maximum JWT expiration
- installation-token request planning for selected repositories only
- separate token scopes for worker checkout and Check Run publication
- no raw private key, app JWT, or installation token persistence in request plans
- fixed worker command from trusted runtime state, not pull request text
- bounded worker timeout and output budgets
- compact JSON-only worker output
- cleanup plans for success, failure, timeout, and cancellation

## GitHub App Auth Chain

The runtime path is intentionally split:

1. A secret provider reads the GitHub App private key at runtime.
2. `createHostedGitHubAppJwt` signs a short-lived App JWT.
3. `planHostedGitHubInstallationTokenRequest` creates a safe installation-token request plan.
4. A platform adapter injects the runtime App JWT into the HTTP request and receives the installation token.
5. The token is cached only until its GitHub `expires_at`, redacted from logs, and not persisted as report or queue state.

The safe request plan uses `authorization: "runtime_bearer_app_jwt"` instead of returning a bearer token. This prevents accidental serialization of live credentials in logs, job records, release notes, or tests.

## Token Scopes

| Purpose | Repository scope | Permissions |
| --- | --- | --- |
| `worker_checkout` | selected repository ID only | `contents: read`, `pull_requests: read` |
| `check_run_publication` | selected repository ID only | `checks: write` |
| `first_slice` | selected repository ID only | `contents: read`, `pull_requests: read`, `checks: write` |

`metadata: read` remains part of the GitHub App manifest permission contract, but GitHub installation token request bodies only include permissions that need explicit narrowing for the current operation.

## Worker Execution Boundary

`planHostedProductionWorkerExecution` composes the existing read-only worker contract with production execution limits:

- command: `ai-saas-guard`
- args: `pr-risk --root <worker-checkout> --base <trusted-base-sha> --json`
- shell: disabled
- network access: disabled for the CLI process
- write mode: read-only
- timeout: maximum 600 seconds
- output budget: maximum 1 MiB
- output retention: compact JSON only

The plan never returns:

- temporary checkout roots
- private checkout paths
- raw source
- raw diffs
- secrets
- customer payloads
- app JWTs
- installation tokens

## Cleanup Behavior

The production plan precomputes cleanup obligations for every terminal worker state:

- success
- failure
- timeout
- cancellation

Every terminal state schedules worker checkout deletion, credential removal, raw-source removal, raw-diff removal, generated-artifact removal, and compact audit metadata preservation. Cleanup failure remains a separate operator-review path in the lower-level hosted contracts.

## Adapter Interfaces

The module also defines minimal interfaces for real platform wiring:

- `HostedProductionSecretProvider`
- `HostedProductionInstallationTokenRequester`
- `HostedProductionWorkerAdapter`

These are intentionally small. A deployment can back them with Cloudflare, Fly.io, Render, AWS, GCP, Azure, or another platform without changing the scanner core.

## Current Status

The repository can now plan the production auth and worker boundary for the hosted GitHub App path. A public hosted environment still requires:

- public HTTPS webhook URL
- platform secret manager
- deployed ingress and worker containers
- managed durable queue
- compact report storage
- real GitHub Checks API publisher
- monitoring and alerting
- rollback and incident-response evidence
- hosted operational release gate evidence from the deployed artifact

Do not describe this module as a live hosted service. It is the production adapter layer needed before a live hosted service can be exposed.

## References

- GitHub Docs: [Generating a JSON Web Token for a GitHub App](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-a-json-web-token-jwt-for-a-github-app)
- GitHub Docs: [Generating an installation access token for a GitHub App](https://docs.github.com/en/apps/creating-github-apps/authenticating-with-a-github-app/generating-an-installation-access-token-for-a-github-app)
