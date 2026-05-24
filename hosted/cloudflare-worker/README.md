# Cloudflare Hosted Ingress

This directory contains the first live hosted ingress for `ai-saas-guard`.

It is intentionally narrow:

- `GET /healthz` returns public-safe service health.
- `GET /github/app/manifest-callback` acknowledges the GitHub App manifest redirect without storing the one-time code.
- `POST /github/webhook` verifies GitHub `sha256` webhook signatures before JSON parsing or storage.
- Requests over 1 MiB are rejected before JSON parsing or KV writes.
- Signed `pull_request` events are reduced to trusted GitHub identity fields and stored in Cloudflare KV.
- When GitHub App bindings are configured, the Worker exchanges a scoped installation token, fetches PR file metadata from GitHub, runs compact PR-risk classification, and publishes a bounded Check Run summary.
- Duplicate GitHub delivery IDs are accepted idempotently.
- Responses and KV records do not include raw webhook payloads, PR title/body text, source code, diffs, secrets, customer payloads, checkout paths, or installation tokens.

This Worker is a real hosted ingress with first-slice Check Run publishing, not yet the complete scan worker. `shouldCreateCheckRun` is `true` only when the GitHub App bindings are present and the event passes installation scope checks. Full source checkout scanning remains gated behind the hosted operational release gate.

## Required Cloudflare Bindings

- `HOSTED_EVENTS`: Cloudflare KV namespace for compact delivery and queued scan records.
- `WEBHOOK_SECRET`: Worker secret matching the GitHub App webhook secret.
- `GITHUB_APP_PRIVATE_KEY`: Worker secret for the staging GitHub App private key, used only in memory to sign short-lived GitHub App JWTs.
- `SCANNER_VERSION`: public version string, currently `0.25.0`.
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
- KV namespace binding: `HOSTED_EVENTS`
- KV namespace ID: `fa5344fbd7944de6a776bf8731d58460`
- GitHub App slug: `ai-saas-guard-hosted`
- GitHub App ID: `3834787`
- GitHub App installation ID: `135085075`
- Installed repository: `zr9959/ai-saas-guard`
- Mode: signed webhook ingress and compact queueing only

## Release Boundary

Do not expose this as the full product. The hosted operational release gate still requires deployed evidence for Check Run publication, worker cleanup, monitoring, rollback, incident response, dependency and deployment artifact scanning, and GitHub App installation behavior.
