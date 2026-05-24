# Hosted Deployed Worker Staging Evidence

This document describes the deployed worker staging evidence helper implemented in `src/hosted/deployed-staging.ts`.

The package exports `ai-saas-guard/hosted/deployed-staging` with:

- `createHostedDeployedWorkerStagingEvidenceBundle`
- `evaluateHostedDeployedWorkerStagingReleaseGate`

The helper is for a deployed Node/container read-only checkout worker release candidate. It turns safe deployment observations into the same hosted operational release-gate evidence used by the rest of the hosted planning layer.

It does not deploy cloud resources, create a GitHub App, call GitHub, fetch repositories, upload source code, or publish Check Runs by itself. It is not production hosted exposure. It records whether a deployed staging candidate has enough public-safe evidence to pass the hosted release gate.

## Inputs

`createHostedDeployedWorkerStagingEvidenceBundle` expects only bounded evidence:

- public HTTPS health probe metadata from the deployed Node/container app
- signed webhook replay summaries
- deployed worker success and failure cleanup summaries
- log-boundary validation output
- external evidence for CI, workflow static checks, dependency/container scans, monitoring, rollback, and incident response
- scanner version, collected timestamp, evidence URL base, and evidence owner

The public HTTPS health probe must show:

- HTTP `200`
- `ok: true`
- `platform: "node_container"`
- both `webhook-ingress` and `scan-worker` roles
- a scanner version matching the release candidate
- privacy flags set to false for raw webhook payloads, PR text, source, diffs, secrets, customer payloads, checkout paths, and installation tokens

The helper requires a public HTTPS URL for both the deployed ingress and the evidence base. Localhost, private IPs, link-local addresses, non-HTTPS URLs, file URLs, URL credentials, query strings, and fragments are rejected for deployed staging evidence.

## Generated Evidence

The bundle generates deployed evidence for these hosted gate IDs when the probes are complete:

- `webhook_replay`: deployed staging ingress accepted a signed webhook and queued check-run-only work
- `queue_worker_cleanup`: deployed worker success and failure probes completed and deleted worker checkouts
- `privacy_retention`: deployed log samples stayed within the safe metadata boundary
- `release_cleanup`: no deployed worker checkout entries remained active after release probes

Other gate IDs still come from external evidence because they belong to CI, workflow analysis, dependency/container scan, monitoring, rollback, and incident-response systems.

## Blocking Behavior

The helper blocks release-gate readiness when deployed evidence is incomplete. Common blocked reasons include:

- `invalid_public_base_url`
- `unsafe_evidence_base_url`
- `health_scanner_version_mismatch`
- `health_missing_scan_worker_role`
- `health_privacy_flags_unsafe`
- `worker_failure_cleanup_probe_missing`
- `worker_cleanup_not_verified`
- `log_boundary_rejected`

Blocked output remains public-safe. It does not return the raw health body, public base URL, raw webhook payload, untrusted PR text, raw source, raw diffs, secrets, customer payloads, private checkout paths, or installation tokens.

## Release Gate

`evaluateHostedDeployedWorkerStagingReleaseGate` passes the generated bundle to the hosted operational release gate with the release commit, scanner version, deployment target, container digest, and release notes.

The evaluator still blocks hosted exposure unless every P0 evidence row is fresh, the deployed artifact has a `sha256:<digest>` container image digest, and release notes avoid positive pentest, certification, and full-audit claims. Wording such as "not a pentest, certification, or full security audit" remains allowed.

## Boundary

This helper narrows the gap between local source-candidate rehearsals and deployed staging evidence. It is still deterministic and local-first: callers collect evidence outside the package and pass only safe summaries into the helper.

It is not a pentest, full audit, or certification. It is not production hosted exposure. It does not prove customer SaaS apps are secure. It only helps decide whether the hosted worker release candidate has enough operational evidence to be exposed for the next staged rollout step.
