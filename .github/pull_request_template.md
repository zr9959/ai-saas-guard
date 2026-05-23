## What Changed


## Release Gate Evidence

Use `docs/release-quality-knowledge-base.md` as the source of truth.

Commit:
Version/tag, if release PR:

### Required Checks

- [ ] `npm ci`
- [ ] `npm test`
- [ ] `npm run build`
- [ ] `node dist/cli.js scan --root . --json`
- [ ] `node dist/cli.js scan --root . --sarif`
- [ ] `node dist/cli.js pr-risk --root . --json`
- [ ] `npm audit --audit-level=high`
- [ ] `npm pack --dry-run`

### Security Review

- [ ] No real secrets, tokens, private URLs, or private product files are included.
- [ ] Workflow permissions are explicit and minimal.
- [ ] Dependency and lockfile changes are reviewed.
- [ ] Package tarball contents are intentional.
- [ ] New scanner rules include vulnerable and safe fixtures.

### Notes

Known false positives:
Known limitations:
Rollback plan:
