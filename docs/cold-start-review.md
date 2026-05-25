# 30-Second GitHub Cold-Start Review

Use this checklist when reading the repository as a first-time visitor.

## First Screen

- Does the first screen explain the painful problem before listing features?
- Does it say AI-built SaaS can look ready while auth, billing, data, deploy, and CI risks stay hidden?
- Is the no-signup demo command visible without scrolling far?
- Are the local-first boundaries visible: no code upload and no LLM call?

## First Command

- Can the visitor run `npx ai-saas-guard@latest demo --summary` without cloning a repository?
- Does the output show risky versus safe SaaS surfaces in under a minute?
- Does it point to manual proof instead of implying certification?

## First Decision

- Can the visitor tell when to use this beside Semgrep, CodeQL, zizmor, Scorecard, Snyk, and GitHub code scanning?
- Can the visitor tell this is a launch review queue, not a pentest, full audit, or certification?
- Can the visitor tell whether they should run `scan`, `pr-risk`, or the GitHub Action next?
