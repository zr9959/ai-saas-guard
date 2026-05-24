# npm Publishing

`ai-saas-guard` is published on npm and should be released only from reviewed GitHub tags.

## Current State

- Package name: `ai-saas-guard`
- Current published version: `0.25.0`
- Next source candidate: `0.26.0`
- npm registry state: published at <https://www.npmjs.com/package/ai-saas-guard>
- First npm-published version: `0.1.1`
- GitHub Release: `v0.25.0`
- Publish workflow: `.github/workflows/npm-publish.yml`
- Trusted Publisher: GitHub Actions, `zr9959/ai-saas-guard`, workflow `npm-publish.yml`, allowed action `npm publish`
- Long-lived npm publish token: not required

## Preferred Path

Use GitHub Actions with npm Trusted Publisher/OIDC:

1. Create and review a release tag such as `v0.26.0`.
2. Publish from the GitHub Release or run the `Publish npm` workflow manually with `ref` set to that tag.
3. Keep `permissions.id-token: write` in the workflow so npm can exchange the GitHub Actions OIDC identity for a short-lived publish credential.
4. Run `npm publish --access public` from the workflow. Trusted publishing automatically generates provenance for this public package from this public repository.
5. Keep npm package publishing access set to require 2FA and disallow traditional tokens. Trusted publishers continue to work because they use OIDC instead of npm auth tokens.

The first npm publish used a temporary granular access token because npm requires a 2FA-bypass token until trusted publishing is configured. That temporary automation token and the GitHub `NPM_TOKEN` secret were removed after the Trusted Publisher migration.

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
