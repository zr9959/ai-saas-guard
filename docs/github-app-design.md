# GitHub App Design Note

This note describes a possible hosted GitHub App layer for `ai-saas-guard`. It is a product and security design note, not an implementation announcement. The current project remains a local-first CLI and composite GitHub Action.

The hosted GitHub App should save review time for teams that want PR comments, saved reports, policy settings, and scan history. It does not replace the local CLI. The CLI must remain useful on its own for private repositories, offline review, and users who do not want source code processed by a hosted service.

## Product Goal

The hosted app should answer the same narrow product question as the CLI:

> What changed in auth, billing, data access, secrets, MCP tools, or deploy config that deserves human review first?

The hosted layer adds workflow convenience:

- PR comments with a concise review-first summary.
- Check runs that point to findings without blocking every PR by default.
- Saved reports for launch-readiness history.
- Team policy settings for fail thresholds, suppressions, and stability preferences.
- Optional human launch-readiness review for teams that want an expert pass.

It should not become a broad SAST platform, pentest claim, or automatic security certification.

## Non-Goals

Do not build these into the first GitHub App version:

- Full production infrastructure scanning.
- Automatic code rewrites.
- Secret rotation.
- Direct deploy, billing, or database mutation.
- Long-lived raw source archives.
- Broad organization-wide installation by default.
- AI-generated comments that treat untrusted PR text as instructions.

## Recommended First Version

Start with a PR review assistant that runs the same deterministic scanner logic as the CLI:

1. A repository installs the GitHub App on selected repositories.
2. A pull request event queues a scan job.
3. The worker checks out or fetches the PR diff in an isolated job.
4. The scanner runs in read-only mode.
5. The app publishes a short check run summary.
6. If enabled by policy, the app posts one PR comment with review-first files and required manual verification.
7. The app stores a compact report record, not a full source copy.

The first version should prefer check runs over noisy PR comments. PR comments should be opt-in per repository.

## Least-Privilege Permissions

Use least-privilege permissions and install on selected repositories only. This section is the Implementation-ready permission contract for the first hosted GitHub App version.

### Required First-Version Permissions

Only these permissions are required for the first hosted version. No required permission may be added without a new public issue that explains the product need, user impact, security tradeoff, and rollback path.

| Status | Permission | Access | Default | Why |
| --- | --- | --- | --- | --- |
| Required | repository contents: read | Read | Enabled | Fetch files or diffs needed for deterministic scans. |
| Required | pull requests: read | Read | Enabled | Read PR metadata, changed files, and base/head refs. |
| Required | checks: write | Write | Enabled | Publish a check run with summary, findings count, and report link. |
| Required | metadata: read | Read | Enabled | Required by GitHub Apps for repository identity. |

### Optional Permissions

Optional permissions are disabled by default and must be enabled through repository policy opt-in. Pull request comments require repository policy before the app can post or update any comment.

| Status | Permission | Access | Default | Why |
| --- | --- | --- | --- | --- |
| Optional | pull requests: write | Write | Disabled | Post one upserted PR comment only when repository policy opt-in enables comments. |
| Optional | issues: write | Write | Disabled | Only if GitHub represents PR comments through issue comment APIs for the chosen comment workflow. |

### Install Boundary

Selected repositories only:

- The app should default to selected repository installation, not all repositories.
- Repository admins should be able to remove a repository from the installation without affecting local CLI use.
- No organization-wide installation requirement.
- The hosted app does not replace the local CLI for repositories that do not install it.

### Out-Of-Scope Permissions

Avoid broad permissions:

- No administration permission for the first version.
- No deployments permission.
- No actions: write permission.
- No repository secrets permission.
- No organization secrets permission.
- No repository security-events write permission unless a later public issue scopes SARIF upload behavior.
- No organization-wide installation requirement.

## Event Model

Accept only the events needed for review:

- `pull_request` for opened, reopened, synchronized, and ready-for-review PRs.
- `check_suite` or `check_run` only if needed for rerun behavior.
- Installation events for setup and repository selection changes.

Do not use `pull_request_target` semantics in the app worker. Treat PR title, body, comments, branch names, and code contents as untrusted data.

## Webhook Security

Every inbound GitHub webhook must pass webhook signature verification before any queue write or repository lookup.

Additional requirements:

- Reject requests with missing or invalid signatures.
- Enforce timestamp or delivery replay checks when available.
- Store GitHub delivery IDs for idempotency.
- Make scan jobs idempotent by installation, repository, PR, head SHA, and scanner version.
- Rate-limit repeated events for the same PR and commit.

## Data Flow

The hosted app should keep the data flow simple and inspectable:

1. GitHub sends a signed webhook.
2. The API verifies the signature and writes a small scan request to a queue.
3. A worker fetches repository content or PR diff using an installation token.
4. The worker runs the same scanner package version recorded in the scan request.
5. Findings are converted into a compact report.
6. The app writes a check run and optional PR comment.
7. The report is retained according to team policy.

Prefer storing:

- repository ID and name
- PR number
- head SHA and base SHA
- scanner version
- summary counts
- rule IDs
- evidence file paths and line numbers
- reviewer checklist
- suppression policy version

Avoid storing by default:

- full file contents
- raw diffs
- secrets or matched secret values
- generated logs with unredacted code snippets
- customer data copied from application fixtures

## Privacy And Data Retention

Privacy should be a first-version feature, not a later add-on.

Default data retention:

- Keep compact scan reports for 30 days.
- Keep check run and PR comment content in GitHub as controlled by the customer's repository settings.
- Delete raw worker checkout directories immediately after scan completion.
- Do not train models on customer code or findings.
- Provide repository uninstall cleanup for stored app-side records.

Team admins should be able to shorten retention. Longer retention should be explicit and tied to paid audit history.

## Prompt Injection Handling

If future versions use AI to summarize findings, prompt injection handling must be explicit:

- PR text, code, diffs, issue comments, and README content are untrusted input.
- Untrusted repository content must never override system, developer, or policy instructions.
- AI summaries must be derived from deterministic scanner output first, not from free-form repository claims.
- The app must not run shell commands suggested by PR text.
- The app must not follow links from PR text during default scans.
- Human approval is required before posting generated remediation comments that go beyond scanner evidence.

The first version can avoid AI entirely and still be useful by posting deterministic PR triage.

## Human Approval And Comments

The app should avoid noisy or overconfident comments.

Default behavior:

- Always create or update a check run.
- Do not post a PR comment unless the repository enables comments.
- If comments are enabled, post one upserted summary comment per PR.
- Never claim the PR is secure.
- Use language such as "review first" and "verify" instead of "pass" for non-empty findings.

Human approval should be required for:

- opening issues automatically
- requesting changes on a PR
- posting detailed remediation text
- marking a launch review as accepted
- applying team-wide suppression policy changes

## Configuration Model

The hosted app should reuse the local config model where possible:

- `.ai-saas-guard.json` remains the repository-owned policy file.
- Team UI settings can set defaults, but repository config should be visible and reviewable.
- Rule severity overrides and path-specific suppressions should behave the same as the CLI.
- Stability labels can drive policy, such as "fail checks only on strict high/critical findings."

Policy precedence should be simple:

1. explicit PR workflow input or check rerun option
2. repository `.ai-saas-guard.json`
3. team default policy
4. product default policy

## Report UX

The report should be short enough for busy PR review:

- summary counts by severity
- changed sensitive surfaces
- top files to review first
- exact rule IDs
- evidence path and line
- manual verification steps
- links to launch-readiness and Stripe replay docs when relevant
- note that the output is not a full security audit

Saved reports should make trend review easier:

- scan history by repository
- repeated findings
- suppressed findings by reason
- rule stability breakdown
- launch review sign-off evidence

## Billing And Packaging

The open-source CLI should stay useful without an account.

Possible hosted plans:

- Free: public repos, check run only, short retention.
- Team: private repos, PR comments, saved reports, team policy settings.
- Launch Review: optional human review attached to a checklist and report.

Do not gate core local scanning behind the hosted app.

## Operational Requirements

Before launch, the hosted app needs:

- privacy policy
- terms of service
- security contact
- incident response plan
- webhook delivery replay handling
- worker isolation design
- dependency and container scanning
- audit logs for comment, check, policy, and report access
- rate limits per installation and repository
- clear uninstall and data deletion behavior

## Open Questions

These should be answered before implementation:

- Should the first hosted version fetch full repository files or PR diffs only?
- Should private repo reports store snippets, or only file paths and line numbers?
- Should comments be opt-in per repository or per organization?
- Should strict findings fail checks by default, or only after explicit policy setup?
- What is the minimum paid feature that saves enough time without weakening the open-source CLI?

## Implementation Gate

Do not start implementation until the hosted app has:

- documented GitHub App permissions
- webhook signature verification tests
- installation-token scoping tests
- queue idempotency tests
- privacy and data retention docs
- prompt injection abuse-case tests if AI summaries are included
- release gate evidence equivalent to the CLI package process
