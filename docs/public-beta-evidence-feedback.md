# Public Beta Evidence And Feedback Intake

This document turns the post-`v0.43.0` next step into a concrete, privacy-safe intake process. It does not make hosted beta ready by itself. Hosted beta remains blocked until the evidence below is collected from real users, design partners, and deployed provider artifacts.

Use this document together with:

- [hosted-operational-release-gate.md](hosted-operational-release-gate.md)
- [hosted-operations-evidence.md](hosted-operations-evidence.md)
- [hosted-install-privacy.md](hosted-install-privacy.md)
- [hosted-support-incident-ownership.md](hosted-support-incident-ownership.md)

## Current Status

Status: not collected.

The current release has source-level gates and staging Cloudflare hosted ingress evidence. It still does not have:

- deployed full source-checkout worker evidence
- provider monitoring evidence
- rollback and incident-response drill evidence
- external user or design-partner feedback
- public beta support process evidence

Do not use this document to claim production hosted readiness, pentest coverage, certification, full audit coverage, or commercial readiness.

## Non-Goals

Do not use this phase to build or validate:

- billing
- pricing pages
- paid plans
- paid hosted packaging
- marketplace conversion
- sales funnels
- customer account systems
- broad analytics or tracking

Commercialization remains blocked until real usage feedback shows the product value and support burden clearly enough to justify that work.

## Privacy Boundary

Feedback and evidence records may include:

- scanner version
- public package version or commit SHA
- command or hosted path used, such as local CLI, GitHub Action, or hosted Check Run
- stack category, such as Next.js, Supabase, Stripe, Vercel, GitHub Actions, or MCP
- public-safe repository category, such as public demo, private SaaS MVP, or internal team repo
- rule IDs, severity, summary counts, and false-positive or false-negative category
- installation friction, documentation confusion, support need, and Check Run readability notes
- provider metric names, alert names, safe counts, timestamps, and rollback result summaries

Feedback and evidence records must not include:

- source files
- raw diffs
- PR title, body, comments, or untrusted prose
- secrets, tokens, private keys, cookies, certificates, or database URLs
- installation tokens
- webhook payload bodies
- customer payloads
- checkout paths
- private repository URLs unless the user explicitly approves a sanitized reference
- raw logs that could contain source, diffs, secrets, private URLs, or customer data

If a participant sends sensitive material, do not copy it into this repository. Ask for a sanitized reproduction using rule IDs, file categories, summary counts, and minimal inert snippets only when needed.

## Design-Partner Target Set

Collect feedback from at least three independent design-partner contexts before opening public beta.

| Target | Profile | Why this target matters | Safe evidence to collect |
| --- | --- | --- | --- |
| DP-1 | Solo founder shipping an AI-assisted SaaS MVP with Next.js, Supabase, Stripe, and Vercel | Tests whether the local CLI and launch-risk language match the core founder use case | First scan path, install friction, top confusing findings, false positives by rule ID, missing launch risks |
| DP-2 | Small team using GitHub PR review and CI before launch | Tests whether Check Run output is reviewable by more than one person | Hosted or Action setup friction, reviewer checklist usefulness, required-status-check fit, suppression audit concerns |
| DP-3 | Builder or maintainer experimenting with MCP tools or AI-generated integrations | Tests whether MCP and AI-code risk language is concrete without becoming a generic AI reviewer | MCP config risks found, manual verification clarity, privacy concerns, missing trust-boundary categories |

Store private participant names, email addresses, private repository names, and meeting links only in local private notes or the user's CRM, not in the public repository. Public repo summaries should use the target labels above unless the participant explicitly approves attribution.

## Feedback Session Script

Use the same narrow script for each participant so feedback is comparable.

1. Confirm the participant understands that `ai-saas-guard` is not a pentest, certification, full audit, or general AI reviewer.
2. Ask them to choose the least sensitive path that still reflects their workflow: local CLI first, GitHub Action second, hosted selected-repository Check Run only if they are comfortable with the hosted privacy boundary.
3. Ask them to run one representative scan or review one hosted Check Run.
4. Record only safe metadata and summarized feedback.
5. Ask whether any finding would change a launch or merge decision.
6. Ask what felt noisy, missing, confusing, or hard to trust.
7. Ask whether the privacy wording was clear enough before they ran the tool.
8. Ask whether the output should block CI, summarize risk, or stay advisory for their workflow.

Do not ask participants to share source, raw diffs, raw logs, PR text, credentials, or customer data.

## Feedback Record Template

Use one sanitized record per participant context:

```markdown
## Design Partner Feedback

- Date:
- Recorder:
- Target label: DP-1 | DP-2 | DP-3
- Public attribution approved: yes | no
- Scanner version:
- Path used: local CLI | GitHub Action | hosted Check Run
- Stack categories:
- Repository category: public demo | private MVP | internal team repo | other sanitized category
- Findings summary: count by severity, notable rule IDs only
- Installation friction:
- First-scan friction:
- Check Run or report readability:
- False positives by rule ID:
- Possible false negatives or missing launch risks:
- Privacy concerns:
- Would this change launch or merge behavior:
- Support follow-up needed:
- Public-beta blocker: yes | no
- Notes safe for public repo:
```

Before committing a summary, re-check that it contains no source, raw diffs, PR prose, secrets, customer payloads, private URLs, checkout paths, or personal contact details.

## Provider Evidence Matrix

Collect provider evidence from the deployed artifact before opening public beta. Evidence can be a dashboard screenshot, provider export, issue link, or operator note, but public repository records must stay sanitized.

| Evidence area | Required proof | Safe fields | Blocks beta when missing |
| --- | --- | --- | --- |
| Ingress errors | Alert exists for webhook rejection spikes and unexpected 5xx responses | alert name, threshold, owner, last test timestamp, result | yes |
| Queue depth | Queue depth and dead-letter growth are observable | metric name, threshold, sample count, owner, response expectation | yes |
| Worker failures | Worker failure rate and timeout rate are observable | metric name, threshold, latest sample window, safe error class counts | yes |
| Check Run failures | Check Run write failures are observable and owned | alert name, failure count, GitHub API safe status class, owner | yes |
| Cleanup failures | Checkout, scratch file, and compact record cleanup failures create operator-review events | metric or event name, cleanup status counts, owner | yes |
| Retention failures | Compact record deletion or expiry failures are observable | retention job name, failure count, latest safe run timestamp | yes |
| Rollback | Manual rollback was tested against the deployed artifact | previous artifact reference, pause/resume summary, result, affected Check Run identification method | yes |
| Incident response | Owner, backup or pause fallback, queue pause, worker pause, credential rotation, status path, and customer communication path are documented | owner roles, runbook reference, drill timestamp, result | yes |
| Uninstall deletion | Repository removal and app uninstall cleanup were verified against deployed provider stores | sanitized repository ID or test label, compact record count before/after, result | yes |
| Public support | A support path exists for install failure, false positives, false negatives, Check Run confusion, and deletion requests | support channel, response owner, first response expectation | yes |

Do not attach raw provider logs unless they have been reviewed for the privacy boundary in this document.

## Provider Evidence Record Template

Use this template when adding evidence to [hosted-operations-evidence.md](hosted-operations-evidence.md) or a private operator note:

```markdown
## Public Beta Provider Evidence

- Date:
- Commit:
- Scanner version:
- Deployed artifact:
- Environment: staging | limited beta
- Evidence area:
- Provider source: sanitized dashboard/export/runbook reference
- Safe summary:
- Privacy review: no source, diffs, PR prose, secrets, customer payloads, private URLs, checkout paths, or installation tokens
- Result: passed | failed | blocked
- Follow-up owner:
- Follow-up due:
```

## Public Beta Decision Rule

Public beta remains blocked when any of these are true:

- fewer than three design-partner contexts have been reviewed
- any design partner reports a launch-risk false negative that cannot be triaged safely
- hosted install or privacy wording is unclear to a participant
- provider monitoring evidence is missing for ingress, queue, worker, Check Run, cleanup, or retention failures
- rollback has not been tested against the deployed artifact
- incident owner, backup or pause fallback, support path, or deletion workflow is missing
- any evidence path requires storing source, raw diffs, PR prose, secrets, customer payloads, private URLs, checkout paths, or installation tokens
- product wording drifts into pentest, full audit, certification, or generic AI reviewer claims
- billing, pricing, paid packaging, or sales funnel work becomes a dependency for the beta decision

Team workflow rollout remains blocked until the Phase 5 team launch gate also has evidence for org policy configuration, required-status-check documentation, suppression audit, reviewer checklist, release evidence export, team docs, admin-bypass documentation, retention documentation, and proof that billing remains disabled.

## Where To Record Results

Use public docs only for sanitized summaries:

- provider evidence: [hosted-operations-evidence.md](hosted-operations-evidence.md)
- public install wording changes: [hosted-install-privacy.md](hosted-install-privacy.md)
- release-gate changes: [hosted-operational-release-gate.md](hosted-operational-release-gate.md)
- false-positive or false-negative rule follow-up: GitHub issues using the public-safe templates

Use local private notes for:

- participant names
- private repository names
- contact information
- meeting links
- private scheduling details

Do not commit local private notes.

## Task Cleanup

Every evidence-collection task must end with:

- temporary evidence files removed from `/tmp` unless intentionally retained outside the repo
- smoke PRs closed
- smoke branches deleted locally and remotely
- staging KV smoke records cleaned when a smoke test is run
- package tarballs and scratch SARIF/JSON removed
- no long-running test, worker, queue, watcher, or dev-server process left running
- `git status --short --branch` reviewed before handoff
