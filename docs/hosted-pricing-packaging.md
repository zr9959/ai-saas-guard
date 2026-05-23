# Hosted Pricing And Packaging

This document defines what stays in the open-source local CLI and what may belong in a future hosted GitHub App layer. It exists to prevent paid packaging from weakening the core local-first product.

Core local scanning stays useful without an account. Hosted plans do not gate local CLI scanning.

`ai-saas-guard` is not a pentest, not a certification, and not a full security audit. Pricing and packaging must not imply otherwise.

## Product Boundary

The open-source CLI remains the core product surface:

- local repository scanning
- deterministic rules
- JSON output
- SARIF output
- PR-focused markdown output
- project-local config
- rule docs
- examples and fixtures
- composite GitHub Action
- local-first behavior with no network calls by default
- no account requirement

The hosted layer may add workflow convenience:

- check run summaries
- optional PR comments
- saved reports
- scan history
- team policy settings
- shared suppression review
- repository installation management
- optional human review coordination

The hosted layer should not become the only way to get useful scan results.

## Must Remain Open-Source And Local-First

These capabilities must remain available without a hosted account:

- `ai-saas-guard scan`
- `ai-saas-guard pr-risk`
- `ai-saas-guard check-supabase`
- `ai-saas-guard check-stripe`
- `ai-saas-guard check-mcp`
- local JSON, SARIF, and markdown output
- local `.ai-saas-guard.json` rule configuration
- local fail thresholds and suppressions
- public rule documentation
- GitHub Action usage from the public repository

Paid features may make team workflows easier, but they must not remove or cripple local scanning.

## Free/Public Repo Hosted Behavior

Free/public repo hosted behavior can include:

- selected-repository GitHub App installation
- signed webhook intake
- read-only deterministic scan
- one check run summary per pull request head SHA
- short retention for compact reports
- links back to local CLI usage
- public documentation for rule IDs and manual verification

Free/public repo hosted behavior should not include noisy default PR comments. Comments can be added later only through explicit repository policy opt-in.

## Private Repo Hosted Behavior

Private repo hosted behavior should be packaged as a team workflow layer, not as a replacement for local scanning.

Private repo hosted behavior can include:

- selected-repository installation
- check run summaries
- PR comments when repository policy opts in
- saved reports
- scan history
- team policy settings
- retention controls
- audit-friendly report exports
- support for repository removal and uninstall cleanup

Private repo hosted behavior must keep the same data minimization boundary: no raw source, no raw diffs, no secrets, and no customer payloads in compact report storage.

## PR Comments

PR comments are a hosted workflow convenience.

Default behavior:

- check run summary only
- no PR comments unless repository policy opts in
- one upserted comment per pull request when enabled
- comment content derived from deterministic findings, not broad claims

PR comments should say "review first" and "verify" rather than "secure" or "approved."

## Saved Reports

Saved reports are a hosted convenience for teams that need review history.

Saved reports may include:

- repository ID and name
- PR number
- base SHA and head SHA
- scanner version
- summary counts
- rule IDs
- evidence file paths and line numbers
- reviewer checklist
- suppression policy version
- scan state, attempt number, and error class

Saved reports must not include raw source, raw diffs, secrets, customer payloads, private URLs, or full file contents by default.

## Team Policy

Team policy features can be paid because they coordinate multiple reviewers and repositories.

Reasonable team policy features:

- default fail thresholds
- rule severity preferences
- path-specific suppression workflows
- stability label preferences
- comment opt-in policy
- retention policy controls
- saved report access control
- audit export settings

Repository `.ai-saas-guard.json` should remain visible, reviewable, and portable. Hosted policy should not hide important behavior outside the repository when local review needs it.

## Launch Review

Launch Review is an optional human review offer. It should be packaged separately from the scanner.

Boundaries:

- reviewers use scanner output, launch-readiness checklist evidence, and customer-provided context
- reviewers can identify launch blockers and recommended manual verification
- reviewers do not certify that an app is secure
- reviewers do not claim complete coverage
- reviewers do not replace the customer's own authorization, billing, privacy, or production readiness responsibilities

Launch Review can be useful, but it must stay framed as evidence-backed review support.

## Packaging Matrix

| Package | Audience | Included | Excluded |
| --- | --- | --- | --- |
| Open-source CLI | solo builders, reviewers, public users | local scans, deterministic rules, JSON/SARIF/markdown, config, docs, GitHub Action | hosted reports, team policy UI, human review |
| Free hosted public repos | public projects that want PR checks | selected install, check run summary, short compact retention | private repo support, PR comments by default, saved history dashboard |
| Team hosted | teams with private repos | check runs, optional PR comments, saved reports, team policy, retention controls | claims of certification, automatic approval, broad org installs by default |
| Launch Review | teams near launch | optional human review based on scanner evidence and checklist artifacts | pentest claims, certification claims, full security audit claims |

## Pricing Principles

- Charge for hosted convenience, not for access to the local scanner.
- Charge for private hosted workflow value, not for hiding core rules.
- Keep rule documentation public.
- Keep local outputs machine-readable and useful.
- Keep the hosted data-minimization promise consistent across free and paid plans.
- Keep paid language conservative and evidence-first.

## Messaging Rules

Allowed language:

- "review-first PR checks"
- "launch-readiness preflight"
- "saved scan history"
- "team policy settings"
- "optional human review"
- "not a full security audit"

Avoid language:

- "certified secure"
- "pentest replacement"
- "guaranteed safe"
- "complete vulnerability coverage"
- "automatic launch approval"

## Release Gate

Before adding any paid hosted feature, the release record must show:

- local CLI remains useful without an account
- hosted plans do not gate local CLI scanning
- pricing copy avoids pentest, certification, and full security audit claims
- data retention and uninstall behavior still match public docs
- README and npm README remain current
