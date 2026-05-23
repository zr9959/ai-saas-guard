# npm Publishing

`ai-saas-guard` is published on npm and should be released only from reviewed GitHub tags.

## Current State

- Package name: `ai-saas-guard`
- Current version: `0.1.2`
- npm registry state: published at <https://www.npmjs.com/package/ai-saas-guard>
- First npm-published version: `0.1.1`
- GitHub Release: `v0.1.2`
- Publish workflow: `.github/workflows/npm-publish.yml`

## Preferred Path

Use GitHub Actions with npm provenance:

1. Create and review a release tag such as `v0.1.2`.
2. Run the `Publish npm` workflow manually with `ref` set to that tag.
3. Configure npm Trusted Publisher for future releases:
   - Provider: GitHub Actions
   - Organization or user: `zr9959`
   - Repository: `ai-saas-guard`
   - Workflow filename: `npm-publish.yml`
   - Allowed action: `npm publish`
4. Once trusted publishing is verified, remove or rotate any long-lived npm publish token.

The first npm publish used a temporary granular access token because npm requires a 2FA-bypass token until trusted publishing is configured. The workflow sets `id-token: write`, uses Node 24, and runs `npm publish --provenance --access public`, so it is ready for npm Trusted Publisher OIDC publishing.

## Release Gate

Before publishing, run the release gate from [release-quality-knowledge-base.md](release-quality-knowledge-base.md), including:

```bash
npm ci
npm test
npm run build
node dist/cli.js scan --root . --json
node dist/cli.js scan --root . --sarif > /tmp/ai-saas-guard.sarif
node dist/cli.js pr-risk --root . --json
npm audit --audit-level=high --registry=https://registry.npmjs.org
npm pack --dry-run
```

For the release candidate tarball:

```bash
npm pack
tmpdir=$(mktemp -d)
tar -xzf ai-saas-guard-*.tgz -C "$tmpdir"
node "$tmpdir/package/dist/cli.js" --help
node "$tmpdir/package/dist/cli.js" scan --root . --json
```

## Notes

Do not publish from an unreviewed local machine state. Publish only from a reviewed tag or release ref.

Do not commit npm tokens, npm logs, tarballs, or local authentication files.
