# Hosted Support And Incident Ownership

This document records the human support and incident ownership boundary for the hosted staging path. It is public-safe evidence for support routing and incident responsibility. It does not make public beta ready by itself.

Use this with:

- [hosted-operator-runbook.md](hosted-operator-runbook.md)
- [hosted-operations-evidence.md](hosted-operations-evidence.md)
- [public-beta-evidence-feedback.md](public-beta-evidence-feedback.md)
- GitHub issue [#94](https://github.com/zr9959/ai-saas-guard/issues/94)

## Ownership

| Role | Owner | Scope | Public-safe evidence |
| --- | --- | --- | --- |
| Primary incident owner | `@zr9959` | Hosted staging Worker, GitHub App selected-repository install, compact KV records, and public docs | CODEOWNERS, repository ownership, issue #94 |
| Support triage owner | `@zr9959` | Install failures, false positives, false negatives, Check Run confusion, deletion requests, and public-safe bug reports | GitHub issue templates and issue triage |
| Security-sensitive report owner | `@zr9959` | Reports that cannot be safely posted in public issues | GitHub private vulnerability reporting |
| Backup coverage before public beta | Pause-hosted fallback | If no independent backup human is available, hosted beta must stay paused or closed rather than rely on unattended operations | This document and issue #94 |

Do not treat the fallback row as a staffed second operator. It is a safety policy: if the primary owner is unavailable and no independent backup has been assigned, new hosted exposure should pause.

## Support Channels

Use GitHub issues for public-safe support:

- bug reports
- false positives
- false negatives
- quickstart feedback
- hosted support requests
- rule requests
- security-safe reports

Use GitHub private vulnerability reporting for anything that requires sensitive details.

Do not ask users to post source files, raw diffs, PR title/body/comments, secrets, tokens, cookies, certificates, database URLs, customer payloads, private URLs, checkout paths, installation tokens, or raw provider logs.

## Response Expectations

| Request type | First response expectation | First action |
| --- | --- | --- |
| Hosted install failure | 2 business days during staging | Confirm scanner version, path used, repository category, and sanitized error class |
| False positive | 5 business days during staging | Ask for rule ID, severity, and minimal public-safe reproduction |
| False negative | 5 business days during staging | Ask for risk area, why it matters, and minimal public-safe pattern |
| Deletion request | 2 business days during staging | Confirm selected repository or installation scope before any compact-record deletion |
| Security-sensitive report | 2 business days during staging | Move to private vulnerability reporting and keep public issue free of sensitive details |
| Incident trigger | Same day when actively operating hosted staging | Pause or rollback hosted processing before collecting detailed evidence |

These expectations are staging expectations, not a paid SLA.

## Incident Triggers

Open or update an incident record when any of these occur:

- privacy flag unexpectedly changes
- webhook rejection or 5xx rate spikes
- Worker failure or timeout rate spikes
- Check Run write failures spike
- compact-record cleanup fails
- retention expiry fails
- rollback fails
- credential rotation fails
- deletion request cannot be completed safely

Minimum public-safe incident fields:

- incident ID
- owner
- environment
- scanner version
- safe impact summary
- first mitigation
- rollback or pause decision
- support/status path
- privacy review result
- follow-up owner and due date

## Pause And Escalation Policy

Before public beta, if primary ownership is unavailable or a safe support path cannot be staffed:

1. Do not add new selected repositories.
2. Pause hosted exposure or keep hosted beta closed.
3. Prefer local CLI and GitHub Action usage, which do not require hosted support.
4. Record the blocked state in issue #94.

This keeps hosted exposure from depending on unstaffed support.
