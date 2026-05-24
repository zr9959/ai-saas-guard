# GitHub Marketplace Wrapper Decision

Last checked: 2026-05-24

Decision: do not create a separate Marketplace wrapper repository now.

`ai-saas-guard` stays a single product: a local-first CLI, GitHub Action wrapper, docs, examples, and hosted-design contracts in this repository. The Action remains usable through `zr9959/ai-saas-guard@v0` and fixed release tags.

## Why

GitHub's current Action Marketplace docs say Marketplace actions are published from a public repository that has a single action metadata file at the root and must not contain workflow files. This repository intentionally contains the CLI source, tests, docs, release workflows, hosted contracts, and project governance files. Reshaping it only to satisfy Marketplace listing constraints would weaken the repository boundary and make normal release quality checks harder to keep visible.

The current `action.yml` remains useful without a Marketplace listing:

- users can copy the README workflow and use `zr9959/ai-saas-guard@v0`
- npm remains the main install path for local use
- release tags and signed provenance assets already support controlled upgrades
- all rules, docs, and tests stay in the same product repo

## Wrapper Repo Option

A thin Marketplace wrapper can be revisited later if Marketplace search becomes a clear distribution channel. If that happens, the wrapper should stay minimal:

- only the action metadata, wrapper code, and Marketplace README needed for the listing
- no scanner logic fork
- no separate product positioning
- every release points back to this repository and the npm package
- no hidden workflow that changes the local-first privacy promise

## Revisit Criteria

Revisit only after at least one of these is true:

- multiple external users ask specifically for a GitHub Marketplace listing
- the Action API has stayed stable across several releases
- README, npm, and GitHub discovery are no longer enough for the intended launch-readiness audience
- the wrapper can be maintained without duplicating scanner rules, docs, release gates, or security boundaries

## References

- GitHub Docs: https://docs.github.com/en/actions/how-tos/create-and-publish-actions/publish-in-github-marketplace
- GitHub Action metadata syntax: https://docs.github.com/en/enterprise-cloud@latest/actions/reference/workflows-and-actions/metadata-syntax
