<h1 align="center">ai-saas-guard</h1>

<p align="center">
  <strong>你用 AI 把 SaaS 做出来了。现在要知道上线前哪里最容易出事。</strong>
</p>

<p align="center">
  ai-saas-guard 会优先指出 auth、billing、data access、secrets、MCP 和 deploy 里最值得人工 review 的改动。它本地运行、只读仓库、不上传代码。
</p>

<p align="center">
  它不是渗透测试，而是一份面向上线风险点的实用 review 清单。
</p>

<p align="center">
  <a href="README.md">English README</a> | 中文
</p>

<p align="center">
  <a href="https://github.com/zr9959/ai-saas-guard/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/zr9959/ai-saas-guard/actions/workflows/ci.yml/badge.svg"></a>
  <a href="https://www.bestpractices.dev/projects/12955"><img alt="OpenSSF Best Practices" src="https://www.bestpractices.dev/projects/12955/badge"></a>
  <a href="https://www.npmjs.com/package/ai-saas-guard"><img alt="npm" src="https://img.shields.io/npm/v/ai-saas-guard.svg"></a>
  <a href="LICENSE"><img alt="License: MIT" src="https://img.shields.io/badge/license-MIT-blue.svg"></a>
  <a href="package.json"><img alt="Node.js >=20" src="https://img.shields.io/badge/node-%3E%3D20-339933.svg"></a>
</p>

---

## 它解决什么问题

AI 能很快把一个 SaaS 从想法做成可运行的产品。真正难的是：它能不能放心给真实用户用。

上线前最危险的通常不是界面小 bug，而是那些会影响用户数据、付费权限、密钥暴露和 AI 工具权限的小改动：

- 一个用户会不会看到另一个客户的数据？
- Stripe webhook 会不会重复开通权限、漏处理付款失败，或者信任未签名请求？
- `NEXT_PUBLIC_*` 里是不是不小心暴露了 secret？
- MCP 工具是不是拿到了 shell、数据库或过宽的文件系统权限？
- AI 生成的大 PR 里，是不是把 auth、billing 或 deploy 改动藏在 UI 调整中？

`ai-saas-guard` 是面向这个时刻的本地优先、review-first 上线预检工具。它不会证明你的应用绝对安全，也不是渗透测试、认证或完整安全审计。它的目标是给 founder、独立开发者、小团队和 reviewer 一份短而有证据的清单，告诉你上线或合并 PR 前最该先看哪里。

## 你会得到什么

对仓库或 PR 运行后，它会给出：

- 命中的 rule
- severity 和文件证据
- 为什么这个问题会影响 SaaS 上线
- 如何人工验证
- 实际修复方向

它适合常见 AI 构建的 SaaS 技术栈：

- Next.js 和 Vercel
- Supabase RLS、storage policy、SQL migration
- Stripe checkout、subscription、webhook
- Prisma 或 SQL migration
- MCP server 配置
- AI 生成的大型混合 PR

## 当前状态

这个仓库是公开 GitHub 仓库。

CLI 已发布到 npm：`ai-saas-guard@0.25.0`。GitHub Action 支持 `v0` 浮动标签，也支持固定版本标签，例如 `v0.25.0`。

| 模块 | 状态 |
| --- | --- |
| 公开 GitHub 仓库 | 已可用 |
| npm CLI | 已发布为 `ai-saas-guard` |
| 本地源码运行 | 已可用 |
| JSON 和 SARIF 输出 | 已可用 |
| Markdown PR summary | 已可用 |
| GitHub Action | 已可用 |
| 项目配置 | `.ai-saas-guard.json` 支持规则开关、severity 覆盖和 fail threshold |
| 当前版本 | `0.25.0` |
| Action 标签 | `v0.25.0`、`v0` |
| npm 发布 | GitHub Actions Trusted Publisher/OIDC，无需长期 npm token |
| 仓库可信度加固 | 严格 branch protection、Dependabot、CodeQL、fast-check fuzzing、signed release provenance assets、private vulnerability reporting、secret scanning 和 push protection |
| 运行时加固 | 单文件和总扫描文本预算、markdown evidence 转义、1 MiB hosted webhook payload 上限、更严格的 hosted deployment 阻断 |
| Hosted production adapters | GitHub App JWT 签名、installation-token 请求规划、有边界的 worker 执行和终态 cleanup 规划 |
| Hosted app skeleton | Node/container HTTP ingress、health route、worker tick、in-memory provider adapters 和 deployment plan 校验 |
| Hosted staging deployment planner | provider binding、staging release-gate evidence、Node/container deployment 组合和 GitHub App promotion gating |
| Hosted staging harness | 本地 file-backed webhook replay、queue/report/Check Run artifact、worker cleanup 校验和 release-gate evidence fixture |
| Cloudflare hosted ingress | 已部署到 `https://ai-saas-guard-hosted.zr9959.workers.dev`；Worker health 和 Check Run publisher 配置已在线，但端到端 GitHub App webhook delivery 仍需要验证私有 App 设置 |
| Hosted operations evidence | 已记录在 [docs/hosted-operations-evidence.md](docs/hosted-operations-evidence.md) |
| Hosted GitHub App staging | 私有 App `ai-saas-guard-hosted`（`3834787`）已安装到 `zr9959/ai-saas-guard`，权限为 contents read、pull requests read、metadata read、checks write |
| OpenSSF Best Practices | 已获得 passing badge，项目 `12955`；`.bestpractices.json` 继续作为保守证据记录 |

## 快速开始

无需全局安装，直接运行：

```bash
npx ai-saas-guard@latest scan --root /path/to/your-saas
```

运行专项检查：

```bash
npx ai-saas-guard@latest pr-risk --root /path/to/your-saas --base origin/main
npx ai-saas-guard@latest check-supabase --root /path/to/your-saas
npx ai-saas-guard@latest check-stripe --root /path/to/your-saas
npx ai-saas-guard@latest check-mcp --root /path/to/your-saas
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

## 主要命令

| 命令 | 用途 |
| --- | --- |
| `scan` | 对 secrets、Stripe、Supabase、MCP、API routes、deploy config 做整体上线预检 |
| `pr-risk` | 分析当前 git diff 或指定 base branch diff，判断哪些文件和风险面应该先 review |
| `check-supabase` | 检查 migration 和 policy 文件里的 RLS、ownership、storage policy 风险 |
| `check-stripe` | 检查 webhook 签名、raw body、幂等、订阅生命周期和 entitlement 更新路径 |
| `check-mcp` | 检查 MCP 配置里的 secret、非 localhost 绑定、shell/db/filesystem 等副作用 |

## 它会检查什么

| 风险面 | 例子 |
| --- | --- |
| Secrets 和 env | 类似密钥的字符串、危险的 `NEXT_PUBLIC_*` 暴露 |
| Stripe | webhook 缺失、未验证签名、raw body 签名风险、缺幂等、缺失败/取消/退款/更新处理 |
| Supabase | 敏感表没启用 RLS、policy 过宽、缺少 ownership filter、`WITH CHECK` 过弱、storage object policy 过宽 |
| API routes | 有 auth 但缺少明显 ownership guard，敏感 mutation route 缺少 rate-limit 提示 |
| MCP | 明文 secret、非 localhost 绑定、过宽文件系统权限、shell 工具、raw SQL 工具 |
| Deploy config | Next static export 和 API route 冲突、Edge runtime 使用 Node-only API、关键 env 文档缺失 |
| PR risk | auth、billing、RLS、env、deploy、API、storage、测试删除、大型混合 diff |

完整规则请看 [docs/rules.md](docs/rules.md)。

## 仓库可信度加固

公开仓库的维护和发布控制见 [docs/repository-trust-hardening.md](docs/repository-trust-hardening.md)。当前已经配置严格 branch protection、required CI checks、Dependabot npm/GitHub Actions 更新、CodeQL SAST、fast-check fuzz/property tests、基于 npm trusted publishing provenance 的 signed GitHub release assets、private vulnerability reporting、secret scanning 和 push protection。

最新 GitHub releases 会镜像 npm package tarball，并附带 `*.tgz.sigstore.json` 和 `*.tgz.intoto.jsonl` provenance assets。上传前会用 npm registry metadata 校验 tarball digest，并使用 npm provenance 作为来源。

当前 Scorecard 提升路线优先做真实控制，不做表面刷分：更严格的 review gate、可被检测到的 fuzzing、以及 OpenSSF Best Practices Badge 流程。仓库年龄、贡献者多样性、已 review 的 PR 历史这些分数只能随着真实维护逐步提升。

仓库现在已经获得 [OpenSSF Best Practices passing badge](https://www.bestpractices.dev/projects/12955)。[.bestpractices.json](.bestpractices.json) 继续作为公开项目条目的保守证据记录。`dynamic_analysis_enable_assertions` 仍然谨慎标为 unmet，直到运行时断言覆盖面超过当前测试、property 和 fuzz assertions。

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

更多 GitHub Action 示例请看 [docs/github-action.md](docs/github-action.md)。

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

当前仓库已经包含未来 Hosted GitHub App 的设计文档、纯契约测试，以及第一个真实 Cloudflare hosted ingress。私有 staging GitHub App `ai-saas-guard-hosted` 已安装到 `zr9959/ai-saas-guard`，Cloudflare 已配置所需的云端凭据绑定。Worker 代码已经能接收签名 webhook、写入 KV 队列、换取 scoped installation token、读取 GitHub PR file metadata、做 compact PR-risk classification，并发布有长度上限的 Check Run summary；但当前端到端 GitHub App webhook delivery smoke 还被私有 App webhook 设置阻断，证据记录在 [docs/hosted-operations-evidence.md](docs/hosted-operations-evidence.md)。它还不是完整 source checkout scan worker。

相关文档：

- [docs/github-app-design.md](docs/github-app-design.md)
- [docs/github-app-deployment.md](docs/github-app-deployment.md)
- [docs/hosted-first-service-slice.md](docs/hosted-first-service-slice.md)
- [docs/hosted-deployment-model.md](docs/hosted-deployment-model.md)
- [docs/hosted-service-runtime.md](docs/hosted-service-runtime.md)
- [docs/hosted-production-adapters.md](docs/hosted-production-adapters.md)
- [docs/hosted-node-container-app.md](docs/hosted-node-container-app.md)
- [docs/hosted-staging-deployment.md](docs/hosted-staging-deployment.md)
- [docs/hosted-staging-harness.md](docs/hosted-staging-harness.md)
- [docs/hosted-operational-release-gate.md](docs/hosted-operational-release-gate.md)
- [docs/hosted-uninstall-data-deletion.md](docs/hosted-uninstall-data-deletion.md)
- [docs/hosted-pricing-packaging.md](docs/hosted-pricing-packaging.md)
- [docs/hosted-preimplementation-contracts.md](docs/hosted-preimplementation-contracts.md)

已经实现的 hosted 预实现纯契约包括：

- pull request webhook intake planner：先验签，再解析 payload、生成可信 identity、校验 selected-repository scope，并默认只走 check-run-only 输出
- durable scan queue planner：同一个 trusted scan key 的 queued/running/completed job 会复用，不重复排 worker，也不会把源码、diff、secret 或 PR 正文放进队列 payload
- worker read-only scan planner：只用 trusted identity 规划临时 worker checkout，要求 repository `contents: read`，固定运行 `ai-saas-guard pr-risk --json`，并忽略 PR 正文里的 repo 名、token scope 或命令
- hosted service runtime：`ai-saas-guard/hosted/service` 导出 `createHostedServiceRuntime`，把签名 webhook intake、幂等 queue upsert、read-only worker 编排、compact report 存储、Check Run 发布 adapter 和 worker cleanup 串成可测试的服务核心；它本身不部署公开 hosted 环境
- GitHub App deployment planner：`ai-saas-guard/hosted/github-app` 导出 `planHostedGitHubAppDeployment`，生成 first slice 最小权限 manifest，并在 release gate、公开 HTTPS URL、container digest、secret 引用、原始 secret 输入、permission 或 event 不安全时阻止创建
- Hosted production adapter layer：`ai-saas-guard/hosted/production-adapters` 导出 `createHostedGitHubAppJwt`、`planHostedGitHubInstallationTokenRequest` 和 `planHostedProductionWorkerExecution`，用于 GitHub App RS256 JWT、selected-repository installation token 请求规划、worker/check-run 分离 token scope、固定只读 worker 命令、timeout/output 预算、compact JSON-only 输出，以及 success/failure/timeout/cancellation 的 cleanup 规划；它本身仍然不部署公开 hosted 服务
- Hosted Node/container app skeleton：`ai-saas-guard/hosted/app` 导出 `createHostedHttpApp`、`createInMemoryHostedAppPlatform` 和 `planHostedNodeContainerDeployment`，提供安全 `/healthz`、签名 `/github/webhook` ingress、单 job worker tick、测试用 in-memory provider adapters，以及 secret manager、queue、compact report store、worker sandbox、GitHub Checks publisher 的部署引用校验；它本身仍然不部署或暴露公开 hosted 服务
- Hosted staging deployment planner：`ai-saas-guard/hosted/staging` 导出 `planHostedProviderBinding`、`planHostedStagingDeployment` 和 `planHostedGitHubAppPromotion`，把真实 provider 引用、Node/container deployment plan、hosted operational release-gate evidence 和 GitHub App deployment planning 组合起来；缺少 queue、store、worker sandbox、Check Run publisher、logs、metrics、rollback 或 incident-response 引用时，会阻止 staging exposure 和 production promotion；它本身仍然不会调用云平台、创建 GitHub App 或暴露公开 hosted 服务
- Hosted staging harness：`ai-saas-guard/hosted/staging-harness` 导出 `createFileBackedHostedStagingHarness` 和 `createHostedStagingHarnessEvidence`，可以在本地用 file-backed queue、compact report、Check Run request 和 worker sandbox 跑通签名 webhook replay、worker tick 和 cleanup 校验；它只是 staging 演练工具，不会调用云平台、创建 GitHub App、写真实 Check Run 或暴露公开 hosted 服务
- Cloudflare hosted ingress：`hosted/cloudflare-worker` 已部署到 `https://ai-saas-guard-hosted.zr9959.workers.dev`，提供 `/healthz`、`/github/app/manifest-callback` 和签名 `/github/webhook` intake；Worker 已具备 compact pull request identity、file/category risk signal 和 Check Run metadata 路径；staging GitHub App ID 为 `3834787`，installation ID 为 `135085075`；真实 GitHub App webhook delivery、完整 source checkout scan worker、monitoring、rollback 和 incident-response evidence 仍需要通过 hosted operational release gate
- webhook event parser
- check-run summary renderer
- Check Run publication planner：要求 repository `checks: write`，只从 compact report 生成有长度上限的 Check Run payload，包含 review categories、优先 review 文件、verification steps 和本地 CLI 复现命令；MVP 不发 PR comment
- queue cleanup planner
- worker checkout cleanup planner
- retention/deletion cleanup planner：把 compact report 删除、按仓库或 installation 范围取消队列和 running job、worker checkout 删除、retention 过期清理、最小审计记录合成一个安全计划；不会输出源码、diff、secret、customer payload、private URL、checkout path 或底层 cleanup error
- operational release gate evaluator：检查 hosted 暴露前是否具备 fresh CI、webhook replay、workflow static check、dependency/container scan、cleanup、privacy、monitoring、rollback、incident response 和 release cleanup 证据；缺任何 P0 证据都会阻止 hosted exposure
- hosted compact report fixture：[examples/hosted-compact-report.json](examples/hosted-compact-report.json)

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

发布 CLI、GitHub Action、npm package 或任何公开仓库更新前，必须按照 [docs/release-quality-knowledge-base.md](docs/release-quality-knowledge-base.md) 的 release gate 执行。

以后更新英文 `README.md` 时，也要同步检查并更新本中文 `README.zh-CN.md`。

贡献要求见 [CONTRIBUTING.md](CONTRIBUTING.md)，里面说明了 PR 流程、测试要求、规则设计、release gate evidence 和公开安全边界。

## 安全报告

报告漏洞前请阅读 [SECURITY.md](SECURITY.md)。不要在公开 issue 中发布真实 API key、客户数据、私有源码或生产 URL。
