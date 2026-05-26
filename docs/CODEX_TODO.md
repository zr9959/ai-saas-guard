# Codex TODO

Last updated: 2026-05-26, Asia/Shanghai.

Do not start commercialization. The current work is pre-commercial evidence, feedback, and operational readiness.

## P0: Preserve Handoff State And Stop Business Development

Acceptance:

- new Codex reads `docs/CODEX_HANDOFF.md`, `docs/CODEX_STATE.md`, `docs/CODEX_TODO.md`, `docs/CODEX_RECENT_CHANGES.md`, and `docs/release-quality-knowledge-base.md`
- new Codex summarizes understanding before modifying code
- no business-code changes happen unless the user explicitly asks

Files/modules:

- `docs/CODEX_HANDOFF.md`
- `docs/CODEX_STATE.md`
- `docs/CODEX_TODO.md`
- `docs/CODEX_RECENT_CHANGES.md`

Risks:

- old long conversation context may conflict with handoff files; use handoff files and project files as source of truth
- current working tree may contain documentation-only handoff changes

## P0: Protect Secrets, Config, And Hosted Evidence

Acceptance:

- no real secrets, tokens, private keys, database URLs, cookies, or customer data are committed
- Cloudflare `WEBHOOK_SECRET` and `GITHUB_APP_PRIVATE_KEY` stay secret
- Cloudflare KV `HOSTED_EVENTS` records are not bulk-deleted except during an explicit smoke cleanup task
- historical rows in `docs/hosted-operations-evidence.md` remain intact

Files/modules:

- `hosted/cloudflare-worker/wrangler.jsonc`
- `docs/hosted-operations-evidence.md`
- `.local/project-handoff.md`

Risks:

- accidental deletion of hosted evidence weakens release traceability
- accidental secret printing or committing would require immediate rotation

## P1: Resolve Or Commit Documentation Handoff Changes

Acceptance:

- review `git status --short --branch`
- decide whether to commit, update, or discard documentation-only handoff changes
- do not revert user-owned changes without explicit approval

Files/modules:

- `docs/project-handoff.md`
- `docs/CODEX_*.md`
- `docs/public-beta-evidence-feedback.md`
- `docs/hosted-operational-release-gate.md`
- `.local/project-handoff.md` if local-only updates are needed

Risks:

- `docs/project-handoff.md` had an uncommitted update before the CODEX handoff package was generated
- `docs/public-beta-evidence-feedback.md` and the release-gate cross-reference are documentation-only follow-up changes and should be reviewed before committing or discarding
- `.local/project-handoff.md` is ignored by git and should not be expected in remote clones

## P1: Collect Real Design-Partner Feedback

Acceptance:

- use `docs/public-beta-evidence-feedback.md` as the privacy-safe feedback intake template
- use GitHub issue `#93` as the public-safe tracking issue
- identify at least 3 target users or repositories for feedback
- record feedback without collecting source, diffs, secrets, PR text, or customer payloads
- summarize friction points around install, first scan, Check Run readability, false positives, and missing launch risks
- do not enable paid plans or billing

Files/modules:

- `docs/public-beta-evidence-feedback.md`
- `README.md`
- `docs/README.zh-CN.md`
- `docs/hosted-install-privacy.md`
- `docs/hosted-operational-release-gate.md`

Risks:

- feedback collection can drift into marketing/commercialization too early
- privacy promises must stay conservative

## P1: Prepare Public Beta Operations Evidence

Acceptance:

- use `docs/public-beta-evidence-feedback.md` as the provider evidence matrix before opening beta
- use GitHub issue `#94` as the public-safe provider evidence tracking issue
- provider monitoring evidence exists for ingress errors, queue depth, worker failure, Check Run failure, cleanup failure, and rollback
- incident owner and support path are documented
- uninstall/deletion proof remains current
- `evaluateHostedBetaReadinessGate` inputs can be supported by real evidence, not only tests

Files/modules:

- `src/hosted/beta.ts`
- `docs/public-beta-evidence-feedback.md`
- `docs/hosted-operator-runbook.md`
- `docs/hosted-operational-release-gate.md`
- `docs/hosted-operations-evidence.md`
- `hosted/cloudflare-worker/src/index.js`

Risks:

- readiness gate passing in code is not the same as provider evidence passing
- do not open public beta without real operational proof
- the latest Phase 4 recheck is blocked on missing Phase 3 deployed proof, rate limits, abuse kill switch, uninstall/deletion proof, rollback, incident owner, and support path
- the operator runbook is documentation only until exercised against deployed artifacts
- the 2026-05-26 staging rollback drill now provides rollback evidence, and exact compact-record deletion was proven for a dedicated test key
- full GitHub App uninstall/repository-removal cleanup proof still needs a safe test repository or authorized App-management session; do not remove the current `ai-saas-guard` installation because it would delete existing scan evidence
- the 2026-05-26 App-management attempt proved the current session cannot modify the `ai-saas-guard-hosted` installation; the temporary test repo was deleted after HTTP 403
- provider alert exports and real design-partner feedback remain missing
- primary incident owner and public-safe support path evidence now exist; backup coverage is a pause-hosted fallback, not a staffed second operator

## P1: Deploy Full Source-Checkout Worker Only With Evidence

Acceptance:

- selected-repository identity is trusted only from signed GitHub event fields
- token scope is `contents: read`
- checkout uses temporary sandbox directory
- CLI command is fixed to deterministic `pr-risk --json`
- source, diffs, PR text, checkout path, and installation tokens are not stored or logged
- success and failure cleanup are proven against deployed artifact

Files/modules:

- `src/hosted/worker.ts`
- `src/hosted/app.ts`
- `src/hosted/service.ts`
- `docs/hosted-deployed-worker-staging.md`
- `docs/hosted-operational-release-gate.md`

Risks:

- live Cloudflare Worker currently does not run full source checkout scans
- deployed worker sandboxing, monitoring, rollback, and incident-response evidence are still required

## P2: Improve Public Docs Without Changing Product Scope

Acceptance:

- README first screen remains buyer-pain focused
- Chinese README stays aligned with English README
- docs avoid pentest/full-audit/certification claims
- docs clarify CLI vs Action vs Hosted paths

Files/modules:

- `README.md`
- `docs/README.zh-CN.md`
- `docs/positioning.md`
- `docs/launch-gate-positioning.md`

Risks:

- overclaiming hosted capability before full source-checkout deployment
- making docs too technical for founders

## P2: SEO/GEO Is Deferred

Acceptance:

- no analytics/tracking is added without privacy review
- if a website is later created, it must not collect source, diffs, PR text, customer payloads, or personal data without explicit policy
- current discoverability remains GitHub/npm/README-driven

Files/modules:

- none currently

Risks:

- premature SEO work can distract from product proof
- analytics could violate privacy positioning

## P2: Admin And Mobile Are Deferred

Acceptance:

- no admin dashboard or mobile app is built unless explicitly requested
- before beta, define operator workflows for pause, rollback, queue/failure checks, compact record deletion, and support
- docs remain readable on mobile, but no mobile UI is required

Files/modules:

- `docs/hosted-operational-release-gate.md`
- `docs/hosted-install-privacy.md`

Risks:

- building UI/admin before operational evidence would expand scope prematurely
- mobile work is not relevant to current CLI/GitHub/npm/Check Run product surface

## P3: Commercialization Later

Acceptance:

- do not add billing, paid plans, Stripe subscriptions, customer login, membership, pricing pages, marketplace conversion, or sales funnel
- only revisit after real usage/design-partner feedback exists

Files/modules:

- `docs/hosted-pricing-packaging.md`

Risks:

- user explicitly asked to stop before commercialization
- adding payment/account code creates security and support obligations too early
