# Metrics Snapshot

This project uses privacy-safe platform analytics snapshots to make GitHub and npm trends comparable over time. It does not add product telemetry.

## What It Captures

- GitHub repository counters: stars, forks, watchers, open issues, and default branch.
- GitHub traffic: views, clones, top paths, and top referrers from the GitHub REST API.
- npm package data: latest version, registry modified time, last-week downloads, last-month downloads, and recent daily download counts.

## Limits

- GitHub traffic comes from the 14-day GitHub traffic window, so old data disappears unless snapshots are saved daily.
- npm downloads are downloads, not unique human users, and may include CI, bots, retries, and caches.
- These snapshots are platform analytics, not design-partner feedback. Product decisions still need real user interviews, design-partner notes, public beta evidence, provider monitoring evidence, rollback drills, and incident evidence.

## Privacy Boundary

The snapshot workflow has no hidden CLI telemetry. It does not collect IP addresses, does not collect user identities, does not collect customer data, and does not collect repository contents from scanned users.

Snapshots should stay aggregated. Do not paste raw customer data, private repository names, private support messages, secrets, tokens, private keys, database URLs, or access logs into the metrics files.

## Local Usage

Run a local snapshot into the ignored `.local/metrics` directory:

```bash
GH_TOKEN=... npm run metrics:snapshot -- --repo zr9959/ai-saas-guard --package ai-saas-guard
```

The script writes:

- `.local/metrics/latest.json`
- `.local/metrics/snapshots.jsonl`
- `.local/metrics/summary.md` when `--summary-markdown` is provided

`.local/` is git-ignored, so local snapshots are not committed by default.

## GitHub Actions

`.github/workflows/metrics-snapshot.yml` runs daily at 08:00 Asia/Shanghai, which is 00:00 UTC for GitHub Actions cron, and also supports manual dispatch. It uses read-only repository contents permission, pinned actions, and uploads the sanitized snapshot as a 30-day Actions artifact instead of committing metrics back to `main`.

The workflow writes the same public-safe `summary.md` into the GitHub Actions step summary and uploads it with `latest.json` and `snapshots.jsonl`. The daily review path is: open the latest `Metrics Snapshot` run, read the GitHub Actions step summary, and download the artifact only when the raw JSON is needed.

If the default `github.token` cannot read GitHub traffic endpoints, configure a read-only `METRICS_GITHUB_TOKEN` repository secret with the minimum access required to read repository traffic. GitHub documents the traffic endpoints as requiring `Administration` repository permission with read access for fine-grained tokens. Never print the token, commit it, or put it in `.env.example`.

Without `METRICS_GITHUB_TOKEN`, the workflow still succeeds and saves npm/package metadata plus public repository counters. In that case the JSON sets `github.trafficAvailable` to `false`, leaves views/clones/top traffic arrays empty, and includes a warning so the missing traffic permission is visible in the artifact.

Safe setup boundary:

1. Create a fine-grained personal access token in GitHub with repository access limited to `zr9959/ai-saas-guard`.
2. Grant only repository `Administration: read` for traffic endpoint access.
3. Set the repository secret name to `METRICS_GITHUB_TOKEN`.
4. Run `Metrics Snapshot` manually once and confirm `github.trafficAvailable` is `true`.
5. Do not reuse a broad local `gh` token for this secret.
