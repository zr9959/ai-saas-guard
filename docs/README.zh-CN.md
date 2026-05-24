<h1 align="center">ai-saas-guard</h1>

<p align="center">
  <strong>你用 AI 把 SaaS 做出来了。现在要在用户发现之前，先找到上线风险。</strong>
</p>

<p align="center">
  面向 AI 构建的 Next.js、Supabase、Stripe、Vercel、GitHub Actions 和 MCP SaaS 的本地优先上线 gate。它聚焦 auth、billing、data access、secrets、MCP 和 deploy，把仓库里最容易出事的风险路径变成一份短 review 队列，让你在上线前或合并 PR 前知道该先看哪里。它本地运行、只读仓库、不上传代码。
</p>

<p align="center">
  它不是渗透测试，而是一份证据优先的 review 队列，帮你先看最容易出事的代码。
</p>

<p align="center">
  <a href="../README.md">English README</a> | 中文
</p>

<p align="center">
  <a href="https://github.com/zr9959/ai-saas-guard/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/zr9959/ai-saas-guard/actions/workflows/ci.yml/badge.svg"></a>
  <a href="https://www.bestpractices.dev/projects/12955"><img alt="OpenSSF Best Practices" src="https://www.bestpractices.dev/projects/12955/badge"></a>
  <a href="https://www.npmjs.com/package/ai-saas-guard"><img alt="npm" src="https://img.shields.io/npm/v/ai-saas-guard.svg"></a>
  <a href="../LICENSE"><img alt="License: MIT" src="https://img.shields.io/badge/license-MIT-blue.svg"></a>
  <a href="../package.json"><img alt="Node.js >=20" src="https://img.shields.io/badge/node-%3E%3D20-339933.svg"></a>
</p>

---

## 邀请真实用户前先看这里

AI 能很快把一个 SaaS 做到“看起来能用”：能登录、能打开 checkout、dashboard 能加载、测试也是绿的。真正危险的是信任边界代码，它决定谁有权限、谁付了钱、谁能看哪些数据，以及服务失败时会不会被悄悄伪装成成功。

这些问题通常会在真实用户来了以后才变痛：

- 一个用户能看到或修改另一个客户的数据
- Stripe webhook 因为未签名、重复、漏处理失败事件而错误开通权限
- Clerk 或 Prisma 代码把用户可改 metadata、未按租户约束的查询当成可信权限依据
- 真实服务失败后，AI 生成的代码仍然返回“成功”或 demo 数据
- secret 被 env 配置或 `NEXT_PUBLIC_*` 暴露出去
- MCP 工具、GitHub workflow 或 deploy job 拿到了过大的权限
- Next/Vercel 生产环境缺 env 文档、security headers、request ID 或成本风险提示
- AI 生成的大 PR 把 auth、billing、data、deploy 或测试改动藏在“普通改动”里

`ai-saas-guard` 是面向这个时刻的本地优先、review-first 上线预检工具。它不会证明你的应用绝对安全，也不是渗透测试、认证或完整安全审计。它的目标是给 founder、独立开发者、小团队和 reviewer 一份短而有证据的清单，告诉你上线或合并 PR 前最该先看哪里。

## 60 秒本地检查

不用 clone 仓库，先看公开 demo 输出：

```bash
npx ai-saas-guard@latest demo
```

无需全局安装，直接扫你的应用：

```bash
npx ai-saas-guard@latest scan --root /path/to/your-saas
```

如果是 AI 生成的大 PR：

```bash
npx ai-saas-guard@latest pr-risk --root /path/to/your-saas --base origin/main --markdown
```

你会得到 rule ID、severity、文件证据、为什么重要、如何人工验证，以及具体修复方向。扫描是 deterministic、只读的，不调用 LLM。

## 先试公开 demo

如果你还不想先扫自己的私有仓库，可以先跑公开 fixture：

```bash
npx ai-saas-guard@latest demo
```

demo 命令使用包内公开 fixture：`examples/demo-risky-saas` 当前会故意触发 19 个 finding，覆盖 Stripe、Supabase、silent-success、Next/Vercel deploy 提示和 GitHub Actions；`examples/demo-safe-saas` 在同类风险面上使用更安全的静态写法，当前返回 0 个 finding。想本地查看 fixture 文件时再看 [demo-quickstart.md](demo-quickstart.md)。

## 输出长什么样

报告是给上线前或合并 AI 大 PR 前快速阅读的。更完整的可复制样例见 [docs/sample-launch-report.md](sample-launch-report.md)。

```text
Launch Gate: review before launch
19 findings: 2 critical, 6 high, 7 medium, 3 low, 1 info

CRITICAL stripe.webhook.missing-signature
File: app/api/stripe/webhook/route.ts
Why: billing access can be granted from a webhook path that does not verify Stripe signatures.
Verify: replay a webhook with an invalid signature and confirm the route rejects it.
Fix: read the raw body, call stripe.webhooks.constructEvent, and make event handling idempotent.

HIGH silent-success.swallowed-error
File: app/api/billing/checkout/route.ts
Verify: force the upstream billing call to fail and confirm the route returns an error, not fake success.

MEDIUM deploy.next.missing-security-headers
File: app/api/billing/checkout/route.ts
Verify: inspect production response headers for auth, billing, and API pages.

Next steps
- 先修 critical/high 的信任边界 finding。
- 在 staging 跑 manual proof，确认每个风险路径都会 fail closed。
```

## 你会得到什么

一个命令会返回一份上线前 review 队列：

- terminal 和 Markdown 输出开头会先给出直观上线判断
- 先看高风险文件，再看 UI 或普通重构
- 每个 finding 都有 rule ID、severity 和文件证据
- 说明它为什么会影响 AI 构建的 SaaS 上线
- 给出可以人工复现的验证步骤
- 给出实际修复方向，不只是一句泛泛建议
- 支持 terminal、JSON、SARIF 和 PR markdown，方便本地或 CI 使用

## 它能帮你抓住哪些问题

| 上线问题 | ai-saas-guard 会检查什么 |
| --- | --- |
| 用户是否只能访问自己的数据？ | Supabase RLS、tenant/owner predicate、storage policy、API ownership 提示、双账号验证建议 |
| auth metadata 是否可信？ | Clerk unsafe metadata 是否被用于 role、plan、tenant membership 或 entitlement |
| 付费权限是否会正确开通和撤销？ | Stripe webhook 签名、raw body、幂等、entitlement 路径、失败/取消/更新/退款覆盖 |
| 集成失败时会不会明显失败？ | silent-success fallback、吞错、hardcoded success、production mock/demo data、跳过或占位测试 |
| 生产环境是否真的等于本地成功？ | Next/Vercel headers、env 文档、public env 盘点、image/request 放大风险、request ID logging、Vercel cron guard 提示 |
| 工具和 CI 权限是不是过大？ | MCP side-effect 分类、本地 policy/receipt 模板、GitHub Actions 权限、concurrency、checkout depth、Action pinning |
| reviewer 能不能看懂 AI PR？ | `pr-risk` 对 auth、billing、RLS、deploy、API、storage、测试、silent-success、缺 spec context 和大型 diff 排序 |

## 快速开始

无需全局安装，直接运行：

```bash
npx ai-saas-guard@latest demo
npx ai-saas-guard@latest scan --root /path/to/your-saas
```

运行专项检查：

```bash
npx ai-saas-guard@latest pr-risk --root /path/to/your-saas --base origin/main
npx ai-saas-guard@latest check-supabase --root /path/to/your-saas
npx ai-saas-guard@latest check-supabase --root /path/to/your-saas --doctor
npx ai-saas-guard@latest check-stripe --root /path/to/your-saas
npx ai-saas-guard@latest check-mcp --root /path/to/your-saas
npx ai-saas-guard@latest check-mcp --root /path/to/your-saas --policy-template
npx ai-saas-guard@latest check-actions --root /path/to/your-saas
```

机器可读输出：

```bash
npx ai-saas-guard@latest scan --root /path/to/your-saas --json
npx ai-saas-guard@latest scan --root /path/to/your-saas --sarif > ai-saas-guard.sarif
npx ai-saas-guard@latest pr-risk --root /path/to/your-saas --base origin/main --markdown > ai-saas-guard-pr.md
```

本地开发：

```bash
git clone https://github.com/zr9959/ai-saas-guard.git
cd ai-saas-guard
npm ci
npm run build
node dist/cli.js scan --root /path/to/your-saas
```

## 当前状态

这个仓库是公开 GitHub 仓库。

CLI 已发布到 npm：`ai-saas-guard@0.30.0`。GitHub Action 支持 `v0` 浮动标签，也支持固定版本标签，例如 `v0.30.0`。

| 模块 | 状态 |
| --- | --- |
| 公开 GitHub 仓库 | 已可用 |
| npm CLI | `ai-saas-guard@0.30.0` |
| GitHub Action | `zr9959/ai-saas-guard@v0` 或固定标签 `v0.30.0` |
| 输出格式 | Terminal、JSON、SARIF 和 PR markdown |
| 项目配置 | `.ai-saas-guard.json` 支持规则开关、severity 覆盖、suppressions 和 fail threshold |
| 隐私模型 | 本地优先、只读扫描、不调用 LLM、不上传代码 |
| 当前版本 | `0.30.0` 增加 `ai-saas-guard demo`、human-readable 报告里的 Next steps、更有针对性的 quickstart 反馈模板，并刷新首次试用文档 |
| Action 标签 | `v0.30.0`、`v0` |
| npm 发布 | GitHub Actions Trusted Publisher/OIDC，无需长期 npm token |
| 仓库可信度加固 | 严格 branch protection、Dependabot、CodeQL、fast-check fuzzing、signed release provenance assets、private vulnerability reporting、secret scanning 和 push protection |
| Cloudflare hosted ingress | 已部署到 `https://ai-saas-guard-hosted.zr9959.workers.dev`；签名 GitHub App webhook delivery 和 compact Check Run staging smoke 已通过 |
| Hosted GitHub App staging | 私有 App `ai-saas-guard-hosted`（`3834787`）已安装到 `zr9959/ai-saas-guard`；hosted operations evidence 见 [docs/hosted-operations-evidence.md](hosted-operations-evidence.md) |
| OpenSSF Best Practices | 已获得 passing badge，项目 `12955`；`.bestpractices.json` 继续作为保守证据记录 |

## 主要命令

| 命令 | 用途 |
| --- | --- |
| `scan` | 对 secrets、Stripe、Supabase、MCP、API routes、deploy config 做整体上线预检 |
| `pr-risk` | 分析当前 git diff 或指定 base branch diff，判断哪些文件和风险面应该先 review |
| `check-supabase` | 检查 migration 和 policy 文件里的 RLS、ownership、storage policy 风险；`--doctor` 输出静态 RLS 调试步骤和 SQL cookbook |
| `check-stripe` | 检查 webhook 签名、raw body、幂等、订阅生命周期和 entitlement 更新路径 |
| `check-mcp` | 检查 MCP 配置里的 secret、非 localhost 绑定、shell/db/filesystem 等副作用；`--policy-template` 输出本地 allow/deny policy 和 tool-call receipt 格式 |
| `check-actions` | 检查和 AI-built SaaS 上线有关的 GitHub Actions hygiene |

## 它会检查什么

| 风险面 | 例子 |
| --- | --- |
| Secrets 和 env | 类似密钥的字符串、危险的 `NEXT_PUBLIC_*` 暴露 |
| Stripe | webhook 缺失、未验证签名、raw body 签名风险、缺幂等、缺失败/取消/退款/更新处理 |
| Supabase | 敏感表没启用 RLS、policy 过宽、缺少 ownership filter、`WITH CHECK` 过弱、storage object policy 过宽 |
| Silent success | 捕获错误后返回假成功、敏感路径里的 hardcoded fallback、production 路径引入 mock/demo data、临时绕过 auth/webhook/ownership、跳过或占位测试 |
| API routes | 有 auth 但缺少明显 ownership guard、Clerk unsafe metadata、Prisma tenant-scope gap，敏感 mutation route 缺少 rate-limit 提示 |
| MCP | 明文 secret、非 localhost 绑定、过宽文件系统权限、shell 工具、raw SQL 工具、side-effect 分类、本地 policy/receipt 模板 |
| Next/Vercel deploy | Next static export 和 API route 冲突、Edge runtime 使用 Node-only API、security headers 缺失、server env 文档缺失、public env 盘点、image/request 放大风险、request ID logging 缺失、Vercel cron route guard 缺失 |
| GitHub Actions | workflow 权限过宽、PR workflow 缺 concurrency cancel、docs-only 改动跑全量 CI、secret/tool version 缺 fail-fast、`pr-risk` checkout 太浅、Action 未 pin SHA |
| PR risk | auth、billing、RLS、env、deploy、API、storage、silent-success、测试删除、缺 spec/context、大型混合 diff |

完整规则请看 [docs/rules.md](rules.md)。

## 仓库可信度加固

公开仓库的维护和发布控制见 [docs/repository-trust-hardening.md](repository-trust-hardening.md)。当前已经配置严格 branch protection、required CI checks、Dependabot npm/GitHub Actions 更新、CodeQL SAST、fast-check fuzz/property tests、基于 npm trusted publishing provenance 的 signed GitHub release assets、private vulnerability reporting、secret scanning 和 push protection。

最新 GitHub releases 会镜像 npm package tarball，并附带 `*.tgz.sigstore.json` 和 `*.tgz.intoto.jsonl` provenance assets。上传前会用 npm registry metadata 校验 tarball digest，并使用 npm provenance 作为来源。

当前 Scorecard 提升路线优先做真实控制，不做表面刷分：更严格的 review gate、可被检测到的 fuzzing、以及 OpenSSF Best Practices Badge 流程。仓库年龄、贡献者多样性、已 review 的 PR 历史这些分数只能随着真实维护逐步提升。

仓库现在已经获得 [OpenSSF Best Practices passing badge](https://www.bestpractices.dev/projects/12955)。[.bestpractices.json](../.bestpractices.json) 继续作为公开项目条目的保守证据记录。`dynamic_analysis_enable_assertions` 仍然谨慎标为 unmet，直到运行时断言覆盖面超过当前测试、property 和 fuzz assertions。

## PR 风险分流

`scan` 可以扫整个仓库，但这个项目更锋利的入口是 PR review。

AI 生成的 PR 经常把很多东西混在一起：

- UI 调整
- auth/session 改动
- database migration
- Stripe checkout 或 webhook 改动
- Supabase policy
- Vercel 配置
- 测试被删除或削弱

`pr-risk` 会输出：

- 最应该先 review 的文件
- PR 触碰到的敏感类别
- review-first checklist
- 建议拆分 PR 的方向
- 必要测试或人工验证步骤
- 当 base ref 或 shallow checkout 导致无法比较时，给出明确诊断

```bash
node dist/cli.js pr-risk --root /path/to/your-saas --base origin/main --json
node dist/cli.js pr-risk --root /path/to/your-saas --base origin/main --markdown
```

## 目标用户

这个工具主要面向：

- 用 AI 编程工具快速做 SaaS MVP 的 founder 或独立开发者
- 没有专职安全工程师的小团队
- 需要 review 大型 AI-generated PR 的 reviewer
- 给客户交付 SaaS 的开发者或 agency
- 希望在 CI 里加一道轻量上线预检的小团队

它的目标不是吓人，也不是制造大量噪音，而是帮你把 review 时间用在最值得看的地方。

## GitHub Action

可以在 GitHub Actions 里直接使用：

```yaml
name: ai-saas-guard

on:
  pull_request:

permissions:
  contents: read

jobs:
  preflight:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6.0.2
        with:
          fetch-depth: 0
      - uses: zr9959/ai-saas-guard@v0
        with:
          command: pr-risk
          root: ${{ github.workspace }}
          base: origin/main
          fail-on: high
          config: .ai-saas-guard.json
```

更多 GitHub Action 示例请看 [docs/github-action.md](github-action.md)。

GitHub Marketplace wrapper 决策见 [docs/github-marketplace-wrapper-decision.md](github-marketplace-wrapper-decision.md)。当前决策是继续保持单一产品仓库，暂不创建单独 listing wrapper。

## 项目配置

在仓库根目录添加 `.ai-saas-guard.json` 可以调整规则：

```json
{
  "failOn": "high",
  "rules": {
    "stripe.webhook.missing-signature": "off",
    "stripe.webhook.missing-idempotency": "critical",
    "deploy.env.example-missing": "info"
  },
  "suppressions": [
    {
      "ruleId": "stripe.webhook.missing-idempotency",
      "paths": ["app/api/stripe/webhook/route.ts"],
      "reason": "Temporary launch exception with duplicate-event coverage in integration tests."
    }
  ]
}
```

`rules` 可以关闭规则或覆盖 severity。`suppressions` 适合处理某个具体路径上的 false positive。`failOn` 用于设置 CI 失败阈值。

## 隐私模型

`ai-saas-guard` 设计上适合在私有本地仓库中运行。

- 本地运行
- 读取仓库文件和 git diff
- scan 命令无网络调用
- 不上传代码
- 不需要账号或登录
- 不修改被扫描仓库
- 对单文件和总扫描文本设置预算，降低极端仓库带来的内存占用风险
- 对类似 secret 的 evidence 做 redaction

## Hosted GitHub App 设计

当前仓库已经包含未来 Hosted GitHub App 的设计文档、纯契约测试、第一个真实 Cloudflare hosted ingress，以及 Node/container read-only checkout scan runner。私有 staging GitHub App `ai-saas-guard-hosted` 已安装到 `zr9959/ai-saas-guard`，Cloudflare 已配置所需的云端凭据绑定。Worker 代码已经能接收签名 webhook、写入 KV 队列、换取 scoped installation token、读取 GitHub PR file metadata、做 compact PR-risk classification，并发布有长度上限的 Check Run summary；当前端到端 GitHub App webhook delivery smoke 已通过，证据记录在 [docs/hosted-operations-evidence.md](hosted-operations-evidence.md)。Cloudflare ingress 本身仍不是完整 source checkout scan worker。

相关文档：

- [docs/github-app-design.md](github-app-design.md)
- [docs/github-app-deployment.md](github-app-deployment.md)
- [docs/hosted-first-service-slice.md](hosted-first-service-slice.md)
- [docs/hosted-deployment-model.md](hosted-deployment-model.md)
- [docs/hosted-service-runtime.md](hosted-service-runtime.md)
- [docs/hosted-production-adapters.md](hosted-production-adapters.md)
- [docs/hosted-node-container-app.md](hosted-node-container-app.md)
- [docs/hosted-staging-deployment.md](hosted-staging-deployment.md)
- [docs/hosted-staging-harness.md](hosted-staging-harness.md)
- [docs/hosted-operational-release-gate.md](hosted-operational-release-gate.md)
- [docs/hosted-uninstall-data-deletion.md](hosted-uninstall-data-deletion.md)
- [docs/hosted-pricing-packaging.md](hosted-pricing-packaging.md)
- [docs/hosted-preimplementation-contracts.md](hosted-preimplementation-contracts.md)

已经实现的 hosted 预实现纯契约包括：

- pull request webhook intake planner：先验签，再解析 payload、生成可信 identity、校验 selected-repository scope，并默认只走 check-run-only 输出
- durable scan queue planner：同一个 trusted scan key 的 queued/running/completed job 会复用，不重复排 worker，也不会把源码、diff、secret 或 PR 正文放进队列 payload
- worker read-only scan planner：只用 trusted identity 规划临时 worker checkout，要求 repository `contents: read`，固定运行 `ai-saas-guard pr-risk --json`，并忽略 PR 正文里的 repo 名、token scope 或命令
- hosted read-only checkout worker：`ai-saas-guard/hosted/worker` 导出 `createHostedReadOnlyCheckoutScanRunner`，从 trusted GitHub App identity 创建临时 checkout，只通过 git askpass 使用 runtime installation token，运行固定 `ai-saas-guard pr-risk --json`，把 CLI JSON 转成 compact findings，并在成功或失败后删除 checkout；不会返回源码、diff、secret、checkout path、PR 里写的命令或 installation token
- hosted service runtime：`ai-saas-guard/hosted/service` 导出 `createHostedServiceRuntime`，把签名 webhook intake、幂等 queue upsert、read-only worker 编排、compact report 存储、Check Run 发布 adapter 和 worker cleanup 串成可测试的服务核心；它本身不部署公开 hosted 环境
- GitHub App deployment planner：`ai-saas-guard/hosted/github-app` 导出 `planHostedGitHubAppDeployment`，生成 first slice 最小权限 manifest，并在 release gate、公开 HTTPS URL、container digest、secret 引用、原始 secret 输入、permission 或 event 不安全时阻止创建
- Hosted production adapter layer：`ai-saas-guard/hosted/production-adapters` 导出 `createHostedGitHubAppJwt`、`planHostedGitHubInstallationTokenRequest` 和 `planHostedProductionWorkerExecution`，用于 GitHub App RS256 JWT、selected-repository installation token 请求规划、worker/check-run 分离 token scope、固定只读 worker 命令、timeout/output 预算、compact JSON-only 输出，以及 success/failure/timeout/cancellation 的 cleanup 规划；它本身仍然不部署公开 hosted 服务
- Hosted Node/container app skeleton：`ai-saas-guard/hosted/app` 导出 `createHostedHttpApp`、`createInMemoryHostedAppPlatform`、`createHostedNodeCheckoutAppPlatform` 和 `planHostedNodeContainerDeployment`，提供安全 `/healthz`、签名 `/github/webhook` ingress、单 job worker tick、测试用 in-memory provider adapters、真实 read-only checkout worker 组合入口、可见 timeout/output 安全预算，以及 secret manager、queue、compact report store、worker sandbox、GitHub Checks publisher 的部署引用校验；它本身仍然不部署或暴露公开 hosted 服务
- Hosted staging deployment planner：`ai-saas-guard/hosted/staging` 导出 `planHostedProviderBinding`、`planHostedStagingDeployment` 和 `planHostedGitHubAppPromotion`，把真实 provider 引用、Node/container deployment plan、hosted operational release-gate evidence 和 GitHub App deployment planning 组合起来；缺少 queue、store、worker sandbox、Check Run publisher、logs、metrics、rollback 或 incident-response 引用时，会阻止 staging exposure 和 production promotion；它本身仍然不会调用云平台、创建 GitHub App 或暴露公开 hosted 服务
- Hosted staging harness：`ai-saas-guard/hosted/staging-harness` 导出 `createFileBackedHostedStagingHarness` 和 `createHostedStagingHarnessEvidence`，可以在本地用 file-backed queue、compact report、Check Run request 和 worker sandbox 跑通签名 webhook replay、worker tick 和 cleanup 校验；它只是 staging 演练工具，不会调用云平台、创建 GitHub App、写真实 Check Run 或暴露公开 hosted 服务
- Cloudflare hosted ingress：`hosted/cloudflare-worker` 已部署到 `https://ai-saas-guard-hosted.zr9959.workers.dev`，提供 `/healthz`、`/github/app/manifest-callback` 和签名 `/github/webhook` intake；Worker 已具备 compact pull request identity、file/category risk signal 和 Check Run metadata 路径；staging GitHub App ID 为 `3834787`，installation ID 为 `135085075`；真实 GitHub App webhook delivery 和 Check Run smoke 已通过；完整 source checkout worker deployment、monitoring、rollback 和 incident-response evidence 仍需要通过 hosted operational release gate
- webhook event parser
- check-run summary renderer
- Check Run publication planner：要求 repository `checks: write`，只从 compact report 生成有长度上限的 Check Run payload，包含 review categories、优先 review 文件、verification steps 和本地 CLI 复现命令；MVP 不发 PR comment
- queue cleanup planner
- worker checkout cleanup planner
- retention/deletion cleanup planner：把 compact report 删除、按仓库或 installation 范围取消队列和 running job、worker checkout 删除、retention 过期清理、最小审计记录合成一个安全计划；不会输出源码、diff、secret、customer payload、private URL、checkout path 或底层 cleanup error
- operational release gate evaluator：检查 hosted 暴露前是否具备 fresh CI、webhook replay、workflow static check、dependency/container scan、cleanup、privacy、monitoring、rollback、incident response 和 release cleanup 证据；缺任何 P0 证据都会阻止 hosted exposure
- hosted compact report fixture：[examples/hosted-compact-report.json](../examples/hosted-compact-report.json)

这些 helper 不会暴露公开服务、不会直接调用 GitHub API、不会持久化 installation token、不会真实写 check run、不会发 PR comment，也不会上传源码。

## 它不是什么

这个项目刻意避免过度安全承诺。

- 不是渗透测试
- 不是完整 SAST 平台
- 不能证明你的应用绝对安全
- 不能替代两账号权限测试
- 不执行 Stripe、Supabase、Vercel 或浏览器流程
- 不检查没有体现在本地文件里的生产设置
- 不替代 Semgrep、Gitleaks、TruffleHog、Bearer、CodeQL 或人工 review

正确使用方式是：把它当成上线前和 PR review 前的 preflight，帮助你决定应该先把人工注意力放在哪里。

## 开发

```bash
npm ci
npm test
npm run build
node dist/cli.js scan --root .
```

发布 CLI、GitHub Action、npm package 或任何公开仓库更新前，必须按照 [docs/release-quality-knowledge-base.md](release-quality-knowledge-base.md) 的 release gate 执行。

以后更新英文 `README.md` 时，也要同步检查并更新本中文 `docs/README.zh-CN.md`。

贡献要求见 [CONTRIBUTING.md](../CONTRIBUTING.md)，里面说明了 PR 流程、测试要求、规则设计、release gate evidence 和公开安全边界。

## 安全报告

报告漏洞前请阅读 [SECURITY.md](../SECURITY.md)。不要在公开 issue 中发布真实 API key、客户数据、私有源码或生产 URL。
