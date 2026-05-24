# Repository Trust Hardening

This document records the public repository controls used to keep `ai-saas-guard` releases reviewable and safer to consume.

These controls do not prove the project is secure. They reduce supply-chain and maintenance risk around the public CLI, GitHub Action, npm package, and future hosted service work.

## Branch Protection

The `main` branch uses branch protection with:

- required status checks before merge
- strict status check freshness
- administrator enforcement
- stale review dismissal
- CODEOWNERS review
- last-push approval
- two approving reviews
- linear history
- force pushes disabled
- branch deletion disabled

Required status checks:

- `test`
- `fuzz`
- `actionlint`
- `zizmor`
- `codeql`

Maintainer admin bypass is enforced for normal branch updates. Repository administrators can still update protection settings through GitHub admin APIs if emergency recovery is needed.

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

## Fuzzing

The repository runs Scorecard-detectable fuzzing with `fast-check`.

The fuzz tests cover:

- markdown report escaping for attacker-controlled evidence
- SARIF serialization for arbitrary finding text
- generated secret redaction paths

The dedicated `fuzz` CI job runs `npm run test:fuzz`. The regular `test` job also includes `tests/fuzz.test.js` because it runs the full Node test suite.

## Signed Release Assets

GitHub releases mirror the published npm package tarball and attach the npm trusted publishing provenance used for that release.

Each release should include:

- `ai-saas-guard-<version>.tgz`
- `ai-saas-guard-<version>.tgz.sigstore.json`
- `ai-saas-guard-<version>.tgz.intoto.jsonl`

Before upload, the tarball SHA-512 digest must match npm registry metadata, and the SLSA subject digest in the npm provenance must match the same tarball digest. The `sigstore.json` asset keeps the npm Sigstore bundle for independent verification. The `intoto.jsonl` asset keeps the DSSE in-toto envelope that OpenSSF Scorecard and other release-integrity tooling can detect.

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
- fuzz/property tests
- signed release asset digest and npm provenance checks
- npm package inspection
- packaged CLI smoke test

## OpenSSF Best Practices Badge

The OpenSSF Best Practices Badge is tracked as a separate public trust signal. The badge must be earned through the OpenSSF Best Practices web application and API; it cannot be truthfully completed by repository files alone.
