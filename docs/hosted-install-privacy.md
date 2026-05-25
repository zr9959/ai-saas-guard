# Hosted Install And Privacy

`ai-saas-guard-hosted` is the limited hosted GitHub App path for teams that want a selected-repository Check Run instead of running only the local CLI.

Use the local CLI first when you need private, offline, no-account review:

```bash
npx ai-saas-guard@latest pr-risk --root /path/to/your-saas --base origin/main
```

Install information for the hosted App is available from the deployed Worker:

- public install info: `https://ai-saas-guard-hosted.zr9959.workers.dev/github/app/install-info`
- GitHub App install URL: `https://github.com/apps/ai-saas-guard-hosted/installations/new`
- staging App ID: `3834787`

## What It Solves

AI-built SaaS pull requests often change auth, billing, tenant data, deploy settings, or tests inside a large diff. The hosted App turns those trust-boundary changes into a compact GitHub Check Run so reviewers know what files to inspect before merge.

It is not an AI reviewer, pentest, full audit, or certification. It is a launch-risk review queue.

## Permissions

The first hosted slice uses selected-repository access only:

| Permission | Access | Why |
| --- | --- | --- |
| `checks` | write | Publish the bounded launch-risk Check Run |
| `contents` | read | Read PR file metadata for the selected repository |
| `pull_requests` | read | Identify the PR, base SHA, and head SHA |
| `metadata` | read | Required by GitHub Apps |

It does not request administration, Actions write, repository secrets, deployments, issues, or organization-wide access.

## Events

The hosted App listens for:

- `pull_request` for opened, reopened, synchronize, and ready-for-review events
- `installation` for full uninstall cleanup
- `installation_repositories` for selected repository removal cleanup

Unsupported, draft, unsigned, oversized, or malformed events are ignored or rejected before scan side effects.

## Privacy Boundary

The hosted Check Run and compact records are designed to avoid sensitive payloads:

- no raw source files
- no raw diffs
- no webhook payload bodies
- no PR title or body text
- no secrets
- no customer payloads
- no private checkout paths
- no installation tokens
- no model training and no LLM calls

The hosted Worker stores compact identity, file path, category, severity, and rule signals needed to publish a review queue. Local CLI use remains available without any hosted processing.

## Uninstall And Deletion

Repository removal and full App uninstall trigger cleanup for matching compact records and queued work. GitHub-owned Check Runs may remain in GitHub history, but hosted compact records are deleted according to the cleanup path described in [hosted-uninstall-data-deletion.md](hosted-uninstall-data-deletion.md).

## Current Trial Boundary

The deployed Cloudflare Worker currently handles signed webhook intake, scoped installation token exchange, PR file metadata classification, compact Check Run publication, and installation cleanup for staging. It is not yet the complete source checkout scan worker or public hosted SaaS.
