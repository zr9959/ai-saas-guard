# Release Quality Knowledge Base

Date: 2026-05-23
Scope: `ai-saas-guard`, GitHub Actions, npm packages, public CLI tools, Codex/agent plugins, and future release work.

This document is the release gate. Before publishing a CLI update, GitHub Action update, plugin update, npm package, or public repository change, run this checklist and record the evidence in the PR, issue, or release notes.

No checklist can prove "no bugs" or "fully secure." The goal is stricter: no release without fresh evidence for code correctness, security, packaging, documentation, and GitHub repository hygiene.

## Release Rule

Do not publish if any P0 gate fails.

P0 means release blocker.
P1 means should be fixed before release unless explicitly documented.
P2 means quality improvement or follow-up issue.

Every release must have:

- exact commit SHA
- version or tag
- local verification commands and outputs
- CI status
- self-scan result
- packaging inspection result
- release notes
- rollback plan

## P0 Gate Summary

1. Code builds from a clean install.
2. All tests pass locally and in CI.
3. No committed secrets or push protection bypasses.
4. `ai-saas-guard scan --root .` returns no unexpected findings.
5. GitHub Actions workflow passes `actionlint` and a security-oriented workflow scan such as `zizmor`.
6. Dependency audit has no unresolved high/critical production vulnerabilities.
7. Package tarball contains only intended files.
8. CLI entry points run after packaging, not only from source.
9. Release tag/version is intentional and documented.
10. If publishing to npm, use trusted publishing or provenance-capable publishing.

## Local Verification Commands

Run from the repository root:

```bash
npm ci
npm test
npm run build
node dist/cli.js --help
node dist/cli.js scan --root . --json
node dist/cli.js scan --root . --sarif > /tmp/ai-saas-guard.sarif
node dist/cli.js pr-risk --root . --json
npm audit --audit-level=high
npm pack --dry-run
```

If available locally, also run:

```bash
actionlint
zizmor --offline .github/workflows
scorecard --repo=github.com/zr9959/ai-saas-guard --show-details
```

For a release candidate tarball:

```bash
npm pack
tmpdir=$(mktemp -d)
tar -xzf ai-saas-guard-*.tgz -C "$tmpdir"
node "$tmpdir/package/dist/cli.js" --help
node "$tmpdir/package/dist/cli.js" scan --root . --json
```

For major releases or plugin releases, add at least one focused external check from each relevant group and record any intentional suppressions:

```bash
gitleaks detect --source . --redact
trufflehog git file://$PWD --only-verified --fail
osv-scanner scan source -r .
npm sbom --sbom-format=cyclonedx > /tmp/ai-saas-guard-sbom.json
```

If Scorecard is not installed, run it through the official container or GitHub Action instead of inventing an npm wrapper.

## Code Correctness

P0:

- TypeScript compiles with `strict` enabled.
- The test suite passes from `npm ci`, not only from an existing `node_modules`.
- CLI commands have tests for success and expected failure paths.
- Exit codes are intentional:
  - `0` for successful scan execution
  - non-zero for CLI errors
  - non-zero for `--fail-on` threshold hits
- JSON and SARIF output are parseable.
- Public APIs exported from `src/index.ts` are stable or versioned.
- No generated `dist/`, `node_modules/`, AppleDouble `._*`, `.DS_Store`, local logs, temp files, or private machine paths are committed unless intentionally documented.
- Hidden files are reviewed explicitly; do not rely on default file globs that skip `.github`, `.env*`, or dot-directories.

P1:

- Add regression tests for every bug fix.
- Prefer test fixtures over live external services.
- Keep snapshots small and reviewable.
- Add tests for edge cases before changing broad scanner logic.

P2:

- Add coverage reporting once the suite grows.
- Add mutation or fixture fuzz tests for parsers and diff classifiers.

## Security Review

P0:

- No real API keys, tokens, webhook secrets, cookies, certificates, private keys, database URLs, or session secrets are committed.
- Push protection must never be bypassed for a real provider secret.
- Intentionally secret-like test fixtures must use inert values that do not match provider token formats.
- `SECURITY.md` exists and tells users how to report vulnerabilities without posting secrets publicly.
- GitHub private vulnerability reporting should be enabled for public repos.
- Security-sensitive errors must not print full secrets; redact matched values.
- No command writes files unless the command name and docs explicitly say it will.
- No network calls in local scan commands unless a future flag explicitly enables network behavior.
- Any shell execution, if ever added, must be opt-in and narrowly scoped.

P1:

- Run CodeQL/code scanning where supported.
- Run dependency scanning and review lockfile diffs.
- Run a local secret scanner such as Gitleaks or TruffleHog before major releases, with intentional fixtures suppressed or documented.
- Review all new regular expressions for catastrophic backtracking risk.
- Review all parsers for malformed input handling.
- Review all log output for secret leakage.

P2:

- Add threat model updates when adding new command surfaces.
- Add abuse-case docs for MCP, CI, and PR comment modes.

## GitHub Repository Settings

P0 for public release:

- Repository is public only if it contains no private product files, private research notes, private env examples, or unrelated history.
- Secret scanning and push protection are enabled.
- Dependabot alerts are enabled.
- Code scanning is enabled or tracked as a release-blocking issue before major release.
- Default branch has a ruleset or branch protection before multi-contributor work:
  - require PR before merge
  - require CI status checks
  - block force pushes
  - block branch deletion
  - require linear history if feasible
- `SECURITY.md`, `LICENSE`, and README exist.
- Issues are enabled for public feedback.

P1:

- Add `CODEOWNERS` once there are multiple maintainers.
- Require review from Code Owners for release workflows, package metadata, scanner core, and security docs.
- Enable private vulnerability reporting.
- Add issue templates for bug, false positive, false negative, rule request, and security-safe report.
- Add pull request template with the release gate evidence.
- Generate artifact attestations for release artifacts where GitHub Actions builds distributable archives or binaries.

P2:

- Use GitHub Projects for a public roadmap.
- Add OpenSSF Scorecard badge once score is acceptable.
- Keep the OpenSSF Best Practices Badge evidence current after public process, README, or release-gate changes.

## GitHub Actions Security

P0:

- Every workflow must declare minimum `permissions`.
- Default token permissions should be read-only unless a job needs more.
- Do not use `pull_request_target` unless the workflow is separately threat-modeled.
- Do not interpolate untrusted GitHub context directly into shell scripts.
- Do not echo secrets or transformed secrets.
- Use OIDC/trusted publishing instead of long-lived npm/cloud tokens.
- For third-party actions, prefer full commit SHA pinning for sensitive workflows.
- If not SHA-pinned, document why and use Dependabot/Renovate to keep action versions current.
- CI must run on pull requests and pushes to `main`.
- Release workflows must be manually triggered or tag-triggered with explicit permissions.

P1:

- Run `actionlint` on workflow syntax and expression safety.
- Run `zizmor` for GitHub Actions security findings.
- Avoid inline scripts when a maintained action or checked-in script is clearer.
- Use job-scoped permissions instead of workflow-wide write permissions.
- Avoid secrets in jobs triggered by untrusted forks.
- Avoid broad `contents: write`, `packages: write`, or `id-token: write` except in release jobs.

P2:

- Add SARIF upload for workflow security scanners.
- Add dependency review for PRs once the repository has meaningful dependency changes.

## Dependencies

P0:

- `package-lock.json` is committed and matches `package.json`.
- `npm ci` works from a clean clone.
- `npm audit --audit-level=high` has no unresolved high/critical production vulnerability.
- New dependencies are justified in PR notes.
- No dependency is pulled from a personal fork, git URL, tarball URL, or unpublished source without explicit review.
- No install script dependency is added without review.

P1:

- Enable Dependabot security updates.
- Group routine dependency updates separately from feature work.
- Review lockfile-only diffs for unexpected package additions.
- Prefer small, maintained dependencies with clear licenses.

P2:

- Add license scanning before commercial use.
- Add OSV-Scanner or similar dependency vulnerability scan if npm audit coverage is insufficient.
- Generate and archive an SBOM for commercial or enterprise-facing releases.

## npm Package Publishing

P0:

- `npm pack --dry-run` shows only intended files.
- Tarball install works in a temporary directory.
- `bin` entries point to built files.
- `types` points to generated declaration files if package exports TypeScript API.
- `exports` is accurate.
- README install examples match the published package name.
- If `README.md` changes, `README.zh-CN.md` must be reviewed and updated or explicitly confirmed still current.
- Version follows semver.
- Release notes state breaking changes, new checks, false-positive changes, and migration notes.
- Publish with npm trusted publishing/OIDC when possible.
- If token publishing is unavoidable, use a short-lived granular token and rotate it after use.

P1:

- Use npm provenance. Trusted publishing generates provenance automatically for public packages published from public GitHub Actions.
- Use `npm publish --provenance` if not using trusted publishing and the workflow supports it.
- Configure npm package settings to require 2FA and disallow long-lived tokens after trusted publishing is verified.

P2:

- Consider staged publishing for high-impact releases.
- Add a release candidate tag before stable releases.

## GitHub Action Publishing

P0:

- `action.yml` inputs are documented.
- The action can run from a tagged ref.
- Decide whether the action builds at runtime or commits `dist`.
- If it builds at runtime, the workflow must be explicit about install/build cost and network dependency.
- If it commits `dist`, generated files must be reproducible and reviewed.
- Tag release references (`v0`, `v0.1`, `v0.1.0`) must be intentional.

P1:

- Use immutable release tags for full versions.
- Move major version tag only after full version release passes.
- Document whether users should reference a tag or commit SHA.

P2:

- Add GitHub Marketplace metadata if distribution through Marketplace becomes useful.

## Scanner-Specific Quality Gates

P0:

- Every new rule has:
  - rule ID
  - severity
  - evidence path/line/snippet
  - why it matters
  - suggested verification
  - suggested fix direction
  - vulnerable fixture
  - safe fixture
  - test that proves both
- Every new broad scanner has at least one false-positive suppression path via `.ai-saas-guardignore` or config.
- Rules must not report documentation-only mentions as runtime risk unless the command is explicitly a docs scan.
- Self-scan must return zero unexpected findings.
- SARIF output must include rule metadata and locations.

P1:

- Prefer precise stack-aware rules over generic keyword scanning.
- Keep issue text founder-readable and reviewer-actionable.
- Add manual verification steps for risks that static analysis cannot prove.

P2:

- Add fixture minimization guidelines.
- Add rule stability labels: experimental, default, strict.

## Plugin And Agent Release Gates

Use this section for future Codex plugins, MCP servers, GitHub Apps, or agent tools.

P0:

- Tool permissions are explicit and minimal.
- Read-only tools are the default.
- Write, shell, database, network, and secret-bearing capabilities are separately declared.
- No tool logs full secrets or raw customer data.
- Prompt/tool descriptions do not overclaim security guarantees.
- Untrusted text from issues, PRs, docs, websites, or emails is treated as data, not instructions.
- Tool outputs, MCP resources, web pages, emails, issue bodies, PR comments, and repository text are never allowed to override system/developer/user instructions.
- Any tool that can write files has path constraints and dry-run behavior.
- Any tool that can run commands has allowlists or requires explicit user confirmation.
- Any GitHub App uses least-privilege permissions and avoids broad organization access unless justified.
- Any hosted service has privacy docs before launch.
- MCP servers must document transport, auth, tool side effects, network exposure, and data retention.

P1:

- Add threat model for prompt injection, tool injection, and confused-deputy risks.
- Add fixtures for malicious issue/PR text if the plugin reads GitHub content.
- Add audit logging for write actions.
- Add rate limits and replay/idempotency for webhook receivers.

P2:

- Add optional policy mode for teams.
- Add red-team prompts for agent workflows.

## Documentation Gate

P0:

- README explains:
  - what the project does
  - what it does not do
  - install and quick start
  - privacy model
  - examples
  - current limitations
- `docs/rules.md` matches implemented rules.
- `docs/positioning.md` does not overclaim.
- Release notes mention:
  - new rules
  - changed severities
  - known false positives
  - migration steps
  - security-relevant changes

P1:

- Add screenshots or terminal output examples after the CLI stabilizes.
- Add "false positive / false negative report" issue template.
- Add contribution guide before inviting outside contributors.

P2:

- Add architecture docs once APIs stabilize.

## PR Review Gate

P0:

- PR title and body explain why the change exists.
- PR lists verification commands and exact results.
- PR separates sensitive surfaces from cosmetic/refactor changes.
- PR runs `ai-saas-guard pr-risk`.
- Any change touching auth, billing, RLS, secrets, deploy, GitHub Actions, package publishing, or MCP must have focused review.
- Any removed or weakened test is called out explicitly.

P1:

- Use small PRs.
- Add screenshots or terminal output for CLI UX changes.
- Link issues and roadmap item.

P2:

- Add a generated markdown PR risk summary once implemented.

## Release Procedure

1. Start from clean `main`.
2. Pull latest remote.
3. Create release branch.
4. Run local verification commands.
5. Run self-scan.
6. Inspect package tarball.
7. Update version, changelog, README, and docs.
8. Open PR.
9. Wait for CI success.
10. Review sensitive surfaces.
11. Merge only after gates pass.
12. Create signed tag if configured.
13. Create GitHub release with notes.
14. Publish npm package through trusted publishing or provenance-capable workflow.
15. Verify npm package page, provenance, install command, and CLI smoke test.
16. Monitor issues, security alerts, and Actions results after release.

## Evidence Template

Paste this into each release PR:

```markdown
## Release Gate Evidence

Commit:
Version/tag:

### Commands
- [ ] `npm ci`
- [ ] `npm test`
- [ ] `npm run build`
- [ ] `node dist/cli.js scan --root . --json`
- [ ] `node dist/cli.js scan --root . --sarif`
- [ ] `node dist/cli.js pr-risk --root . --json`
- [ ] `npm audit --audit-level=high`
- [ ] `npm pack --dry-run`

### Security
- [ ] no real secrets
- [ ] no push protection bypass
- [ ] workflow permissions reviewed
- [ ] dependency changes reviewed
- [ ] package tarball inspected

### Docs
- [ ] README updated
- [ ] docs/rules.md updated
- [ ] release notes drafted

### Notes
Known false positives:
Known limitations:
Rollback plan:
```

## Source Map

Primary sources used to build this gate:

- GitHub Actions secure use reference: https://docs.github.com/en/actions/how-tos/security-for-github-actions/security-guides/security-hardening-for-github-actions
- GitHub code scanning setup types: https://docs.github.com/en/code-security/concepts/code-scanning/setup-types
- GitHub CodeQL action: https://github.com/github/codeql-action
- GitHub secret scanning features: https://docs.github.com/en/code-security/secret-scanning/enabling-secret-scanning-features
- GitHub Dependabot alerts: https://docs.github.com/en/code-security/dependabot/dependabot-alerts/about-dependabot-alerts
- GitHub rulesets: https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/managing-rulesets/about-rulesets
- GitHub protected branches: https://docs.github.com/articles/about-required-commit-signing
- GitHub CODEOWNERS: https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-code-owners
- GitHub security policy and private vulnerability reporting: https://docs.github.com/en/code-security/how-tos/report-and-fix-vulnerabilities/configure-vulnerability-reporting
- GitHub releases: https://docs.github.com/github/administering-a-repository/creating-releases
- GitHub composite actions: https://docs.github.com/en/actions/tutorials/create-actions/create-a-composite-action
- npm trusted publishing: https://docs.npmjs.com/trusted-publishers
- npm provenance: https://docs.npmjs.com/generating-provenance-statements
- npm provenance implementation notes: https://github.com/npm/provenance
- OpenSSF Scorecard: https://github.com/ossf/scorecard
- OpenSSF Best Practices Badge: https://openssf.org/projects/best-practices-badge/
- SLSA provenance: https://slsa.dev/spec/v1.0-rc1/provenance
- GitHub artifact attestations: https://docs.github.com/en/actions/concepts/security/artifact-attestations
- GitHub artifact provenance guide: https://docs.github.com/en/actions/how-tos/security-for-github-actions/using-artifact-attestations/using-artifact-attestations-to-establish-provenance-for-builds
- OWASP API Security Top 10 2023: https://owasp.org/API-Security/editions/2023/en/0x00-header/
- OWASP Secure Coding Practices guide: https://owasp.org/www-project-secure-coding-practices-quick-reference-guide/
- OWASP Top 10 for LLM Applications: https://owasp.org/www-project-top-10-for-large-language-model-applications/
- OWASP MCP Top 10: https://owasp.org/www-project-mcp-top-10/
- MCP security best practices: https://modelcontextprotocol.io/specification/2025-06-18/basic/security_best_practices
- OWASP npm Security Cheat Sheet: https://cheatsheetseries.owasp.org/cheatsheets/NPM_Security_Cheat_Sheet.html
- actionlint: https://github.com/rhysd/actionlint
- zizmor: https://zizmor.sh/
- Gitleaks: https://github.com/gitleaks/gitleaks
- OSV-Scanner: https://google.github.io/osv-scanner/

Secondary research signals:

- OpenSSF Scorecard overview: https://openssf.org/scorecard/
- GitHub push protection public availability: https://github.blog/2023-05-09-push-protection-is-generally-available-and-free-for-all-public-repositories/
- GitHub Actions workflow scanner research and incidents were used only as risk signals; official docs and primary tool docs define the release gate.
