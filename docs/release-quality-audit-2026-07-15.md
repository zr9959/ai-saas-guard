# Release Quality Audit - 2026-07-15

This review covers the `0.43.3` worktree after the interface, report-layout, scanner-accuracy, and trust-boundary changes on `codex/ui-quality-audit`. It is a static and local execution review, not a security certification or evidence that the hosted public beta is ready.

Status meanings:

- `Pass`: checked in source, tests, or local execution without a new issue.
- `Fixed`: an issue was found and corrected in this change.
- `Evidence gate`: code has a conservative boundary, but a live provider or participant result is still required.

## Product And Interface

| # | Dimension | Status | Evidence or action |
| ---: | --- | --- | --- |
| 1 | Local-first product scope | Pass | CLI remains read-only and makes no network or LLM call during repository scans. |
| 2 | Pre-commercial boundary | Pass | No billing, pricing, paid packaging, marketplace, or sales-funnel behavior was added. |
| 3 | First-run demo path | Pass | `demo --summary` remains the shortest no-signup path and uses packaged fixtures. |
| 4 | Product naming | Fixed | Terminal and Markdown headings consistently lead with `ai-saas-guard` or `AI SaaS Guard`. |
| 5 | Launch-gate terminology | Fixed | User-facing status labels use `Launch gate` consistently without duplicate wording. |
| 6 | Summary hierarchy | Fixed | Target, gate, counts, top risks, manual proof, next steps, and full-report hint now scan in order. |
| 7 | Full terminal hierarchy | Fixed | Findings use numbered progress, aligned metadata, and bounded evidence instead of dense prose. |
| 8 | Zero-finding honesty | Pass | Clear results still state that heuristic output is not a certification. |
| 9 | Incomplete-coverage honesty | Fixed | Skipped, unreadable, empty, or malformed scan inputs now produce an `incomplete` gate. |
| 10 | Count grammar | Fixed | A single result is rendered as `1 finding`; plural output remains unchanged. |

## Output Safety And Readability

| # | Dimension | Status | Evidence or action |
| ---: | --- | --- | --- |
| 11 | Terminal control-sequence injection | Fixed | A linear scanner removes ANSI CSI/OSC sequences, standalone carriage returns, and other control characters without regex backtracking. |
| 12 | Terminal newline and whitespace injection | Fixed | Dynamic terminal fields are normalized to one line. |
| 13 | Markdown heading injection | Pass | Dynamic text is line-normalized and escaped; fuzz tests reject injected headings. |
| 14 | Markdown table injection | Fixed | Reports use vertical lists and escape table separators outside code spans. |
| 15 | Markdown HTML injection | Fixed | Dynamic inline text escapes HTML metacharacters. |
| 16 | Inline-code delimiter injection | Fixed | Dynamic code spans replace embedded backticks and flatten line breaks. |
| 17 | Evidence volume | Pass | Terminal and Markdown evidence lists remain bounded per finding. |
| 18 | Hosted truncation integrity | Fixed | Check Run output truncates at a line boundary and adds an explicit local-report suffix. |
| 19 | Local reproduction visibility | Fixed | The safe local CLI command appears before truncation-prone Check Run details. |
| 20 | Privacy-boundary visibility | Fixed | Selected-repository and no-raw-data wording appears near the top of hosted output. |

## Browser And Mobile UI

| # | Dimension | Status | Evidence or action |
| ---: | --- | --- | --- |
| 21 | Semantic document structure | Pass | One H1, ordered H2/H3 sections, banner, main, footer, and labelled navigation are present. |
| 22 | Script and asset dependency | Pass | Install page uses no client script or third-party visual asset. |
| 23 | Desktop overflow at 1440x900 | Pass | Browser measurement found no horizontal overflow or overlapping section boundary. |
| 24 | Mobile overflow at 390x844 | Pass | Browser measurement found no horizontal overflow; responsive grids collapse to one column. |
| 25 | Narrow mobile overflow at 320x568 | Pass | Browser measurement found no horizontal overflow or clipped control text. |
| 26 | Primary touch targets | Pass | Both install-page commands measure 44px high on desktop and mobile. |
| 27 | First-viewport continuation cue | Fixed | Mobile spacing now leaves the next section heading visible even at 320x568. |
| 28 | Responsive layout stability | Pass | Grid tracks, shell widths, panels, and workflow steps keep stable dimensions across breakpoints. |
| 29 | Keyboard focus visibility | Fixed | Links and commands have an explicit high-contrast `:focus-visible` outline. |
| 30 | Footer and long-text wrapping | Pass | Footer links wrap and code/panel text uses safe overflow wrapping. |

## Hosted HTTP Boundary

| # | Dimension | Status | Evidence or action |
| ---: | --- | --- | --- |
| 31 | Cache policy | Fixed | HTML and JSON responses use `Cache-Control: no-store`. |
| 32 | MIME sniffing | Fixed | Public responses use `X-Content-Type-Options: nosniff`. |
| 33 | Content Security Policy | Fixed | Install page defaults to no resources and only permits its inline stylesheet and GitHub form target. |
| 34 | Framing protection | Fixed | CSP `frame-ancestors 'none'` and `X-Frame-Options: DENY` are both present. |
| 35 | Opener isolation | Fixed | Install page uses `Cross-Origin-Opener-Policy: same-origin`. |
| 36 | Resource isolation | Fixed | Install page uses `Cross-Origin-Resource-Policy: same-origin`. |
| 37 | Browser capability policy | Fixed | Camera, geolocation, and microphone are disabled. |
| 38 | Referrer privacy | Fixed | Public responses use `Referrer-Policy: no-referrer`. |
| 39 | Premature indexing | Fixed | Install page sends header and meta `noindex,nofollow` directives. |
| 40 | Dynamic HTML values | Pass | App slug is URL-encoded and visible version/install values are HTML-escaped. |

## Webhook And GitHub App Security

| # | Dimension | Status | Evidence or action |
| ---: | --- | --- | --- |
| 41 | Webhook authentication | Pass | HMAC SHA-256 is required for webhook processing. |
| 42 | Signature comparison | Pass | Equal-length signatures are compared without early character exit. |
| 43 | Verify-before-parse order | Pass | JSON parsing and storage occur only after signature verification. |
| 44 | Payload size | Pass | Declared and actual webhook payloads are capped at 1 MiB. |
| 45 | Delivery-key validation | Fixed | Delivery IDs must be UUID-shaped before they can form KV keys. |
| 46 | Duplicate delivery behavior | Pass | Duplicate signed deliveries are accepted idempotently without another Check Run. |
| 47 | Event and action allowlist | Pass | Only expected GitHub events and selected pull-request actions reach processing. |
| 48 | Draft pull requests | Pass | Draft events are ignored before hosted scan side effects. |
| 49 | Installation boundary | Pass | A configured installation mismatch is rejected before GitHub API calls. |
| 50 | Repository token scope | Pass | Installation token requests contain one repository ID and least-privilege permissions. |

## Hosted Privacy And Operations

| # | Dimension | Status | Evidence or action |
| ---: | --- | --- | --- |
| 51 | GitHub API destination | Fixed | Credential-bearing hosted calls are pinned to `https://api.github.com`; arbitrary public hosts are rejected. |
| 52 | App JWT lifetime and algorithm | Pass | RS256 JWT behavior is short-lived and covered by tests. |
| 53 | Private-key exposure | Pass | Private key material is used in memory and excluded from public objects and logs. |
| 54 | Installation-token persistence | Pass | Token plans and compact outputs explicitly avoid persistence and serialization. |
| 55 | Compact record content | Pass | Hosted records retain trusted identity/category signals, not raw source or diffs. |
| 56 | Untrusted PR prose | Pass | PR title/body text is not persisted or copied into Check Runs. |
| 57 | Retention | Pass | Compact records use bounded retention and cleanup contracts. |
| 58 | Uninstall and repository removal | Pass | Signed cleanup events delete matching installation/repository scan records idempotently. |
| 59 | Abuse controls | Pass | Repository rate limits fail closed on corrupt counters and expose no secret state. |
| 60 | Provider monitoring, rollback, incident proof | Evidence gate | Runtime pause exists, but public beta still requires current live provider and incident evidence. |

## Scanner Accuracy And Applicability

| # | Dimension | Status | Evidence or action |
| ---: | --- | --- | --- |
| 61 | Shared repository inventory | Pass | One bounded text inventory is reused by scanners; repository files are not reread per rule. |
| 62 | Tool-first discovery | Pass | Stack inventory runs before specialized conditional checks; the repository self-scan detects its nested Cloudflare Worker config. |
| 63 | Supabase applicability | Pass | Full Supabase checks run only when the stack inventory has a credible Supabase signal. |
| 64 | Documentation-only Supabase examples | Fixed | Markdown examples no longer activate Supabase inventory. |
| 65 | Generic PostgreSQL RLS | Fixed | Generic `CREATE POLICY`/RLS SQL no longer implies Supabase without Supabase-specific syntax or paths. |
| 66 | Monorepo project signals | Fixed | Nested `package.json`, Vercel, Netlify, and Wrangler configs participate in stack discovery. |
| 67 | Framework identity | Fixed | Svelte/SvelteKit and React Router/Remix are reported separately. |
| 68 | Database identity | Fixed | MariaDB no longer also creates a MySQL inventory entry. |
| 69 | Malformed package manifests | Pass | Parse failures are surfaced as coverage warnings instead of silent skips. |
| 70 | Stripe applicability | Pass | Stripe checks require runtime Stripe/webhook signals and ignore documentation-only references. |

## Resource Use And Determinism

| # | Dimension | Status | Evidence or action |
| ---: | --- | --- | --- |
| 71 | Per-file byte budget | Pass | Text collection caps individual files at 1 MiB by default. |
| 72 | File-count budget | Pass | Text collection caps the default inventory at 10,000 files. |
| 73 | Total-byte budget | Pass | Text collection caps default aggregate input at 50 MiB. |
| 74 | Generated-directory exclusions | Pass | Git, dependencies, builds, coverage, and framework output directories are skipped. |
| 75 | macOS metadata handling | Pass | AppleDouble and `.DS_Store` files are ignored by scans and npm packaging. |
| 76 | Symlink traversal | Pass | Directory walking accepts normal files/directories and does not follow symbolic links. |
| 77 | File traversal order | Fixed | Directory entries use a deterministic lexical order across filesystems. |
| 78 | Finding order | Fixed | Severity, rule, file, line, column, and title form a complete deterministic sort key. |
| 79 | Git output budget | Pass | PR diff commands use a bounded output buffer. |
| 80 | Scanner concurrency | Pass | Independent scanners share in-memory context and are scheduled together. |

## CLI, Configuration, And Report Contracts

| # | Dimension | Status | Evidence or action |
| ---: | --- | --- | --- |
| 81 | Git option injection through `--base` | Fixed | Option-like and malformed refs are rejected before `git diff` parsing, including direct API use. |
| 82 | Shell execution boundary | Pass | Git and hosted checkout commands use argument arrays with `shell: false`. |
| 83 | Missing/unreadable root | Fixed | CLI returns a non-zero error instead of an empty clear result. |
| 84 | No-merge-base behavior | Pass | PR risk falls back to a direct base diff and reports unavailable history safely. |
| 85 | Unknown CLI arguments | Pass | Unsupported arguments fail instead of being silently interpreted. |
| 86 | Config structure | Pass | Config must be valid JSON with expected object/array/value types. |
| 87 | Rule ID validation | Pass | Unknown rule IDs in rule overrides and suppressions are rejected. |
| 88 | Suppression scope | Pass | Suppressions require a known rule and explicit path patterns. |
| 89 | Failure threshold | Pass | CLI and config thresholds produce non-zero status only at the selected severity boundary. |
| 90 | JSON, SARIF, Markdown, terminal parity | Pass | All formats retain rule, severity, location, rationale, verification, and fix direction as applicable. |

## Tests, Supply Chain, Documentation, And Release

| # | Dimension | Status | Evidence or action |
| ---: | --- | --- | --- |
| 91 | TypeScript strictness | Pass | Source builds under strict NodeNext TypeScript settings and emits declarations. |
| 92 | Production dependency audit | Pass | `npm audit --audit-level=high --registry=https://registry.npmjs.org` returned 0 vulnerabilities. |
| 93 | Full automated suite | Pass | All 221 tests passed, including hosted, CLI, docs, fuzz, and packaging behavior. |
| 94 | Property-based fuzzing | Pass | Markdown structure, SARIF JSON, and secret redaction fuzz properties pass. |
| 95 | Workflow least privilege and pinning | Pass | Checkout/setup/upload/CodeQL actions are commit-pinned with narrow permissions and timeouts. |
| 96 | Workflow static analysis | Pass | CI includes actionlint, zizmor, and CodeQL coverage. |
| 97 | npm publishing credentials | Pass | Release workflow uses trusted publishing with OIDC rather than a stored npm token. |
| 98 | Package contents | Pass | Dry-run packaging produced 175 expected files and excluded local/cache/AppleDouble artifacts. |
| 99 | English/Chinese README alignment | Fixed | Both READMEs now show the same current summary layout and are checked together. |
| 100 | Real-user and public-beta evidence | Evidence gate | Static quality is not a substitute for design-partner feedback, provider monitoring, rollback, deletion, and incident drills. |

## Issues Corrected In This Review

- Reworked terminal, summary, Markdown, and hosted Check Run layouts for faster review and safer dynamic content.
- Added a responsive, script-free hosted install/privacy page and verified it at desktop and two mobile sizes.
- Prevented terminal control sequences, malformed Git base refs, malformed delivery IDs, and arbitrary GitHub API destinations from crossing their trust boundaries.
- Prevented incomplete scans from presenting a clear launch gate.
- Reduced Supabase and stack-inventory false positives while preserving nested-project detection.
- Made traversal and finding order deterministic across platforms.

## Remaining Boundary

No new commercial feature is authorized by this review. The next product signal should come from real users/design partners and current hosted provider monitoring, rollback, deletion, and incident evidence. Those are operational evidence tasks, not missing static-analysis features.
