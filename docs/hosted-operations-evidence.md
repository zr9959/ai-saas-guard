# Hosted Operations Evidence

This document records deployed hosted-service evidence for `ai-saas-guard`.

Passing these checks does not make the project a pentest, certification, or full security audit. The goal is narrower: keep hosted rollout claims tied to fresh operational evidence.

## Current Evidence

Recorded on 2026-05-24 from the deployed Cloudflare Worker and a temporary no-file-change GitHub PR smoke.

| Check | Evidence | Result |
| --- | --- | --- |
| Cloudflare Worker health | `GET https://ai-saas-guard-hosted.zr9959.workers.dev/healthz` returned `ok: true`, `checkRunPublisher: "configured"`, `scannerVersion: "0.28.0"`, and all privacy flags set to false for raw payloads, PR text, source, diffs, secrets, customer payloads, checkout paths, and installation tokens | Passed |
| Deployed Worker version | `wrangler deployments list` showed current version `531d2286-86c6-4327-bfd0-67cad8693c10`, deployed at `2026-05-24T09:01:25.706Z` | Passed |
| KV cleanup | `wrangler kv key list --namespace-id fa5344fbd7944de6a776bf8731d58460 --remote` returned `[]` after smoke cleanup | Passed |
| Temporary smoke PR cleanup | Temporary PR `#52` was closed, branch `codex/hosted-smoke-20260524170208` was deleted, and in-progress workflow run `26357038569` was cancelled | Passed |
| End-to-end GitHub App delivery | Temporary PR `#52` created `ai-saas-guard PR risk` from GitHub App `ai-saas-guard-hosted`; Check Run `77585561127` completed with conclusion `success` for head SHA `408925d2bf4df564082dabc3e1893a72c25bdd19` | Passed |
| Compact hosted record | KV scan record `scan:135085075:1247239389:52:408925d2bf4df564082dabc3e1893a72c25bdd19:0.28.0` completed with zero findings, `conclusion: "success"`, and all privacy flags set to false for raw payloads, PR text, source, diffs, secrets, customer payloads, checkout paths, and installation tokens | Passed |

## Remaining Release Gate Gaps

The deployed Cloudflare Worker now receives signed GitHub App webhook delivery for pull request events and publishes bounded compact Check Runs. This is still staging evidence, not production hosted exposure.

The hosted release gate still requires fresh deployed evidence for:

- full Node/container read-only checkout scan worker deployment
- worker sandbox network restrictions and cleanup evidence
- logs, metrics, alerting, rollback, and incident-response drills
- dependency and container artifact scanning for the deployed worker image
- retention and uninstall cleanup against the deployed provider stores

## Smoke Procedure

Use this sequence after each hosted Worker deployment:

```bash
curl -fsSL https://ai-saas-guard-hosted.zr9959.workers.dev/healthz
npx wrangler deployments list
npx wrangler kv key list --namespace-id fa5344fbd7944de6a776bf8731d58460 --remote
```

Then open a temporary no-file-change PR, wait for an `ai-saas-guard PR risk` Check Run on the smoke commit, and close the PR plus delete the branch. After the smoke run, verify no temporary KV records remain unless a retained compact report is intentionally part of that test.

Do not leave smoke PRs, scratch branches, package tarballs, SARIF files, or test KV records behind.
