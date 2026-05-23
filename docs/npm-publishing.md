# npm Publishing

`ai-saas-guard` is prepared for npm publication, but the package is not published yet.

## Current State

- Package name: `ai-saas-guard`
- Current version: `0.1.0`
- npm registry state: not published at the time of this document update
- GitHub Release: `v0.1.0`
- Publish workflow: `.github/workflows/npm-publish.yml`

## Preferred Path

Use GitHub Actions with npm provenance:

1. Create an npm automation token with publish rights for this package.
2. Add it to this GitHub repository as `NPM_TOKEN`.
3. Run the `Publish npm` workflow manually with `ref` set to `v0.1.0`.
4. After the first publish succeeds, configure npm Trusted Publisher for future releases:
   - Provider: GitHub Actions
   - Organization or user: `zr9959`
   - Repository: `ai-saas-guard`
   - Workflow filename: `npm-publish.yml`
   - Allowed action: `npm publish`
5. Once trusted publishing is verified, remove or rotate any long-lived npm publish token.

The workflow sets `id-token: write` and runs `npm publish --provenance --access public`, so token-based first publish can include provenance and future trusted-publisher publishes can use OIDC.

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
