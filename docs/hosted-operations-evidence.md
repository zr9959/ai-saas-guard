# Hosted Operations Evidence

This document records deployed hosted-service evidence for `ai-saas-guard`.

Passing these checks does not make the project a pentest, certification, or full security audit. The goal is narrower: keep hosted rollout claims tied to fresh operational evidence.

## Current Evidence

Recorded on 2026-05-24 from the deployed Cloudflare Worker.

| Check | Evidence | Result |
| --- | --- | --- |
| Cloudflare Worker health | `GET https://ai-saas-guard-hosted.zr9959.workers.dev/healthz` returned `ok: true`, `checkRunPublisher: "configured"`, `scannerVersion: "0.25.0"`, and all privacy flags set to false for raw payloads, PR text, source, diffs, secrets, customer payloads, checkout paths, and installation tokens | Passed |
| Deployed Worker version | `wrangler deployments list` showed current version `bc4b87d9-420a-48bb-a058-8066b08abe03`, deployed at `2026-05-24T04:30:41.924Z` | Passed |
| KV cleanup | `wrangler kv key list --namespace-id fa5344fbd7944de6a776bf8731d58460 --remote` returned `[]` after smoke cleanup | Passed |
| Temporary smoke PR cleanup | Temporary PR `#36` was closed and branch `codex/hosted-smoke-20260524123129` was deleted | Passed |
| End-to-end GitHub App delivery | Temporary PR `#36` triggered normal GitHub Actions and CodeQL checks, but no `ai-saas-guard PR risk` Check Run appeared and no KV delivery record was created | Blocked |

## Current Blocker

The deployed Worker is configured to publish compact PR-risk Check Runs when it receives a signed `pull_request` webhook. The temporary smoke PR did not create any Worker KV records, which means the GitHub App webhook did not reach the Worker.

Before claiming live automatic PR checks, inspect the private GitHub App settings for `ai-saas-guard-hosted` and verify:

- the webhook is active
- the webhook URL is `https://ai-saas-guard-hosted.zr9959.workers.dev/github/webhook`
- the webhook secret matches the Cloudflare `WEBHOOK_SECRET`
- `pull_request` events are subscribed
- the App installation still includes `zr9959/ai-saas-guard`

## Smoke Procedure

Use this sequence after each hosted Worker deployment:

```bash
curl -fsSL https://ai-saas-guard-hosted.zr9959.workers.dev/healthz
npx wrangler deployments list
npx wrangler kv key list --namespace-id fa5344fbd7944de6a776bf8731d58460 --remote
```

Then open a temporary no-file-change PR, wait for an `ai-saas-guard PR risk` Check Run on the smoke commit, and close the PR plus delete the branch. After the smoke run, verify no temporary KV records remain unless a retained compact report is intentionally part of that test.

Do not leave smoke PRs, scratch branches, package tarballs, SARIF files, or test KV records behind.
