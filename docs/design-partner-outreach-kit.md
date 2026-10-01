# Design Partner Outreach Kit

This kit is for pre-commercial feedback only. It is not a sales funnel, paid beta, marketplace conversion, or launch campaign.

It is not a pentest, certification, full security audit, or AI reviewer. Say that in every draft you send.

## One-Pager

**The problem.** AI writes most of the PR now. One PR mixes auth/session changes, billing webhook edits, RLS policy tweaks, and deploy config, and nobody dares to merge it — or worse, somebody merges it without reading it. Founders review everything by hand because nothing ranks what actually needs human eyes before users arrive.

**The wedge.** `ai-saas-guard` is a deterministic, local-first PR risk triage review queue. No LLM calls, no code upload — source never leaves the machine. It turns the PR into a short, founder-readable queue: severity, rule ID, file evidence, why it matters, what manual proof to run, and a fix direction. The point is to say "review this file first" before launch, not "this is secure".

**Current evidence.**

- npm `ai-saas-guard@0.43.3` (Trusted Publisher/OIDC), 66 deterministic rules with public docs
- Composite GitHub Action (`zr9959/ai-saas-guard@v0`)
- OpenSSF Best Practices passing badge
- Local CLI: `scan`, `pr-risk`, `check-supabase`, `check-stripe`, `check-mcp`, `check-actions`; JSON, SARIF, and PR-focused markdown output
- Hosted GitHub App is in **staging only**; beta is **not open**. Design partners test the local CLI path — no hosted install, no account, no code upload needed

**The ask.** Three design-partner contexts, one per context:

- **DP-1 — solo founder**: shipping an AI-assisted SaaS MVP, personally reads every PR, has real merge decisions that findings could change.
- **DP-2 — small-team PR review**: a small team using GitHub PR review or CI before launch; wants shared review context across reviewers.
- **DP-3 — MCP/AI integration builder**: builds with MCP tools, AI-generated integrations, or AI-assisted SaaS boilerplates; cares about tool power, deploy, and Actions hygiene.

The ask is one local session (~10 minutes), feedback in [issue #93](https://github.com/zr9959/ai-saas-guard/issues/93), no source or secrets shared — ever.

Use issue [#93](https://github.com/zr9959/ai-saas-guard/issues/93) as the public-safe feedback intake. Do not ask participants to share source, raw diffs, PR text, logs, secrets, tokens, customer data, private URLs, or checkout paths.

## Who To Ask First

Prioritize people who can run the local CLI on a low-risk repo:

1. A solo founder building a Next.js, Supabase, Stripe, or Vercel SaaS.
2. A small team member who reviews GitHub PRs before launch.
3. A builder using MCP tools, AI-generated integrations, or AI-assisted SaaS boilerplates.
4. A maintainer of a public demo repo who explicitly opts in.

Do not count stars, likes, anonymous comments, page views, simulated scans, or internal assumptions as design-partner feedback.

## Demo Trial Instructions

How a design partner runs the local CLI. No install, no account, no code upload, nothing leaves their machine.

```bash
npx --yes ai-saas-guard@latest demo --summary
npx --yes ai-saas-guard@latest scan --root /path/to/your-low-risk-demo-repo --summary
```

Focused checks (same privacy guarantees — local, read-only, no LLM calls):

```bash
npx --yes ai-saas-guard@latest pr-risk --root /path/to/your-low-risk-demo-repo --base origin/main
npx --yes ai-saas-guard@latest check-supabase --root /path/to/your-low-risk-demo-repo
npx --yes ai-saas-guard@latest check-stripe --root /path/to/your-low-risk-demo-repo
npx --yes ai-saas-guard@latest check-mcp --root /path/to/your-low-risk-demo-repo
```

If they don't have a low-risk repo handy, `demo` alone is enough — it scans the built-in synthetic fixture.

What sanitized feedback to submit (to issue #93). Allowed — and nothing else:

- scanner version (or `ai-saas-guard@latest` + the date run)
- DP category: DP-1, DP-2, or DP-3
- stack category (e.g. "Next.js + Supabase + Stripe", "MCP server in TypeScript")
- severity counts and rule IDs only (e.g. "2 high: stripe.webhook.missing-idempotency")
- subjective impressions: what felt useful, confusing, noisy, missing; possible false positives or false negatives, by rule ID
- whether the report would change a launch or merge decision

Never allowed: source code, raw diffs, PR text, logs, secrets, tokens, customer data, private URLs, checkout paths, names, emails.

## Target Persona Standards

A qualified design partner meets all of these:

1. Builds an **AI-written SaaS** — typically Next.js + Supabase + Stripe, on Vercel or similar.
2. The **founder personally reads PRs** and is the person who decides merge/launch.
3. Has **real merge decisions that findings could change** — not toy repos, not "would be nice to try someday".

Disqualify for this round: pure curiosity ("cool tool, I'll star it"), teams that outsource review to someone not in the loop, or anyone unwilling to keep feedback sanitized per the boundary above.

## One-Session Trial Pack

Use this path for the first session. It keeps the participant's code local and avoids hosted installation unless they explicitly want to test that path.

```bash
npx --yes ai-saas-guard@latest demo --summary
npx --yes ai-saas-guard@latest scan --root <your-low-risk-demo-repo> --summary
```

Ask the participant to share only:

- package version used, or `ai-saas-guard@latest` plus the date
- target label: DP-1, DP-2, or DP-3
- path used: local CLI, GitHub Action, or hosted Check Run
- stack category and public-safe repository category
- severity counts and rule IDs only
- confusing, noisy, missing, false-positive, or possible false-negative categories by rule ID
- whether the output would change a launch or merge decision
- privacy or support confusion

Do not ask for source, diffs, PR text, raw logs, secrets, customer data, private URLs, checkout paths, names, emails, meeting links, or installation tokens in public feedback.

## Invitation Drafts (drafts only — do not send)

The three draft sets: **Email** (below), **Twitter/X DM short** (below), and the **technical community post** ("Longer Community Post" further down). The older "Short Public Post", "Warm DM", and "Chinese Warm DM" drafts remain as reusable variants.

### Email Draft

```text
Subject: 10 minutes of your time on a local-first PR risk checker?

Hi {name},

I'm collecting pre-commercial design-partner feedback on ai-saas-guard — a local-first CLI that turns AI-generated PRs into a short launch-risk review queue (auth/session, Stripe webhooks, Supabase RLS, secrets, GitHub Actions, MCP config, silent-success paths).

Why this might be relevant to you: you're shipping an AI-assisted SaaS and personally read PRs before merge. The question I'm testing is narrow — does a deterministic, no-LLM, no-code-upload review queue actually change what you merge or launch?

It is not a pentest, certification, full audit, or AI reviewer.

Safest 10-minute test (nothing leaves your machine):

npx --yes ai-saas-guard@latest demo --summary
npx --yes ai-saas-guard@latest scan --root <your-low-risk-demo-repo> --summary

Please don't send source, diffs, secrets, logs, or PR text. I'd only want: version, stack category, severity counts + rule IDs, what felt useful/confusing/noisy/missing, and whether it would change a merge decision.

Public-safe feedback goes here:
https://github.com/zr9959/ai-saas-guard/issues/93

Repo:
https://github.com/zr9959/ai-saas-guard

Thanks either way,
{name}
```

### Twitter/X DM (Short)

```text
I'm looking for 3 design partners for ai-saas-guard — a local-first launch-risk checker for AI-built SaaS apps (auth/session, Stripe webhooks, Supabase RLS, secrets, Actions, MCP). Deterministic, no LLM calls, no code upload. Not a pentest/audit/AI reviewer.

10-min test, nothing leaves your machine:

npx --yes ai-saas-guard@latest demo --summary

Would you run it on a low-risk repo and tell me version + severity counts + rule IDs + whether it'd change a merge decision? No source/diffs/secrets needed.

Feedback issue: https://github.com/zr9959/ai-saas-guard/issues/93
```

### Short Public Post

```text
Looking for 3 design partners to test ai-saas-guard, a local-first launch-risk checker for AI-built SaaS apps.

It checks for launch blockers around auth/session, Stripe webhooks, Supabase RLS, secrets, GitHub Actions, MCP config, and silent-success failure paths.

This is not a pentest, certification, full audit, or generic AI reviewer. I am looking for feedback on whether the findings are useful, confusing, noisy, or missing something important.

Safest test:

npx --yes ai-saas-guard@latest demo --summary
npx --yes ai-saas-guard@latest scan --root <your-low-risk-demo-repo> --summary

Please do not share source, diffs, secrets, PR text, customer data, private URLs, or logs. Public-safe feedback can go here:
https://github.com/zr9959/ai-saas-guard/issues/93
```

## Longer Community Post

```text
I am collecting pre-commercial design-partner feedback for ai-saas-guard:
https://github.com/zr9959/ai-saas-guard

It is a local-first CLI for AI-built SaaS apps. It checks common launch blockers around auth/session, Stripe webhooks, Supabase RLS, leaked secrets, GitHub Actions, MCP config, deploy hygiene, and silent-success failure paths.

It is not a pentest, certification, full audit, or generic AI reviewer. The goal is narrower: help a founder or reviewer decide what must be manually proven before inviting users or merging risky PRs.

I am looking for 3 real feedback contexts:

- DP-1: solo founder shipping an AI-assisted SaaS MVP
- DP-2: small team using GitHub PR review or CI before launch
- DP-3: builder using MCP tools or AI-generated integrations

Safest test:

npx --yes ai-saas-guard@latest demo --summary
npx --yes ai-saas-guard@latest scan --root <your-low-risk-demo-repo> --summary

Please do not share source code, raw diffs, PR text, logs, secrets, tokens, customer data, private URLs, or checkout paths.

Useful feedback:

- scanner version
- path used: local CLI, GitHub Action, or hosted Check Run
- stack category
- severity counts and rule IDs only
- what felt useful, confusing, noisy, or missing
- false positives or possible false negatives by rule ID
- whether anything would change a launch or merge decision

Public-safe feedback issue:
https://github.com/zr9959/ai-saas-guard/issues/93
```

## Warm DM

```text
I am looking for 3 design partners for ai-saas-guard, a local-first launch-risk checker for AI-built SaaS apps.

Would you be willing to run one local command on a low-risk demo repo or review the demo output? It should take about 10 minutes.

npx --yes ai-saas-guard@latest demo --summary
npx --yes ai-saas-guard@latest scan --root <your-low-risk-demo-repo> --summary

Please do not send source, diffs, secrets, logs, private URLs, customer data, or PR text. I only need version, stack category, severity counts, rule IDs, what was confusing/noisy/missing, and whether anything would change a launch or merge decision.

Repo:
https://github.com/zr9959/ai-saas-guard

Feedback issue:
https://github.com/zr9959/ai-saas-guard/issues/93
```

## Chinese Warm DM

```text
我在找 3 个真实设计伙伴，帮忙试一下 ai-saas-guard。它是一个 local-first 的 AI SaaS 上线风险检查 CLI，主要看 auth/session、Stripe webhook、Supabase RLS、secrets、GitHub Actions、MCP config、silent-success 这些上线前容易漏掉的问题。

它不是渗透测试、认证、完整审计，也不是 AI reviewer。目标很窄：帮 founder 或 reviewer 判断哪些地方上线/合并前必须人工证明。

如果你愿意，可以只在低风险 demo repo 上跑：

npx --yes ai-saas-guard@latest demo --summary
npx --yes ai-saas-guard@latest scan --root <your-low-risk-demo-repo> --summary

请不要发源码、diff、secret、日志、私有 URL、客户数据或 PR 文本。我只需要版本、技术栈类别、severity 数量、rule ID、哪里困惑/噪音/漏报，以及它会不会改变你的上线或 merge 决策。

反馈入口：
https://github.com/zr9959/ai-saas-guard/issues/93
```

## Platform Notes

Use only channels where feedback requests are allowed.

- GitHub: use issue `#93`; this is already public-safe.
- Indie Hackers: use a feedback or roast-style thread when logged in; avoid promotional launch wording.
- Hacker News: use `Ask HN` only if the account can post and the title is framed as a feedback request, not a product launch.
- Vercel Community: post only after login and category/rules review; ask for local CLI/docs feedback, not private source access.
- Supabase community: post only in a relevant community channel after reading channel rules; ask for RLS/auth launch-risk feedback only.
- Reddit: do not use for this task unless the user explicitly re-authorizes and a community's rules allow the exact post format.

## Posting Checklist

Before posting:

- confirm the platform permits feedback requests
- remove sales language, pricing, paid beta, marketplace, and funnel wording
- use `npx --yes ai-saas-guard@latest demo --summary` as the safest first action
- link to issue `#93`
- state the privacy boundary plainly
- avoid claims of pentest, certification, full audit, security guarantee, or AI reviewer replacement

After posting:

- save only public post URL, date, platform, and safe summary
- do not store participant names or contact details in the public repository
- record real feedback only after someone runs or reviews one workflow
