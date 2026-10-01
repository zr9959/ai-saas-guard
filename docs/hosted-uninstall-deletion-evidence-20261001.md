# Hosted Uninstall And Data Deletion Evidence (2026-10-01)

Branch: `agent/uninstall-deletion-proof`. This file records the deletion-proof work done on
2026-10-01. It does not modify `docs/hosted-operations-evidence.md` (parallel work in progress).

Honesty statement up front:

- **Proven**: worker webhook cleanup logic completed and unit-tested (all paths), staging worker
  reachable and healthy, staging KV baseline read (keys only), GitHub permission boundary re-verified
  read-only.
- **Still blocked**: real signed `installation.deleted` / `installation_repositories.removed` event
  proof in staging. Generating it requires adding/removing a repository on the production App
  installation `135085075`, which the current credential cannot do (403, read-only check) and which
  this task forbids attempting. The new worker code is also not yet deployed to the staging worker
  (it must go through PR review first).
- This file does **not** claim full uninstall/deletion proof. The operational gate item
  `uninstall_deletion_proof_missing` is **not yet closed** for the deployed path.

## 1. What Was Completed In Code

File: `hosted/cloudflare-worker/src/index.js` (webhook ingress `POST /github/webhook`).

The pre-existing implementation only deleted `scan:` keys. The gaps versus
`docs/hosted-uninstall-data-deletion.md` were: no `delivery:` replay-protection deletion, no queue
cancellation accounting, no idempotency beyond duplicate-delivery dedup, no audit records, and no
precise user-facing deletion wording. All are now implemented:

| Event | Action | Scope | What cleanup does |
| --- | --- | --- | --- |
| `installation` | `deleted` | installation | Deletes all `scan:<installationId>:` compact records; **cancels queued/pending/running jobs first** (statuses `queued`/`pending`/`running` are counted as `canceledJobs` and their records are deleted); deletes `delivery:` replay-protection records attributable to the installation (current delivery receipt is kept); writes a limited audit record; stores idempotency records. |
| `installation_repositories` | `removed` | repository | Deletes `scan:<installationId>:<repositoryId>:` records per removed repository; cancels queued jobs first; deletes only `delivery:` records attributable to the removed repository (`stored.repositoryId` or `stored.identity.repositoryId` in the removed list); unattributable records are left alone. |
| any other action / empty `repositories_removed` / missing installation id | — | — | Safe no-op: nothing deleted, no audit or idempotency records created, `202` with `stage: "ignored"`. |

Idempotency uses the key formats from `docs/hosted-uninstall-data-deletion.md` verbatim:

- `installation_deleted:<installationId>:all`
- `repository_removed:<installationId>:<repositoryId>`
- `repeated_cleanup:<installationId>:<repositoryId>` (and `:all`)

A repeated cleanup (GitHub resending with a new delivery id, or an explicit repeat) returns the
stored result — same `deletedRecords`, `canceledJobs`, `auditRecordId`, and user-facing message —
and does **not** recreate deleted records, requeue work, or touch records created after the first
cleanup.

Audit records (`cleanup:audit:<trigger>:<installationId>:<deliveryId>`, 90-day KV TTL) carry only:
cleanup request id, installation id, repository ids, trigger, status, timestamp, deleted/canceled
counts, and an error class on failure. No raw source, raw diffs, secrets, customer payloads, private
URLs, PR text, or installation tokens.

The response carries the precise wording from the deletion policy:

> We removed hosted app-side compact reports and queued work for this scope. GitHub-owned check runs
> may remain in GitHub according to your repository settings. The local CLI remains available and
> does not require the hosted app. The hosted app does not store raw source, raw diffs, secrets, or
> customer payloads by default.

The worker never calls GitHub during cleanup (`githubCalls === 0` in tests) and never creates check
runs for cleanup events (`shouldCreateCheckRun: false`).

Note: the Cloudflare ingress worker performs no source checkouts (it fetches PR file metadata via
API), so there is no worker checkout directory to delete at this layer. Checkout deletion is covered
by the pure contract helper `planHostedRetentionAndDeletionCleanup` (`src/hosted/contracts.ts`) and
its tests.

## 2. Unit Tests (All Passing)

`tests/cloudflare-worker.test.mjs` gained 8 tests (23 total in file; 237 total in repo, all passing):

1. installation deletion deletes `scan:` + attributable `delivery:` records, cancels queued jobs,
   writes limited audit + idempotency records, returns the user-facing message, makes no GitHub calls.
2. Repeated installation deletion (new delivery id) returns the stored result with `repeated: true`
   and leaves records created after the first cleanup untouched.
3. `installation_repositories.removed` deletes only the removed repository's records (scan repo-scoped;
   delivery only repo-attributable); other repositories, other installations, and unattributable
   records are untouched.
4. Repeated repository-removal cleanup is idempotent.
5. No-op safety: `installation` action `created`, `installation_repositories` action `added`, empty
   `repositories_removed`, and missing installation id all return `202 ignored` with zero deletions
   and no audit/idempotency records.
6. Cleanup events never queue work, never fetch, never create check runs.
7. Cleanup records and responses contain no secret-like material (token prefixes, private key
   markers, HMAC signatures, test secret literal).

Validation run: `npm run build` (tsc) passed; `npm test` → 237 pass, 0 fail.

## 3. Staging Baseline (Read-Only, 2026-10-01)

No secrets were read, printed, or written. No existing records were created, modified, or deleted.

| Check | Method | Result |
| --- | --- | --- |
| Staging worker health | `GET https://ai-saas-guard-hosted.zr9959.workers.dev/healthz` | HTTP 200, `scannerVersion: "0.43.0"`, rate limit configured, abuse kill switch configured, `processingPaused: false`, all privacy flags false. |
| Install info | `GET .../github/app/install-info` | HTTP 200, lists `pull_request`, `installation`, `installation_repositories` events and uninstall wording. |
| KV baseline | Cloudflare API `storage/kv` keys list (key names only, no values read) on namespace `fa5344fbd7944de6a776bf8731d58460` | 18 `scan:` keys, all under `scan:135085075:1247239389:` (production installation `135085075`, repository `zr9959/ai-saas-guard` id `1247239389`); 87 `delivery:` keys. |
| GitHub permission boundary | Read-only `GET /user/installations/135085075/repositories` via `bin/gh_api.py` pattern | HTTP 403 `Resource not accessible by personal access token`. The modifying `PUT /user/installations/135085075/repositories/...` was **not attempted** (it would add a repository to the production installation). |

The deployed staging worker still runs the previous code (scanner `0.43.0` build). The new cleanup
code ships in this branch and must be merged and redeployed before the real-event proof below.

## 4. Still Blocked: Real Signed Event Proof

A real `installation.deleted` or `installation_repositories.removed` proof requires GitHub to deliver
a genuinely signed webhook to the staging worker, which requires adding then removing a repository
on installation `135085075`. Blockers:

- The current credential cannot manage the installation (403 on the read-only list; the 2026-05-26
  evidence shows the modifying `PUT` also returns 403). Only the user (account owner) can change the
  installation's repository selection.
- This task forbids touching the production installation or its existing compact scan records, so no
  agent-side attempt was made.
- Full `installation.deleted` proof additionally requires uninstalling the whole app — destructive by
  definition — and is only safe on a throwaway test installation the user controls; the repository
  removal path below is the recommended proof.

Operational-gate impact: of the gate items in `docs/hosted-uninstall-data-deletion.md`
("Operational Gate" section), all are now covered by unit tests except the **deployed** staging
real-event proof. `uninstall_deletion_proof_missing` stays open until section 5 is executed.

## 5. User One-Click Checklist (After PR Merge + Worker Redeploy)

Prerequisite: the PR from branch `agent/uninstall-deletion-proof` is merged and the worker is
redeployed (`npx wrangler deploy` from `hosted/cloudflare-worker/`), so the staging worker at
`https://ai-saas-guard-hosted.zr9959.workers.dev` runs the new cleanup code. Verify with
`GET /healthz` (still `scannerVersion: "0.43.0"` after redeploy of this change).

The user performs one flow; each step produces the real signed event:

1. Create a temporary **private** repository (name it e.g. `ai-saas-guard-uninstall-proof-20261001`):
   `https://github.com/new` → name, Private, no README → Create. Note its numeric repository ID
   from `https://api.github.com/repos/zr9959/ai-saas-guard-uninstall-proof-20261001` (`id` field).
2. Record the KV baseline (agent or user): list `scan:135085075:<newRepoId>:` keys — expected `[]`.
   (Optional stronger proof: the agent can write one dedicated test key
   `scan:135085075:<newRepoId>:0:aaa...:0.43.0` with TTL into the staging KV namespace
   `fa5344fbd7944de6a776bf8731d58460`; it must disappear in step 5. This touches no production records.)
3. Add the repo to the app: `https://github.com/settings/installations` → click **Configure** on
   **ai-saas-guard-hosted** → under "Repository access", add the temporary repo to the selected list
   → **Save**. Expected: GitHub fires `installation_repositories` with action `added`; the worker
   returns `202`, `stage: "ignored"`, nothing deleted (safe no-op).
4. Remove the repo: same Configure page → remove the temporary repo from the list → **Save**.
   Expected: GitHub fires `installation_repositories` with action `removed` to
   `POST https://ai-saas-guard-hosted.zr9959.workers.dev/github/webhook`. The worker must return
   `202`, `stage: "cleanup"`, `reason: "repositories_removed"`, plus `deletedRecords`,
   `canceledJobs`, `auditRecordId`, and the precise user-facing `message`.
5. Verify in staging KV (namespace `fa5344fbd7944de6a776bf8731d58460`):
   - `scan:135085075:<newRepoId>:` lists `[]` (the seeded test key is gone).
   - Existing `scan:135085075:1247239389:` keys (18 at baseline) are **unchanged**.
   - Idempotency keys exist: `repository_removed:135085075:<newRepoId>` and
     `repeated_cleanup:135085075:<newRepoId>`.
   - Audit record `cleanup:audit:repositories_removed:135085075:<deliveryId>` exists with limited
     fields only.
   - Repeat check: GitHub redelivers are deduped (`duplicate_delivery`), and a manual re-trigger
     returns the identical result with `repeated: true`.
6. Delete the temporary repository: `https://github.com/zr9959/ai-saas-guard-uninstall-proof-20261001/settings`
   → Danger Zone → Delete. The installation's existing records were never touched.

If step 4's webhook never arrives, check the App's webhook delivery log:
`https://github.com/settings/apps/ai-saas-guard-hosted` → Advanced → Recent Deliveries.

## 6. Files Changed (This Branch)

- `hosted/cloudflare-worker/src/index.js` — completed cleanup logic (idempotency, delivery ID
  deletion, queue cancellation, audit records, user-facing wording, safe no-ops).
- `tests/cloudflare-worker.test.mjs` — 8 new webhook cleanup tests.
- `hosted/cloudflare-worker/README.md` — "Uninstall And Repository Removal" section rewritten to
  match the implemented behavior.
- `docs/hosted-uninstall-deletion-evidence-20261001.md` — this file (new).

Note: the working tree also contains unrelated parallel-work changes
(`docs/design-partner-outreach-kit.md` modified, `docs/hosted-pricing-draft.md` untracked); they are
not part of this branch's commits.
