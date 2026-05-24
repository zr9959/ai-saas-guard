# Hosted Staging Deployment

This document describes the hosted staging deployment planner implemented in `src/hosted/staging.ts`.

It does not announce a public hosted service. The module composes existing hosted contracts into the next deployable checkpoint: provider binding, Node/container deployment planning, hosted operational release-gate evidence, and GitHub App promotion gating.

## What Exists

The package exports `ai-saas-guard/hosted/staging` with:

- `planHostedProviderBinding`
- `planHostedStagingDeployment`
- `planHostedGitHubAppPromotion`

These helpers are pure planners. They do not call a cloud provider, create a GitHub App, read secrets, write Check Runs, or expose a hosted service.

## Provider Binding

`planHostedProviderBinding` validates the real provider references a hosted deployment needs:

| Reference | Required prefix | Purpose |
| --- | --- | --- |
| secret manager | `secret-manager:` | Runtime lookup for GitHub App ID, signing-key reference, and webhook signing reference |
| queue | `queue:` | Durable scan job queue or job table |
| compact report store | `store:` | Compact report persistence without raw source or diffs |
| worker sandbox | `sandbox:` | Read-only checkout and CLI execution boundary |
| Check Run publisher | `github-checks:` | GitHub Checks API publication adapter |
| log drain | `logs:` | Structured redacted logs |
| metrics | `metrics:` | Hosted health and queue/worker metrics |
| rollback | `rollback:` | Manual rollback target or previous image digest reference |
| incident response | `runbook:` | Hosted incident-response runbook reference |

The plan blocks raw signing-key values, webhook signing values, installation tokens, source, diffs, secret values, and customer payloads. It returns safe references and privacy metadata only.

## Staging Deployment Plan

`planHostedStagingDeployment` composes:

- `planHostedNodeContainerDeployment`
- `planHostedProviderBinding`
- `evaluateHostedOperationalReleaseGate`
- `planHostedGitHubAppDeployment`

The plan is ready only when all of these are true:

- public base URL is safe HTTPS
- container image digest is `sha256:<digest>`
- all secret and provider references use the expected prefixes
- every hosted operational release-gate P0 item has fresh evidence
- release notes avoid pentest, certification, and full-audit claims
- GitHub App manifest stays within the first-slice permission and event contract

The execution order is explicit:

1. bind provider adapters
2. deploy Node/container ingress and worker roles
3. configure GitHub App webhook
4. run webhook replay
5. run worker cleanup probe
6. verify Check Run publication
7. record release-gate evidence

## GitHub App Promotion

`planHostedGitHubAppPromotion` requires staging success before production GitHub App creation. Production promotion requires staging deployment, Check Run publication, and rollback verification before the production GitHub App plan can become ready.

- staging deployment verified
- staging Check Run publication verified
- staging rollback verified
- production release gate and GitHub App planner both pass

If any staging gate is missing, production promotion is blocked even if the lower-level manifest inputs look valid.

## Privacy

The staging planner never returns:

- signing-key material
- webhook signing values
- installation tokens
- raw webhook payloads
- untrusted PR text
- raw source
- raw diffs
- secret values
- customer payloads
- private URLs

## Current Status

The repository can now produce a staging deployment plan that ties together provider references, release-gate evidence, Node/container deployment, and GitHub App promotion readiness.

This still is not a live hosted service. A real staging environment still requires actual platform infrastructure, deployed containers, secret manager entries, durable queue/storage resources, worker sandboxing, GitHub Checks runtime credentials, monitoring, rollback evidence, and incident-response evidence collected from the deployed artifact.
