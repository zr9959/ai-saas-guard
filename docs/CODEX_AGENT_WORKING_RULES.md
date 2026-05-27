# Codex Agent Working Rules

This project uses these rules for Codex or other coding agents working in `ai-saas-guard`.

They adapt general agent-coding discipline to this repository's current boundary: pre-commercial evidence work, local-first scanner behavior, strict secret protection, and cleanup after every task.

## 1. Think Before Editing

- Read the handoff docs and the relevant project files before changing anything.
- State assumptions when they affect risk, scope, deployment, secrets, user data, or release status.
- If a request has multiple plausible meanings, choose the lowest-risk interpretation when it stays inside the user's explicit goal.
- Stop and ask only when a reasonable assumption would be destructive, secret-bearing, commercial, or likely to erase user-owned work.

## 2. Keep Changes Narrow

- Every changed line must trace to the user's current request.
- Do not refactor adjacent code, rewrite docs broadly, reformat unrelated files, or delete pre-existing dead code unless asked.
- Match local style even when a different style would also work.
- Prefer documentation/evidence updates over product expansion when the current blocker is missing proof or real feedback.

## 3. Prefer Simpler Proof

- Solve the smallest real problem that moves the gate forward.
- Do not add configurability, abstractions, dashboards, analytics, paid packaging, or workflows just because they might be useful later.
- For scanner behavior, prefer focused rules with synthetic fixtures and clear false-positive boundaries.
- For hosted readiness, do not replace provider evidence with a boolean, assumption, or local-only test.

## 4. Verify Before Claiming

- No success claim without fresh evidence from the current turn.
- For docs-only changes, run at least `git diff --check` and the smallest relevant test set; run `npm test` when public docs or release-gate docs change.
- For runtime/scanner changes, run `npm test`, focused scanner checks, and any affected CLI commands.
- If a command fails, report the exact failing area and fix it before committing or merging.

## 5. Protect Secrets And Evidence

- Never print, commit, rotate, overwrite, or expose secrets, tokens, private keys, cookies, certs, database URLs, customer data, installation tokens, raw webhook payloads, raw diffs, PR text, source, private URLs, checkout paths, or raw provider logs.
- Do not bulk-delete Cloudflare KV records or remove GitHub App installations unless the user explicitly approves a safe scoped proof.
- Keep historical rows in `docs/hosted-operations-evidence.md`; append new evidence instead of rewriting history.
- Keep `.local/` private and ignored.

## 6. Use Risk-Gated Autonomy

- Continue automatically for safe read-only checks, docs updates, tests, PR creation, and cleanup when the user has asked to proceed.
- Pause only for destructive operations, secret access, GitHub App installation mutation, Cloudflare deployment, KV deletion, npm publishing, or commercialization work.
- Do not start billing, pricing, paid packaging, marketplace conversion, sales funnel, broad analytics, or customer account work.
- If the next valid progress requires real users or design partners, record the blocker without fabricating evidence.

## 7. Clean Up Every Time

- Remove temporary files generated under `/tmp` or the repo before finishing.
- Stop or wait for any test, watch, dev-server, deploy, smoke-test, or GitHub-watch process started during the task.
- Confirm `git status -sb` and mention any intentional remaining branch/PR state.
- If README.md changes, check and update `docs/README.zh-CN.md` in the same task.

## Working Test

These rules are working when diffs are small, every claim has verification evidence, public docs stay aligned, no unrelated files are touched, no secrets are exposed, and public beta remains blocked until real design-partner and provider evidence exists.
