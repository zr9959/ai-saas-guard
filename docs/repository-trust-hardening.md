# Repository Trust Hardening

This document records the public repository controls used to keep `ai-saas-guard` releases reviewable and safer to consume.

These controls do not prove the project is secure. They reduce supply-chain and maintenance risk around the public CLI, GitHub Action, npm package, and future hosted service work.

## Branch Protection

The `main` branch uses branch protection with:

- required status checks before merge
- strict status check freshness
- required pull request review for non-admin merges
- linear history
- force pushes disabled
- branch deletion disabled

Required status checks:

- `test`
- `actionlint`
- `zizmor`

Maintainer admin bypass is not enforced so emergency release repair remains possible, but normal contribution flow should use pull requests and CI.

## Dependency Updates

Dependabot is configured in `.github/dependabot.yml`.

It covers:

- npm dependencies
- GitHub Actions

The schedule is weekly with cooldown windows and a small open pull request limit. This keeps update noise low while still surfacing security and maintenance updates.

Dependabot security updates and vulnerability alerts are enabled in repository settings.

## CodeQL

CodeQL is configured in `.github/workflows/codeql.yml`.

The workflow:

- runs on pull requests
- runs on pushes to `main`
- runs on a weekly schedule
- analyzes JavaScript and TypeScript
- uses `build-mode: none`
- uses least-privilege permissions: repository contents read, Actions metadata read, and security event upload
- pins the CodeQL Action by commit SHA

CodeQL is an additional SAST signal. It does not replace `ai-saas-guard`'s release gate, local tests, workflow checks, self-scan, dependency audit, package inspection, or human review.

## Vulnerability Intake

The repository has:

- `SECURITY.md`
- private vulnerability reporting enabled
- secret scanning enabled
- push protection enabled

Public issues should not include real credentials, customer data, private source code, or production URLs.

## Release Impact

Every public release should keep these controls intact. If a release changes workflows, package metadata, Action behavior, or hosted service boundaries, the release notes should include fresh evidence for:

- local tests
- GitHub CI
- `actionlint`
- `zizmor`
- self-scan JSON and SARIF
- dependency audit
- npm package inspection
- packaged CLI smoke test
