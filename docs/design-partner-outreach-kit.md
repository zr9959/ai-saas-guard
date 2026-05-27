# Design Partner Outreach Kit

This kit is for pre-commercial feedback only. It is not a sales funnel, paid beta, marketplace conversion, or launch campaign.

Use issue [#93](https://github.com/zr9959/ai-saas-guard/issues/93) as the public-safe feedback intake. Do not ask participants to share source, raw diffs, PR text, logs, secrets, tokens, customer data, private URLs, or checkout paths.

## Who To Ask First

Prioritize people who can run the local CLI on a low-risk repo:

1. A solo founder building a Next.js, Supabase, Stripe, or Vercel SaaS.
2. A small team member who reviews GitHub PRs before launch.
3. A builder using MCP tools, AI-generated integrations, or AI-assisted SaaS boilerplates.
4. A maintainer of a public demo repo who explicitly opts in.

Do not count stars, likes, anonymous comments, page views, simulated scans, or internal assumptions as design-partner feedback.

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

## Short Public Post

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
