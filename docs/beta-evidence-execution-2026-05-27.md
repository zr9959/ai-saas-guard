# Beta Evidence Execution - 2026-05-27

This document records the ordered 1-7 evidence pass requested on 2026-05-27. It is public-safe and docs-only. It does not open public beta, team rollout, paid packaging, billing, pricing, marketplace conversion, sales funnel work, or commercialization.

## Step 1: Status Snapshot

Fresh checks:

```bash
git status -sb
git branch --show-current
git log --oneline -5
gh run list --branch main --limit 8 --json databaseId,workflowName,status,conclusion,headSha,url,createdAt
gh release view --json tagName,targetCommitish,publishedAt,url
npm view ai-saas-guard@latest version dist-tags --json
curl --retry 3 --retry-delay 2 -fsSL https://ai-saas-guard-hosted.zr9959.workers.dev/healthz
gh issue view 93 --json number,title,state,updatedAt,comments
gh issue view 94 --json number,title,state,updatedAt,comments
```

Observed state:

- local `main` was clean and in sync with `origin/main`
- current `main` HEAD was `d3535a4 docs: refresh beta readiness evidence`
- latest observed `main` CI and CodeQL runs for `d3535a4` succeeded
- latest observed Metrics Snapshot and Cross-Project Discovery runs on `main` succeeded
- GitHub release was `v0.43.1`, published 2026-05-26
- npm latest was `ai-saas-guard@0.43.1`
- hosted health returned `ok: true`, `mode: "webhook-ingress"`, `processingPaused: false`, `checkRunPublisher: "configured"`, `rateLimit: "configured"`, `abuseKillSwitch: "configured"`, safe privacy flags, and `scannerVersion: "0.43.0"`
- issue `#93` remained open with no real DP-1, DP-2, or DP-3 feedback record
- issue `#94` remained open with provider evidence blockers for deployed source-checkout, full GitHub App deletion proof, and source-checkout monitoring evidence

## Step 2: Real Design-Partner Feedback Path

Current result: blocked on real participants.

Issue `#93` already contains the public-safe intake template and current outreach copy. The valid feedback path remains:

```bash
npx --yes ai-saas-guard@latest demo --summary
npx --yes ai-saas-guard@latest scan --root <your-low-risk-demo-repo> --summary
```

Valid evidence must come from a real person or team that ran or reviewed one workflow. A public-safe record can include only:

- target label: DP-1, DP-2, or DP-3
- package version or date when using `latest`
- path used: local CLI, GitHub Action, or hosted Check Run
- stack category and public-safe repository category
- severity counts and rule IDs only
- install or first-scan friction
- false-positive or possible false-negative categories by rule ID
- confusing, noisy, missing, or hard-to-trust output
- whether the result would change a launch or merge decision
- privacy or support confusion

Do not record source, raw diffs, PR title/body/comments, raw logs, secrets, credentials, customer data, private URLs, checkout paths, participant contact details, or installation tokens in the public repository.

Stars, downloads, traffic, anonymous comments, simulated scans, internal scans, and platform metrics do not count as design-partner evidence.

Next valid action: collect one real sanitized record for DP-1, DP-2, or DP-3, then update issue `#93` using the template in `docs/public-beta-evidence-feedback.md`.

## Step 3: Source-Checkout Worker Evidence

Current result: not ready to run against the live service.

The current public hosted endpoint reports `mode: "webhook-ingress"` and does not report the deployed Node/container source-checkout shape required by `docs/hosted-deployed-worker-staging.md`.

Before this proof can pass, the deployed candidate must provide:

- public HTTPS `/healthz`
- `ok: true`
- `platform: "node_container"`
- roles including both `webhook-ingress` and `scan-worker`
- scanner version matching the candidate artifact
- platform-managed secrets outside the repository
- durable queue or job table
- compact report store
- sandboxed read-only checkout runner
- GitHub Checks publisher
- privacy flags showing no raw webhook payload, untrusted PR text, raw source, raw diffs, secrets, customer payloads, private checkout path, or installation token

Evidence to collect for the source-checkout worker:

1. public-safe health response from the deployed candidate
2. signed webhook replay summary
3. successful source-checkout run with cleanup verified
4. failed source-checkout run with cleanup verified
5. safe log-boundary sample review using only metadata
6. compact report storage proof
7. Check Run publication proof
8. release gate output from `evaluateHostedDeployedWorkerStagingReleaseGate`
9. source-checkout trial gate output showing `evaluateHostedSourceCheckoutTrialGate` can be supported by real evidence

This execution pass did not deploy a source-checkout worker, mutate Cloudflare, fetch private repository source, print secrets, or run a hosted source checkout. The next valid action is to stage a candidate artifact and collect the evidence above using `docs/hosted-deployed-worker-staging.md`.

## Step 4: GitHub App Deletion Proof Path

Current result: blocked on App-management permission or a separate safe test installation.

Safe read-only permission probe:

```bash
gh api /user/installations --jq '{total_count}'
```

Observed result:

- HTTP `403`
- message: the current session is not authorized to list installations accessible to the user access token

Do not remove the current `zr9959/ai-saas-guard` installation to create evidence. That installation contains useful staging evidence and removing it would be destructive.

The safe proof path remains:

1. Use a GitHub session that can modify the `ai-saas-guard-hosted` installation, or create a separate safe test installation controlled only for this proof.
2. Create a temporary private test repository.
3. Add only that temporary repository to the safe test installation.
4. Create one dedicated compact test record scoped to the temporary repository.
5. Remove the temporary repository from the installation and wait for the signed `installation_repositories` event.
6. Verify only the matching compact `scan:<installation>:<repository>:` records were deleted.
7. Delete the temporary repository.
8. Verify no test records, temporary repository, smoke branches, or temp files remain.

Pass condition:

- unrelated installation or repository records remain untouched
- event path is signed and processed by the deployed Worker
- before/after compact record counts are recorded without raw payloads, secrets, private URLs, checkout paths, or installation tokens

## Step 5: Provider Monitoring Evidence

Current result: ingress monitoring evidence is partial; source-checkout monitoring evidence is missing until a deployed source-checkout worker exists.

Required evidence for the source-checkout path:

| Area | Required public-safe evidence | Minimum response expectation |
| --- | --- | --- |
| Ingress rejection and 5xx | alert name, threshold, latest sample timestamp, owner, last test result | owner can distinguish invalid signatures, rate limits, and unexpected 5xx without raw payloads |
| Queue or job backlog | metric name, threshold, sample count, owner, response window | owner can see stuck source-checkout work before Check Runs go stale |
| Worker failure and timeout | metric name, timeout threshold, safe error-class counts, owner | owner can pause processing and identify failure class without source or checkout paths |
| Check Run write failure | alert name, safe GitHub API status class counts, owner | owner can tell whether GitHub publication failed after a worker run |
| Checkout cleanup failure | metric or event name, cleanup status counts, owner | cleanup failures create operator-review events without exposing checkout directories |
| Compact report retention/deletion failure | retention job name, failure count, latest safe run timestamp, owner | owner can prove compact records expire or delete without touching unrelated records |
| Pause and abuse kill switch | health field, drill timestamp, owner, restore timestamp | owner can pause source-checkout side effects and restore processing intentionally |
| Rollback and incident drill | artifact before/after, health before/after, affected Check Run identification method, owner | owner can roll back a bad source-checkout artifact without asking users to modify repos |

Public records may include metric names, alert names, thresholds, owner role, safe counts, timestamps, artifact IDs, scanner version, and result.

Public records must not include raw provider logs, source, raw diffs, PR text, webhook payload bodies, secrets, tokens, customer payloads, private URLs, checkout paths, or installation tokens.

Next valid action: after a source-checkout candidate exists, export sanitized provider alert/metric evidence and attach it to issue `#94` plus `docs/hosted-operations-evidence.md`.

## Step 6: Release And Evidence Verification

Fresh verification commands:

```bash
git diff --check
npm test
npm view ai-saas-guard@latest version dist-tags --json
npx --yes ai-saas-guard@latest demo --summary
node dist/cli.js scan --root . --summary
node dist/cli.js scan --root . --json > /tmp/ai-saas-guard-execution-self-scan-20260527.json
node dist/cli.js pr-risk --root . --json > /tmp/ai-saas-guard-execution-pr-risk-20260527.json
node dist/cli.js check-supabase --root .
node dist/cli.js check-actions --root .
node dist/cli.js check-mcp --root .
node dist/cli.js check-stripe --root .
curl --retry 3 --retry-delay 2 -fsSL https://ai-saas-guard-hosted.zr9959.workers.dev/healthz
```

Observed result:

- `git diff --check` passed
- `npm test` passed with 208 tests
- npm latest remained `ai-saas-guard@0.43.1`
- `npx --yes ai-saas-guard@latest demo --summary` reported the expected risky fixture with 19 findings and safe fixture with 0 findings
- local `scan --root . --summary` returned 0 findings
- self-scan JSON returned 0 findings
- `pr-risk --root . --json` returned one info finding: `pr-risk.no-diff`
- focused Supabase, Actions, MCP, and Stripe checks returned 0 findings
- hosted health remained `ok: true`, `mode: "webhook-ingress"`, `processingPaused: false`, safe privacy flags, and `scannerVersion: "0.43.0"`

No npm publish was attempted because this execution pass is docs/evidence only and does not change runtime code or package version.

## Step 7: Cleanup And Sync

Cleanup performed before sync:

```bash
rm -f /tmp/ai-saas-guard-execution-self-scan-20260527.json /tmp/ai-saas-guard-execution-pr-risk-20260527.json
pgrep -fl "node --test|wrangler|vite|next dev|tsx|ts-node|hosted-pr-smoke|gh run watch|gh pr checks"
git status -sb
```

Observed result before commit:

- temporary self-scan and PR-risk JSON outputs were removed from `/tmp`
- no matching temporary test, dev, deploy, smoke, or GitHub watch process was running
- only intentional docs/evidence files were changed

Sync status: pending PR creation and merge.
