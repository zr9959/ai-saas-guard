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
- localhost URLs are used
- required secret references are missing
- raw private keys or webhook secrets are passed instead of secret references
- requested permissions exceed the first-slice permission contract
- requested events exceed the first-slice event contract

## Privacy

The deployment plan never returns:

- private key material
- webhook secret values
- client secret values
- customer payloads

It returns only safe manifest fields, blocker IDs, environment metadata, container digest, secret reference names, and deployment steps.

## Deployment Steps

When `readyToCreateGitHubApp` is true:

1. Create the GitHub App from the generated least-privilege manifest.
2. Store the App ID, private key, and webhook secret in the platform secret manager.
3. Deploy webhook ingress and scan worker containers with the recorded image digest.
4. Run the hosted operational release gate against the deployed artifact before exposure.

## Current Status

The repository can now produce and validate the deployment plan, but it cannot honestly create a live GitHub App until a public hosted webhook URL, container image digest, and secret manager references exist.

The next deployment stage should wire the hosted service runtime to a real platform queue, compact report store, GitHub installation authentication, and Checks API publisher.
