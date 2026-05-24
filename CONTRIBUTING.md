# Contributing

`ai-saas-guard` is a local-first launch preflight CLI for AI-built SaaS repositories. Contributions should keep that promise narrow: find review-worthy launch risks, show evidence, and avoid broad security claims.

## Pull Request Process

1. Open an issue or comment on an existing issue before large feature work.
2. Keep pull requests focused. Separate scanner behavior, docs, workflow changes, and release work when practical.
3. Include tests for behavior changes. New scanner rules need a vulnerable fixture, a safe fixture, and assertions for both.
4. Update documentation when behavior, commands, outputs, or release expectations change. If `README.md` changes, review and update `README.zh-CN.md` in the same pull request.
5. Fill out the pull request template with release gate evidence and known limitations.

## Local Development

```bash
npm ci
npm test
npm run build
node dist/cli.js --help
node dist/cli.js scan --root . --json
```

For release candidates or public repository changes, follow [docs/release-quality-knowledge-base.md](docs/release-quality-knowledge-base.md). The release gate is the source of truth for required checks, packaging inspection, dependency audit, self-scan evidence, and rollback notes.

## Testing Expectations

- Run `npm test` before sending a pull request.
- Run `npm run test:fuzz` when changing markdown rendering, SARIF rendering, secret redaction, parser behavior, or other attacker-controlled text handling.
- Keep fixtures public-safe and minimal.
- Prefer deterministic tests over live external services.
- Do not remove or weaken tests without explaining the review and replacement coverage.

## Rule Design

Scanner rules should be evidence-first:

- stable rule ID
- severity
- file/path evidence
- why the issue matters for a SaaS launch
- suggested manual verification
- practical fix direction
- vulnerable fixture
- safe fixture
- public rule documentation

Avoid turning the project into a generic SAST platform. The useful surface is AI-SaaS launch readiness: auth, billing, data access, secrets, MCP tools, deploy configuration, and risky pull request diffs.

## Security And Public Safety

- No real API keys, tokens, cookies, webhook signing secrets, database URLs, customer data, private source code, or private URLs.
- Use inert fake values in fixtures and examples.
- Do not add network calls to local scan commands unless a future feature is explicitly designed, documented, and tested as opt-in.
- Do not add shell execution to scan commands unless it is explicit, narrow, and separately reviewed.
- Public issues must stay safe to read. Use GitHub private vulnerability reporting for sensitive vulnerability details.

## Coding Standards

- Keep TypeScript strict and readable.
- Prefer small, focused helpers over broad abstractions.
- Keep CLI output useful for human reviewers and machine output parseable.
- Redact secret-like evidence.
- Bound resource use for repository scanning.
- Keep GitHub Actions permissions minimal and avoid untrusted input interpolation in shell scripts.

## Feedback Channels

Use GitHub issues for bugs, false positives, false negatives, and rule requests:

https://github.com/zr9959/ai-saas-guard/issues

Use private vulnerability reporting for security-sensitive reports:

https://github.com/zr9959/ai-saas-guard/security/advisories/new
