# Hosted GitHub App Deployment

This document defines the GitHub App deployment planner now implemented in `src/hosted/github-app.ts`.

It does not create a GitHub App by itself. GitHub App creation still requires a real HTTPS webhook URL, a deployed hosted service artifact, platform secret storage, and a human owner or automation account with permission to create the app in GitHub. The planner makes those requirements explicit and blocks unsafe or incomplete deployment input.

## What Exists

The deployment planner exports `planHostedGitHubAppDeployment` from `ai-saas-guard/hosted/github-app`.

It creates a least-privilege GitHub App manifest for the first hosted slice:

- `contents: read`
- `pull_requests: read`
- `checks: write`
- `metadata: read`

Allowed events:

- `pull_request`
- `installation`
- `installation_repositories`

The manifest stays private by default and uses one active webhook URL.

## Required Inputs

A ready deployment plan requires:

- app name
- HTTPS homepage URL
- HTTPS webhook URL
- hosted environment name
- `sha256:<digest>` container image digest
- secret reference for GitHub App ID
- secret reference for GitHub App private key
- secret reference for webhook secret
- hosted operational release gate decision that allows hosted exposure

Secret references must be platform lookup names such as `platform-ref:github-app-key`, not raw secret values.

## Blockers

The planner blocks GitHub App creation when:

- the hosted release gate is blocked
- the container image digest is missing or malformed
- URLs are not HTTPS
- localhost, loopback, private, link-local, or multicast URLs are used
- required secret references are missing
- raw private keys or webhook secrets are passed instead of secret references, including explicit raw secret input fields
- requested permissions exceed the first-slice permission contract
- requested events exceed the first-slice event contract

## Privacy

The deployment plan never returns:

- private key material
- webhook secret values
- client secret values
- customer payloads

The production adapter layer in [hosted-production-adapters.md](hosted-production-adapters.md) extends this boundary after App creation: it generates short-lived RS256 GitHub App JWTs, plans selected-repository installation-token requests, separates worker checkout and Check Run token scopes, and keeps bearer credentials out of serializable request plans.

It returns only safe manifest fields, blocker IDs, environment metadata, container digest, secret reference names, and deployment steps.

The staging deployment planner in [hosted-staging-deployment.md](hosted-staging-deployment.md) composes this GitHub App deployment planner with real provider references and hosted operational release-gate evidence. Production GitHub App promotion remains blocked until staging deployment, Check Run publication, and rollback verification are recorded.

## Deployment Steps

When `readyToCreateGitHubApp` is true:

1. Create the GitHub App from the generated least-privilege manifest.
2. Store the App ID, private key, and webhook secret in the platform secret manager.
3. Deploy webhook ingress and scan worker containers with the recorded image digest.
4. Run the hosted operational release gate against the deployed artifact before exposure.

## Current Status

The repository can now produce and validate the deployment plan, and a private staging GitHub App exists for the first live hosted ingress:

- App slug: `ai-saas-guard-hosted`
- App ID: `3834787`
- Installation ID: `135085075`
- Installed repository: `zr9959/ai-saas-guard`
- Webhook URL: `https://ai-saas-guard-hosted.zr9959.workers.dev/github/webhook`
- Secret storage: Cloudflare Worker secrets for `WEBHOOK_SECRET` and `GITHUB_APP_PRIVATE_KEY`

This is now a first-slice staging Worker deployment, not a complete hosted scanner. The Worker code verifies signatures, queues compact pull request identity records, exchanges scoped installation tokens, fetches PR file metadata, classifies PR-risk hotspots, and publishes bounded Check Runs. Current operations evidence is tracked in [hosted-operations-evidence.md](hosted-operations-evidence.md); health, signed webhook delivery, compact KV records, cleanup, and Check Run publication pass in staging. It still does not run full source checkout scan workers inside the Cloudflare Worker, store raw diffs, store source code, or expose a production hosted service.

The next deployment stage should wire the hosted service runtime, production adapters, [Node/container app skeleton](hosted-node-container-app.md), and [staging deployment planner](hosted-staging-deployment.md) to a real platform queue, compact report store, GitHub installation authentication, worker isolation layer, Checks API publisher, logs, metrics, rollback, and incident-response evidence.
