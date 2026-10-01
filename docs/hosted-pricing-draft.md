# Hosted Pricing Draft

> **DRAFT — not published, not final, no billing attached.**
>
> This is an internal pricing draft for the future hosted GitHub App layer. It is not a public price list, not a checkout page, and not an offer. There is **no billing integration, no payment provider, no invoicing flow, and no account creation** attached to this document. No money is being collected and no paid plan can be purchased today.
>
> Hosted status honesty: the hosted GitHub App is in **staging only** (private staging App `ai-saas-guard-hosted`, installed on `zr9959/ai-saas-guard`; signed webhook intake and compact Check Run smoke pass in staging). The hosted beta is **not open**. Nothing in this draft implies hosted is available now.
>
> The iron rule governs this draft: **core local scanning stays free forever and is never weakened by paid packaging.** Paid tiers charge for hosted workflow convenience only — never for access to the scanner, its rules, or its outputs. See [docs/hosted-pricing-packaging.md](hosted-pricing-packaging.md).
>
> Messaging is conservative and evidence-first throughout: no pentest claims, no certification claims, no audit promises, no "certified secure", no "guaranteed safe". `ai-saas-guard` is **not a pentest, not a certification, and not a full security audit.**

## Tier 1 — Free

**Who:** public repositories that want automated PR checks, and everyone who uses the local CLI.

**Includes:**

- Full local CLI, forever free, no account, no network calls by default: `scan`, `pr-risk`, `check-supabase`, `check-stripe`, `check-mcp`, `check-actions`, local JSON/SARIF/markdown output, project-local `.ai-saas-guard.json` config, fail thresholds, suppressions, rule docs, and the composite GitHub Action from the public repository.
- Hosted GitHub App for **public repositories**: selected-repository install, signed webhook intake, read-only deterministic scan, **one check-run summary per PR head SHA** (check-run-only), links back to local CLI usage, and public rule-ID docs.
- Short retention for compact hosted reports.

**Does not include:**

- PR comments (hosted never comments on PRs by default; comments require explicit repository policy opt-in, and that opt-in is a paid workflow feature — see Team).
- Private repository hosted support.
- Saved scan history / dashboard.
- Team policy settings.
- Human review.

**The free promise (iron rule, repeated for clarity):**

- Local scanning is free forever. No paid tier will gate, throttle, redact, or degrade any local CLI capability, rule, or output format.
- The hosted Free tier is additive convenience for public repos. Removing the paid tiers would still leave the full local scanner intact.

## Tier 2 — Team: $12–20 / developer / month

**Who:** teams with private repositories who want shared PR review workflow around the scanner.

**Includes:**

- Everything in Free.
- Hosted GitHub App for **private repositories** with selected-repository install.
- Check-run summaries on private PRs.
- **PR comments, opt-in only per repository policy** — one upserted comment per PR, derived from deterministic findings. Comment wording says "review first" and "verify", never "secure" or "approved".
- Saved reports (repository ID/name, PR number, base/head SHAs, scanner version, summary counts, rule IDs, evidence file paths and line numbers, reviewer checklist, suppression policy version — **no raw source, no raw diffs, no secrets, no customer payloads**).
- Scan history and audit-friendly report exports.
- Team policy settings: default fail thresholds, rule severity preferences, path-specific suppression workflows, comment opt-in policy, retention controls, saved-report access control.
- Retention controls and uninstall/uninstall-cleanup support per [docs/hosted-uninstall-data-deletion.md](hosted-uninstall-data-deletion.md).

**Does not include:**

- Any claim of certification, audit, or guaranteed coverage.
- Automatic approval of PRs (the scanner informs review; humans decide).
- Broad org installs by default (selected repositories only).
- Human review (see Launch Review).
- Weakening of the local CLI (the iron rule applies to every paid tier).

**Pricing logic:**

- The anchor is **AI PR review tools priced per seat**, not security products. Per-developer per-month pricing puts ai-saas-guard next to tools teams already buy to save reviewer time — roughly $12–20/dev/month is the familiar band for AI-assisted PR review.
- Deliberately **not** anchored to penetration testing or vulnerability-management products. "Not a pentest" is a positioning decision with a pricing consequence: this sells **time saved in review**, not fear or compliance coverage. Charging pentest-adjacent prices would imply pentest-adjacent promises the product cannot keep.
- The price scales with people who review (seats), not with scans or repositories, because the value is shared review context (history, policy, suppressions), not scan compute.
- Range, not a fixed number: $12–20/dev/month, to be narrowed after design-partner feedback on how much review time the scanner actually saves. If it doesn't save real reviewer time, the price must move down, not the free tier's capabilities.
- Free local CLI stays untouched regardless of where the paid number lands.

## Tier 3 — Launch Review: ~$500–2,000 per engagement

**Who:** teams near launch who want human eyes on the scanner's evidence plus a launch-readiness checklist before inviting users.

**Includes:**

- A human-delivered review engagement based on: scanner output (the customer's own scan artifacts), the launch-readiness checklist evidence, and customer-provided context.
- Launch blockers identified, recommended manual verification steps, fix directions.
- Bounded scope, agreed up front, delivered by a person — **this sells a review service, not software.**

**Does not include:**

- A pentest, certification, or full security audit — never claimed, never implied.
- Certification that an app is secure; complete coverage claims; automatic launch approval.
- Replacement of the customer's own responsibility for authorization, billing correctness, privacy, and production readiness.

**Pricing logic:**

- Priced like **consulting time**, not like software: roughly $500–2,000 per engagement depending on scope and depth. The spread is honest about the human labor involved — a fixed low price would be a lie about the effort, and a pentest-sized price would be a lie about the deliverable.
- Kept strictly separate from scanner packaging: buying a Launch Review never changes what the scanner can do, and the scanner never "requires" a Launch Review to be useful.
- Human-delivered: availability, scheduling, and scope negotiation are part of the offer. This tier does not scale by clicking a button, and the draft does not pretend it does.

## What Stays Free No Matter What (the iron rule, in checklist form)

- [ ] `scan`, `pr-risk`, `check-supabase`, `check-stripe`, `check-mcp`, `check-actions` — full capability, no account
- [ ] Local JSON, SARIF, and markdown output
- [ ] Project-local `.ai-saas-guard.json` config, fail thresholds, suppressions
- [ ] All rule documentation and the composite GitHub Action from the public repo
- [ ] No paid tier may remove, degrade, throttle, or redact any of the above
- [ ] Pricing copy may not imply pentest, certification, or full security audit claims
- [ ] Hosted data minimization (no raw source, diffs, secrets, payloads in stored reports) holds across free and paid

## Release gate (from docs/hosted-pricing-packaging.md)

Before any paid hosted feature is added, the release record must show local CLI remains useful without an account, hosted plans do not gate local scanning, pricing copy avoids pentest/certification/audit claims, retention and uninstall behavior still match public docs, and README plus npm README remain current. No billing exists today, so the release gate cannot yet be satisfied for any paid feature.
