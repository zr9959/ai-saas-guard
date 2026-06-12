# Cross-Project Traffic Evidence - 2026-05-27

This note records the public cross-project links created or verified across TIYBAI, PageStow, and ai-saas-guard. It is evidence for discovery and navigation only; it is not a billing, pricing, marketplace, paid packaging, or sales funnel change.

## Scope

| Project | Public surface | Status | Boundary |
| --- | --- | --- | --- |
| TIYBAI | `https://www.tiybai.com/` | Two resource posts published and verified | Contextual articles only, no broad link farm |
| PageStow | `https://plugin.tiybai.com/` | Homepage, privacy, and support related-project links deployed and verified | Local-first Chrome extension positioning stays unchanged |
| ai-saas-guard | GitHub README | Related TIYBAI developer tools merged through PR #113 | README/docs metadata only, no CLI behavior change |
| ai-saas-guard | npm package | Still `0.43.1`; npm metadata does not include the new keywords until a future package release | No empty npm release for documentation-only traffic work |

## Verified Live Links

TIYBAI resource pages:

- `https://www.tiybai.com/blog/save-browser-context-without-cloud-sync`
  - Links to PageStow homepage, PageStow privacy policy, Chrome Web Store listing, TIYBAI Toolbox, Password Vault, and Subscription Manager.
  - Production status: `published`, `seo=98`, `geo=100`, `quality=99`.
- `https://www.tiybai.com/blog/launch-checks-for-ai-built-saas-apps`
  - Links to ai-saas-guard npm, GitHub, hosted install/privacy notes, TIYBAI JSON Formatter, JWT Decoder, and CSV Adapter Builder.
  - Production status: `published`, `seo=94`, `geo=100`, `quality=97`.

PageStow public pages:

- `https://plugin.tiybai.com/`
  - Contains "More from TIYBAI", "Related TIYBAI projects", TIYBAI, and ai-saas-guard links.
- `https://plugin.tiybai.com/privacy`
  - Contains TIYBAI and ai-saas-guard footer links.
- `https://plugin.tiybai.com/support`
  - Contains TIYBAI and ai-saas-guard footer links.

ai-saas-guard public repository:

- `https://raw.githubusercontent.com/zr9959/ai-saas-guard/main/README.md`
  - Contains "Related TIYBAI Tools" with JSON Formatter, JWT Decoder, AI Metadata Generator, and PageStow links.
- PR #113 merged to `main`: `https://github.com/zr9959/ai-saas-guard/pull/113`.
- `https://git.tiybai.com/`
  - Verified as a public redirect alias for the ai-saas-guard GitHub repository.
  - Redirect check result: one redirect, final URL `https://github.com/zr9959/ai-saas-guard?tab=MIT-1-ov-file`, final HTTP status `200`.

## Discovery Status

| Surface | Result |
| --- | --- |
| TIYBAI `robots.txt` | Lists the main sitemap plus content, blog, news, review, comparison, and help sitemaps |
| TIYBAI `sitemap-blog.xml` | Includes both new cross-project blog posts |
| TIYBAI `sitemap-content.xml` | Includes both new cross-project blog posts |
| TIYBAI RSS feed | Includes both new cross-project blog posts |
| TIYBAI `llms.txt` / `llms-full.txt` / `ai.txt` | Lists PageStow and ai-saas-guard via `git.tiybai.com`; retired storefront references must be absent |
| PageStow `robots.txt` | Lists `https://plugin.tiybai.com/sitemap.xml` |
| PageStow `sitemap.xml` | Lists homepage, privacy, and support |
| PageStow `llms.txt` | Lists related TIYBAI projects; retired storefront references must be absent |
| PageStow `ai.txt` | Updated to list related TIYBAI projects; retired storefront references must be absent |

## Current Gaps

- `npm view ai-saas-guard@latest version keywords --json` still returns `0.43.1` without `tiybai` or `launch-risk` because no new npm version was published for this docs-only change.
- PageStow has no configured Git remote in the local repository. The local PageStow commit is present and the Cloudflare Pages deployment is live, but there is no remote push target from this workspace.

## Verification Commands

```bash
curl -fsSL https://www.tiybai.com/blog/save-browser-context-without-cloud-sync \
  | rg -n "PageStow homepage|plugin\\.tiybai\\.com|TIYBAI Toolbox|TIYBAI Password Vault|TIYBAI Subscription Manager"

curl -fsSL https://www.tiybai.com/blog/launch-checks-for-ai-built-saas-apps \
  | rg -n "ai-saas-guard npm package|github\\.com/zr9959/ai-saas-guard|TIYBAI JSON Formatter|TIYBAI JWT Decoder|TIYBAI CSV Adapter"

curl -fsSL https://plugin.tiybai.com/ \
  | rg -n "More from TIYBAI|Related TIYBAI projects|Visit TIYBAI|ai-saas-guard"

for p in llms.txt llms-full.txt ai.txt; do
  curl -fsSL "https://www.tiybai.com/$p" \
    | rg -n "shop\\.tiybai\\.com|PawMiles" && exit 1 || true
done

for p in privacy support; do
  curl -fsSL "https://plugin.tiybai.com/$p" \
    | rg -n "More from TIYBAI|ai-saas-guard|www\\.tiybai\\.com"
done

for p in llms.txt ai.txt; do
  curl -fsSL "https://plugin.tiybai.com/$p" \
    | rg -n "shop\\.tiybai\\.com|PawMiles" && exit 1 || true
done

curl -fsSL https://raw.githubusercontent.com/zr9959/ai-saas-guard/main/README.md \
  | rg -n "Related TIYBAI Tools|JSON Formatter|JWT Decoder|AI Metadata Generator|PageStow|plugin\\.tiybai\\.com"

npm view ai-saas-guard@latest version keywords --json

curl -Ls -o /dev/null -w 'final_url=%{url_effective}\nstatus=%{http_code}\nredirects=%{num_redirects}\n' \
  https://git.tiybai.com/
```

## Follow-Up Signal To Watch

- PageStow referrals from `plugin.tiybai.com` to TIYBAI and npm.
- TIYBAI article visits and outbound clicks to PageStow and ai-saas-guard.
- ai-saas-guard GitHub README referral impact before deciding whether a future npm patch release is justified.

## Observation Cadence

Run a daily public-surface check at 08:00 Asia/Shanghai:

- Verify TIYBAI article URLs, blog/content sitemaps, RSS, `llms.txt`, `llms-full.txt`, and `ai.txt`, including absence of retired storefront references.
- Verify PageStow homepage, privacy, support, sitemap, `llms.txt`, and `ai.txt`, including absence of retired storefront references.
- Verify `git.tiybai.com` still redirects to the ai-saas-guard GitHub repository.
- Verify ai-saas-guard GitHub README still contains the related TIYBAI section.
- Verify npm latest version and keywords; do not publish npm just for metadata unless there is a real release.
- Report only public link/discovery status and notable deltas. Do not read secrets, private customer data, or platform tokens.

Automation status:

- Codex app automation creation was attempted in this session, but the automation tool handler was unavailable.
- A remote GitHub Actions workflow now implements the cadence instead: `.github/workflows/cross-project-discovery.yml`.
- The workflow runs at `00:00 UTC`, which is `08:00 Asia/Shanghai`, and can also be started manually with `workflow_dispatch`.
- The workflow runs `node scripts/cross-project-discovery-check.mjs`, uploads a 30-day artifact, and writes a public-safe step summary.
