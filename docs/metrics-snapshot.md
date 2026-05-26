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

`.local/` is git-ignored, so local snapshots are not committed by default.

## GitHub Actions

`.github/workflows/metrics-snapshot.yml` runs daily at 08:00 Asia/Shanghai, which is 00:00 UTC for GitHub Actions cron, and also supports manual dispatch. It uses read-only repository contents permission, pinned actions, and uploads the sanitized snapshot as a 30-day Actions artifact instead of committing metrics back to `main`.

If the default `github.token` cannot read GitHub traffic endpoints, configure a read-only `METRICS_GITHUB_TOKEN` repository secret with the minimum access required to read repository traffic. Never print the token, commit it, or put it in `.env.example`.
