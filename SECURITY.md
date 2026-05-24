# Security Policy

`ai-saas-guard` is a heuristic launch preflight tool. Please do not report findings from intentionally vulnerable files under `tests/fixtures/**`; they exist to verify scanner behavior.

## Reporting A Vulnerability

Open a private security advisory on GitHub if the issue could help bypass scans, leak user data, or produce unsafe output:

https://github.com/zr9959/ai-saas-guard/security/advisories/new

For ordinary false positives, false negatives, or rule tuning requests, open a public issue with:

- command run
- expected finding
- actual finding
- minimal file snippet or fixture
- whether the snippet is safe to publish

Do not include real API keys, customer data, private source code, or production URLs in public issues.
