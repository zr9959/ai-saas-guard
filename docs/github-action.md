# GitHub Action Usage

`ai-saas-guard` ships as a composite GitHub Action for pull request and code scanning workflows.

Use `zr9959/ai-saas-guard@v0` for the latest compatible pre-1.0 Action. Use a specific tag such as `v0.24.0` or a reviewed commit SHA when reproducibility is more important than automatic minor updates.

## PR Summary

Use markdown when reviewers need a short, evidence-first summary of risky files, required verification, and suggested PR split.

```yaml
name: ai-saas-guard-pr-summary

on:
  pull_request:

permissions:
  contents: read

jobs:
  pr-summary:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6.0.2
        with:
          fetch-depth: 0
      - uses: zr9959/ai-saas-guard@v0
        with:
          command: pr-risk
          root: ${{ github.workspace }}
          base: origin/main
          config: .ai-saas-guard.json
          format: markdown
          output: ai-saas-guard-pr.md
      - run: cat ai-saas-guard-pr.md >> "$GITHUB_STEP_SUMMARY"
```

Use markdown for PR review triage. It is intentionally short enough for a GitHub step summary or a PR comment created by your own workflow. It does not require a hosted service.

## Project Config

The Action auto-loads `.ai-saas-guard.json` from `root` when the file exists. Use the `config` input when the policy file lives somewhere else or when you want the workflow to be explicit:

```yaml
      - uses: zr9959/ai-saas-guard@v0
        with:
          command: scan
          root: ${{ github.workspace }}
          config: .ai-saas-guard.json
          fail-on: none
```

Project config can disable noisy rules, override severity by rule ID, apply path-specific `suppressions`, and set a default `failOn` threshold. A workflow `fail-on` input overrides the config threshold for that run.

## SARIF Upload

Use SARIF when you want findings to appear in GitHub code scanning alerts.

```yaml
name: ai-saas-guard-sarif

on:
  pull_request:

permissions:
  contents: read
  security-events: write

jobs:
  code-scanning:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v6.0.2
      - uses: zr9959/ai-saas-guard@v0
        with:
          command: scan
          root: ${{ github.workspace }}
          format: sarif
          output: ai-saas-guard.sarif
      - uses: github/codeql-action/upload-sarif@v3
        with:
          sarif_file: ai-saas-guard.sarif
```

Use SARIF for tracking alerts over time. Use markdown for reviewer guidance on a specific PR. Many teams should run both: markdown for quick review order, SARIF for code scanning visibility.
