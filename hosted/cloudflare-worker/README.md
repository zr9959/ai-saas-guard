# Cloudflare Hosted Ingress

This directory contains the first live hosted ingress for `ai-saas-guard`.

It is intentionally narrow:

- `GET /healthz` returns public-safe service health.
- `GET /github/app/install-info` returns public-safe installation guidance, first-slice permissions, subscribed events, privacy boundaries, and uninstall wording.
- `GET /github/app/manifest-callback` acknowledges the GitHub App manifest redirect without storing the one-time code.
- `POST /github/webhook` verifies GitHub `sha256` webhook signatures before JSON parsing or storage.
- Requests over 1 MiB are rejected before JSON parsing or KV writes.
- Signed `pull_request` events are reduced to trusted GitHub identity fields and stored in Cloudflare KV.
- When GitHub App bindings are configured, the Worker exchanges a scoped installation token, fetches PR file metadata from GitHub, runs compact PR-risk classification, and publishes a bounded Check Run summary.
- The Check Run summary names the selected-repository hosted check, the Review queue, and a Manual proof prompt so reviewers know which trust-boundary files to inspect before merge.
- Signed `installation` deletion events and `installation_repositories` `repositories_removed` events delete matching compact `scan:<installation>:...` records from KV when KV list/delete bindings are available.
- Duplicate GitHub delivery IDs are accepted idempotently.
- Responses and KV records do not include raw webhook payloads, PR title/body text, source code, diffs, secrets, customer payloads, checkout paths, or installation tokens.

This Worker is a real hosted ingress with first-slice Check Run publishing code, not yet the complete scan worker. `shouldCreateCheckRun` is `true` only when the GitHub App bindings are present and the event passes installation scope checks. Current operations evidence is tracked in [docs/hosted-operations-evidence.md](../../docs/hosted-operations-evidence.md); the Worker health check, signed webhook delivery, KV cleanup, and compact Check Run smoke pass in staging. Full source checkout scanning remains gated behind the hosted operational release gate and the Node/container checkout worker deployment path.

## Required Cloudflare Bindings

- `HOSTED_EVENTS`: Cloudflare KV namespace for compact delivery and queued scan records.
- `WEBHOOK_SECRET`: Worker secret matching the GitHub App webhook secret.
- `GITHUB_APP_PRIVATE_KEY`: Worker secret for the staging GitHub App private key, used only in memory to sign short-lived GitHub App JWTs.
- `SCANNER_VERSION`: public version string, currently `0.38.0`.
- `GITHUB_APP_ID`, `GITHUB_APP_SLUG`, `GITHUB_APP_INSTALLATION_ID`: public staging identifiers for the private GitHub App installation.

## Deployment

Use `wrangler` from this directory:

```bash
npx wrangler kv namespace create HOSTED_EVENTS
npx wrangler secret put WEBHOOK_SECRET
npx wrangler secret put GITHUB_APP_PRIVATE_KEY
npx wrangler deploy
```

After creating the KV namespace, replace the placeholder namespace ID in `wrangler.jsonc`.

Current public staging endpoint:

- Worker URL: `https://ai-saas-guard-hosted.zr9959.workers.dev`
- Install-info URL: `https://ai-saas-guard-hosted.zr9959.workers.dev/github/app/install-info`
- KV namespace binding: `HOSTED_EVENTS`
- KV namespace ID: `fa5344fbd7944de6a776bf8731d58460`
- GitHub App slug: `ai-saas-guard-hosted`
- GitHub App ID: `3834787`
- GitHub App installation ID: `135085075`
- Installed repository: `zr9959/ai-saas-guard`
- Mode: signed webhook ingress, compact queueing, PR file metadata classification, and bounded Check Run publishing

## Public Install Guidance

`GET /github/app/install-info` is designed for the first screen a repository admin sees before installation. It returns only public-safe fields:

- install URL for `ai-saas-guard-hosted`
- first-slice permissions: `checks: write`, `contents: read`, `pull_requests: read`, and `metadata: read`
- subscribed events: `pull_request`, `installation`, and `installation_repositories`
- selected-repository boundary and explicit wording that the hosted check is not an AI reviewer, pentest, full audit, or certification
- uninstall/data deletion wording for compact records

Do not add raw app private keys, webhook secrets, installation tokens, source, diffs, customer payloads, or checkout paths to this response.

## Check Run Shape

The Check Run is intentionally compact. It should answer:

- What changed at a launch-risk boundary?
- Which files are in the Review queue?
- What Manual proof should block merge until it passes?
- What selected-repository permissions did the hosted check use?

The Check Run must not include patch text, source snippets, PR title/body text, secrets, installation tokens, customer data, or private checkout paths.

## Uninstall And Repository Removal

The Worker handles signed GitHub cleanup events, including installation deletion:

- `installation` with action `deleted` deletes compact scan records for the installation.
- `installation_repositories` with action `removed` deletes compact scan records for removed repository IDs.
- repeated cleanup is safe because deleting an already-removed compact record is a no-op.

Delivery audit records may remain for the normal KV TTL. They must not contain source, diffs, secrets, customer payloads, PR-authored text, checkout paths, or installation tokens.

## Release Boundary

Do not expose this as the full product. The hosted operational release gate still requires deployed evidence for Check Run publication, worker cleanup, monitoring, rollback, incident response, dependency and deployment artifact scanning, and GitHub App installation behavior.
