# Source-checkout worker (staging only)

Companion to the live webhook-ingress worker (`../cloudflare-worker`,
`ai-saas-guard-hosted`). This worker runs the **real scanner engine** — the
identical rule code as the CLI — over SHA-pinned PR source. The live ingress
worker only classifies PR file metadata; this worker executes all 66
deterministic rules over actual file contents.

## Architecture

```
GitHub API ──diff+files @ head SHA──▶ staging orchestrator ──POST /scan──▶ this worker
   (orchestrator holds the GitHub credential)            (worker holds NO GitHub credential)
                                                                              │
                                                                              ▼
                                                              classifyPrRisk + full scan suite
                                                              (same code as the CLI, bundled)
                                                                              │
                                                                              ▼
                                                              compact findings only
                                                              (ruleId, severity, file, line)
```

- **Worker entry:** `src/hosted/scan-worker/worker.ts` (type-checked, bundled with esbuild).
- **Pure logic:** `src/hosted/scan-worker/job.ts` (validation) and
  `src/hosted/scan-worker/engine.ts` (the engine), both cloud-independent and
  covered by `tests/source-checkout-worker.test.mjs`.
- **Node shims:** `src/hosted/scan-worker/node-shims.ts` — esbuild aliases for
  `node:child_process`, `node:fs/promises`, `node:util`, `node:path`, none of
  which execute in the worker (git is bypassed via explicit `diffText`; the
  ScanContext is built in memory).
- **Stateless:** no KV, no Durable Objects, no persisted records. Cleanup is
  trivially complete because nothing is stored.

## Why not containers

An earlier draft used Cloudflare Containers (Durable Object + Docker image
running `npx ai-saas-guard pr-risk` after a git checkout). It was set aside
because this build environment has no Docker daemon, and the container image
build is the only deploy path for that design. The plain-Worker design
reaches the same evidence — the deployed service runs the identical rule
engine over SHA-pinned PR source — through the already-proven direct API
deploy path, with a strictly stronger privacy posture (the worker cannot mint
GitHub tokens, clone repos, or publish Check Runs; SHA-addressed content fetch
is stronger than branch-name pinning).

## Deploy (staging only)

```bash
# 1. Bundle the worker (from the repo root)
node hosted/source-checkout-worker/build-bundle.mjs

# 2. Deploy via the Cloudflare API (uses the custom.cloudflare credential;
#    never prints secrets). Generates a SCAN_SECRET, uploads the worker,
#    sets the secret, and verifies /healthz.
python3 hosted/source-checkout-worker/deploy-staging.py \
  --account-id <account-id> \
  --secret-file /tmp/ai-saas-guard-scan-secret \
  --bundle /tmp/ai-saas-guard-scan-worker.mjs
```

Rollback for this staging-only worker is deletion, which removes the only
artifact (the worker holds no data):

```bash
# DELETE /accounts/<id>/workers/scripts/ai-saas-guard-source-checkout-staging
```

## Staging smoke

```bash
node scripts/hosted-source-checkout-staging.mjs \
  --worker-url https://ai-saas-guard-source-checkout-staging.<subdomain>.workers.dev \
  --scan-secret-file /tmp/ai-saas-guard-scan-secret \
  --evidence-file /tmp/phase3-smoke.json
```

The script opens a temporary PR with a fixture that exercises the engine,
POSTs the SHA-pinned diff and file contents, publishes a Check Run named
`ai-saas-guard source checkout (staging)` from the compact findings, then
closes the PR, deletes the branch, and cleans the live worker's trial KV
records. Evidence lands in the evidence file (0600); only compact findings,
counts, SHAs, PR numbers, check-run IDs, and stage results are recorded.
