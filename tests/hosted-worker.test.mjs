import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { mkdtemp, readdir, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { test } from "node:test";

const identity = {
  installationId: 123,
  repositoryId: 456,
  repositoryFullName: "owner/repo",
  pullRequestNumber: 7,
  baseSha: "b".repeat(40),
  headSha: "a".repeat(40),
  scannerVersion: "0.28.0"
};

async function loadHostedWorker() {
  const worker = await import("../dist/hosted/worker.js");
  assert.equal(typeof worker.createHostedReadOnlyCheckoutScanRunner, "function");
  assert.equal(typeof worker.evaluateHostedReadOnlyCheckoutScanGate, "function");
  assert.equal(typeof worker.createHostedSourceCheckoutTrialPlan, "function");
  assert.equal(typeof worker.createHostedSourceCheckoutEvidence, "function");
  assert.equal(typeof worker.HostedReadOnlyCheckoutScanError, "function");
  return worker;
}

test("hosted source checkout trial plan keeps the next hosted layer narrow", async () => {
  const { createHostedSourceCheckoutTrialPlan } = await loadHostedWorker();
  const plan = createHostedSourceCheckoutTrialPlan({
    requestedAt: "2026-05-25T13:00:00.000Z",
    repositoryFullName: "owner/repo",
    selectedRepositoryOnly: true,
    permissions: { contents: "read", checks: "write" },
    command: [
      "ai-saas-guard",
      "pr-risk",
      "--root",
      "<worker-checkout>",
      "--base",
      "<trusted-base-sha>",
      "--json"
    ],
    storesRawSource: false,
    storesRawDiffs: false,
    storesInstallationToken: false,
    exposesPublicScanner: false
  });
  const blocked = createHostedSourceCheckoutTrialPlan({
    requestedAt: "2026-05-25T13:01:00.000Z",
    repositoryFullName: "owner/repo",
    selectedRepositoryOnly: false,
    permissions: { contents: "write", checks: "read" },
    command: ["bash", "-lc", "ai-saas-guard pr-risk"],
    storesRawSource: true,
    storesRawDiffs: true,
    storesInstallationToken: true,
    exposesPublicScanner: true
  });
  const serialized = JSON.stringify(plan);

  assert.equal(plan.readyForTrial, true);
  assert.deepEqual(plan.blockedReasons, []);
  assert.deepEqual(plan.permissions, { contents: "read", checks: "write" });
  assert.deepEqual(plan.fixedCommand, [
    "ai-saas-guard",
    "pr-risk",
    "--root",
    "<worker-checkout>",
    "--base",
    "<trusted-base-sha>",
    "--json"
  ]);
  assert.deepEqual(
    plan.stages.map((stage) => stage.id),
    [
      "checkout_start",
      "token_remove",
      "cli_start",
      "cli_end",
      "compact_report_write",
      "check_run_write",
      "cleanup_end"
    ]
  );
  assert.equal(serialized.includes("raw source"), false);
  assert.equal(plan.privacy.exposesPublicScanner, false);
  assert.equal(blocked.readyForTrial, false);
  assert.deepEqual(blocked.blockedReasons, [
    "repository_not_selected",
    "contents_read_required",
    "checks_write_required",
    "fixed_pr_risk_json_command_required",
    "raw_source_storage_blocked",
    "raw_diff_storage_blocked",
    "installation_token_storage_blocked",
    "public_scanner_claim_blocked"
  ]);
});

test("hosted source checkout evidence records stages without leaking checkout data", async () => {
  const { createHostedSourceCheckoutEvidence } = await loadHostedWorker();
  const evidence = createHostedSourceCheckoutEvidence({
    requestedAt: "2026-05-25T13:05:00.000Z",
    jobKey: "job-source-checkout",
    stages: [
      { id: "checkout_start", ok: true, at: "2026-05-25T13:05:01.000Z" },
      { id: "token_remove", ok: true, at: "2026-05-25T13:05:02.000Z" },
      { id: "cli_start", ok: true, at: "2026-05-25T13:05:03.000Z" },
      { id: "cli_end", ok: true, at: "2026-05-25T13:05:04.000Z" },
      { id: "compact_report_write", ok: true, at: "2026-05-25T13:05:05.000Z" },
      { id: "check_run_write", ok: true, at: "2026-05-25T13:05:06.000Z" },
      { id: "cleanup_end", ok: true, at: "2026-05-25T13:05:07.000Z" }
    ],
    summaryCounts: { critical: 0, high: 1, medium: 0, low: 0, info: 0, total: 1 },
    compactFindingCount: 1,
    cleanupStatus: "deleted",
    rawSource: "const secret = 'do-not-return';",
    rawDiff: "diff --git a/private.ts b/private.ts",
    checkoutPath: "/tmp/private-checkout",
    installationToken: "ghs_do_not_return"
  });
  const blocked = createHostedSourceCheckoutEvidence({
    requestedAt: "2026-05-25T13:06:00.000Z",
    jobKey: "job-source-checkout",
    stages: [{ id: "checkout_start", ok: true, at: "2026-05-25T13:06:01.000Z" }],
    summaryCounts: { critical: 0, high: 0, medium: 0, low: 0, info: 0, total: 0 },
    compactFindingCount: 0,
    cleanupStatus: "failed"
  });
  const serialized = JSON.stringify(evidence);

  assert.equal(evidence.readyForReleaseGate, true);
  assert.deepEqual(evidence.blockedReasons, []);
  assert.equal(evidence.cleanupStatus, "deleted");
  assert.equal(evidence.privacy.includesRawSource, false);
  assert.equal(evidence.privacy.includesRawDiffs, false);
  assert.equal(evidence.privacy.includesPrivateCheckoutPath, false);
  assert.equal(evidence.privacy.includesInstallationToken, false);
  assert.equal(serialized.includes("do-not-return"), false);
  assert.equal(serialized.includes("private-checkout"), false);
  assert.equal(serialized.includes("ghs_"), false);
  assert.equal(blocked.readyForReleaseGate, false);
  assert.deepEqual(blocked.blockedReasons, [
    "missing_token_remove",
    "missing_cli_start",
    "missing_cli_end",
    "missing_compact_report_write",
    "missing_check_run_write",
    "missing_cleanup_end",
    "cleanup_not_deleted"
  ]);
});

test("hosted checkout worker runs trusted git and CLI commands with bounded output and cleanup", async () => {
  const checkoutRoot = await mkdtemp(join(tmpdir(), "ai-saas-guard-worker-"));
  try {
    const { createHostedReadOnlyCheckoutScanRunner } = await loadHostedWorker();
    const commands = [];
    const runner = createHostedReadOnlyCheckoutScanRunner({
      checkoutRoot,
      cloneBaseUrl: `https://github.com${"/".repeat(20_000)}`,
      installationTokenProvider: async () => "ghs_do_not_echo",
      commandRunner: async (command) => {
        commands.push(command);
        assert.equal(command.shell, false);
        assert.ok(command.timeoutMs <= 600_000);
        assert.ok(command.maxOutputBytes <= 1_048_576);
        assert.doesNotMatch(JSON.stringify(command), /ghs_do_not_echo|scan evil\/repo|rm -rf/i);

        if (command.stage === "cli_scan") {
          assert.equal(command.env.GIT_ASKPASS, undefined);
          assert.equal(command.env.AI_SAAS_GUARD_GITHUB_TOKEN, undefined);
          assert.equal(existsSync(join(command.cwd, ".git-askpass.sh")), false);
          return {
            stdout: JSON.stringify({
              command: "pr-risk",
              rootDir: "/private/checkout/path",
              summary: { critical: 0, high: 1, medium: 0, low: 0, info: 0, total: 1 },
              findings: [
                {
                  ruleId: "stripe.webhook.missing-signature",
                  severity: "high",
                  title: "Do not persist this title",
                  evidence: [
                    {
                      file: "app/api/stripe/webhook/route.ts",
                      line: 12,
                      snippet: "const secret = 'do-not-echo';"
                    }
                  ]
                }
              ]
            })
          };
        }

        return { stdout: "" };
      }
    });

    const result = await runner({
      plan: {
        accepted: true,
        jobKey: "job-worker",
        requestedAt: "2026-05-24T18:00:00.000Z",
        readOnly: true,
        shouldFetchSource: true,
        shouldRunCli: true,
        shouldPersistRawSource: false,
        shouldPersistRawDiffs: false,
        shouldCreatePrComment: false,
        installationTokenScope: {
          installationId: 123,
          repositoryId: 456,
          permissions: { contents: "read" },
          selectedRepositoryOnly: true
        },
        checkout: {
          repositoryId: 456,
          repositoryFullName: "owner/repo",
          pullRequestNumber: 7,
          baseSha: identity.baseSha,
          targetCommitSha: identity.headSha,
          directoryScope: "temporary_worker_directory",
          cleanupRequired: true,
          returnsCheckoutPath: false
        },
        cli: {
          command: "ai-saas-guard",
          args: ["pr-risk", "--root", "<worker-checkout>", "--base", identity.baseSha, "--json"],
          workingDirectory: "<worker-checkout>",
          networkAccess: "disabled",
          writeMode: "read_only"
        },
        output: {
          compactJsonOnly: true,
          persistRawSource: false,
          persistRawDiffs: false,
          persistSecrets: false,
          persistCustomerPayloads: false
        },
        privacy: {
          returnsCheckoutPath: false,
          returnsRawSource: false,
          returnsRawDiffs: false,
          returnsSecrets: false,
          returnsCustomerPayloads: false,
          acceptsCommandFromPrText: false
        }
      },
      queueRecord: {
        key: "job-worker",
        identity,
        status: "running",
        attempt: 1,
        deliveryIds: ["delivery-1"],
        createdAt: "2026-05-24T18:00:00.000Z",
        updatedAt: "2026-05-24T18:00:00.000Z"
      }
    });
    const serialized = JSON.stringify(result);

    assert.deepEqual(
      commands.map((command) => command.stage),
      ["git_init", "git_remote_add", "git_fetch_head", "git_fetch_base", "git_checkout", "cli_scan"]
    );
    assert.equal(commands[1].args.at(-1), "https://github.com/owner/repo.git");
    assert.deepEqual(commands.at(-1).args, [
      "pr-risk",
      "--root",
      commands.at(-1).cwd,
      "--base",
      identity.baseSha,
      "--json"
    ]);
    assert.deepEqual(result.summaryCounts, {
      critical: 0,
      high: 1,
      medium: 0,
      low: 0,
      info: 0,
      total: 1
    });
    assert.deepEqual(result.findings, [
      {
        ruleId: "stripe.webhook.missing-signature",
        severity: "high",
        file: "app/api/stripe/webhook/route.ts",
        line: 12
      }
    ]);
    assert.deepEqual(await readdir(checkoutRoot), []);
    assert.equal(serialized.includes("do-not-echo"), false);
    assert.equal(serialized.includes("private/checkout"), false);
    assert.equal(serialized.includes("ghs_"), false);
  } finally {
    await rm(checkoutRoot, { recursive: true, force: true });
  }
});

test("hosted checkout worker rejects accepted plans with mutated command checkout or token scope", async () => {
  const checkoutRoot = await mkdtemp(join(tmpdir(), "ai-saas-guard-worker-"));
  try {
    const { HostedReadOnlyCheckoutScanError, createHostedReadOnlyCheckoutScanRunner } =
      await loadHostedWorker();
    const runner = createHostedReadOnlyCheckoutScanRunner({
      checkoutRoot,
      installationTokenProvider: async () => "ghs_do_not_echo",
      commandRunner: async () => {
        throw new Error("command runner should not be reached");
      }
    });
    const basePlan = {
      accepted: true,
      jobKey: "job-worker",
      requestedAt: "2026-05-24T18:10:00.000Z",
      readOnly: true,
      shouldFetchSource: true,
      shouldRunCli: true,
      shouldPersistRawSource: false,
      shouldPersistRawDiffs: false,
      shouldCreatePrComment: false,
      installationTokenScope: {
        installationId: 123,
        repositoryId: 456,
        permissions: { contents: "read" },
        selectedRepositoryOnly: true
      },
      checkout: {
        repositoryId: 456,
        repositoryFullName: "owner/repo",
        pullRequestNumber: 7,
        baseSha: identity.baseSha,
        targetCommitSha: identity.headSha,
        directoryScope: "temporary_worker_directory",
        cleanupRequired: true,
        returnsCheckoutPath: false
      },
      cli: {
        command: "ai-saas-guard",
        args: ["pr-risk", "--root", "<worker-checkout>", "--base", identity.baseSha, "--json"],
        workingDirectory: "<worker-checkout>",
        networkAccess: "disabled",
        writeMode: "read_only"
      },
      output: {
        compactJsonOnly: true,
        persistRawSource: false,
        persistRawDiffs: false,
        persistSecrets: false,
        persistCustomerPayloads: false
      },
      privacy: {
        returnsCheckoutPath: false,
        returnsRawSource: false,
        returnsRawDiffs: false,
        returnsSecrets: false,
        returnsCustomerPayloads: false,
        acceptsCommandFromPrText: false
      }
    };
    const queueRecord = {
      key: "job-worker",
      identity,
      status: "running",
      attempt: 1,
      deliveryIds: ["delivery-1"],
      createdAt: "2026-05-24T18:10:00.000Z",
      updatedAt: "2026-05-24T18:10:00.000Z"
    };

    for (const plan of [
      { ...basePlan, cli: { ...basePlan.cli, command: "bash" } },
      { ...basePlan, cli: { ...basePlan.cli, args: [...basePlan.cli.args, "--output", "/tmp/report.json"] } },
      { ...basePlan, checkout: { ...basePlan.checkout, repositoryFullName: "evil/repo" } },
      {
        ...basePlan,
        installationTokenScope: {
          ...basePlan.installationTokenScope,
          permissions: { contents: "write" }
        }
      }
    ]) {
      await assert.rejects(
        () => runner({ plan, queueRecord }),
        (error) => {
          assert.ok(error instanceof HostedReadOnlyCheckoutScanError);
          assert.equal(error.safeReason, "invalid_worker_plan");
          assert.equal(error.message.includes("bash"), false);
          assert.equal(error.message.includes("evil/repo"), false);
          return true;
        }
      );
    }

    assert.deepEqual(await readdir(checkoutRoot), []);
  } finally {
    await rm(checkoutRoot, { recursive: true, force: true });
  }
});

test("hosted checkout worker rejects unsafe input and command failures without leaking checkout paths", async () => {
  const checkoutRoot = await mkdtemp(join(tmpdir(), "ai-saas-guard-worker-"));
  try {
    const { HostedReadOnlyCheckoutScanError, createHostedReadOnlyCheckoutScanRunner } =
      await loadHostedWorker();
    const runner = createHostedReadOnlyCheckoutScanRunner({
      checkoutRoot,
      installationTokenProvider: async () => "ghs_do_not_echo",
      commandRunner: async (command) => {
        throw new Error(`failed in ${command.cwd} with ghs_do_not_echo`);
      }
    });

    await assert.rejects(
      () =>
        runner({
          plan: {
            accepted: true,
            jobKey: "job-worker",
            requestedAt: "2026-05-24T18:05:00.000Z",
            readOnly: true,
            shouldFetchSource: true,
            shouldRunCli: true,
            shouldPersistRawSource: false,
            shouldPersistRawDiffs: false,
            shouldCreatePrComment: false,
            installationTokenScope: {
              installationId: 123,
              repositoryId: 456,
              permissions: { contents: "read" },
              selectedRepositoryOnly: true
            },
            checkout: {
              repositoryId: 456,
              repositoryFullName: "owner/repo",
              pullRequestNumber: 7,
              baseSha: identity.baseSha,
              targetCommitSha: identity.headSha,
              directoryScope: "temporary_worker_directory",
              cleanupRequired: true,
              returnsCheckoutPath: false
            },
            cli: {
              command: "ai-saas-guard",
              args: ["pr-risk", "--root", "<worker-checkout>", "--base", identity.baseSha, "--json"],
              workingDirectory: "<worker-checkout>",
              networkAccess: "disabled",
              writeMode: "read_only"
            },
            output: {
              compactJsonOnly: true,
              persistRawSource: false,
              persistRawDiffs: false,
              persistSecrets: false,
              persistCustomerPayloads: false
            },
            privacy: {
              returnsCheckoutPath: false,
              returnsRawSource: false,
              returnsRawDiffs: false,
              returnsSecrets: false,
              returnsCustomerPayloads: false,
              acceptsCommandFromPrText: false
            }
          },
          queueRecord: {
            key: "job-worker",
            identity,
            status: "running",
            attempt: 1,
            deliveryIds: ["delivery-1"],
            createdAt: "2026-05-24T18:05:00.000Z",
            updatedAt: "2026-05-24T18:05:00.000Z"
          }
        }),
      (error) => {
        assert.ok(error instanceof HostedReadOnlyCheckoutScanError);
        assert.equal(error.safeReason, "git_init_failed");
        assert.equal(error.message.includes(checkoutRoot), false);
        assert.equal(error.message.includes("ghs_do_not_echo"), false);
        return true;
      }
    );
    assert.deepEqual(await readdir(checkoutRoot), []);
  } finally {
    await rm(checkoutRoot, { recursive: true, force: true });
  }
});

test("hosted checkout scan gate requires full checkout scan check-run and cleanup proof", async () => {
  const { evaluateHostedReadOnlyCheckoutScanGate } = await loadHostedWorker();
  const passed = evaluateHostedReadOnlyCheckoutScanGate({
    requestedAt: "2026-05-25T06:10:00.000Z",
    jobKey: "job-worker",
    commandStages: ["git_init", "git_remote_add", "git_fetch_head", "git_fetch_base", "git_checkout", "cli_scan"],
    summaryCounts: { critical: 0, high: 1, medium: 0, low: 0, info: 0, total: 1 },
    compactFindingCount: 1,
    compactReportStored: true,
    checkRunPublished: true,
    checkoutDeleted: true,
    tokenRemovedBeforeCli: true,
    maxOutputBytes: 1_048_576,
    timeoutMs: 120_000,
    rawSource: "const secret = 'do-not-return';",
    rawDiff: "diff --git a/private.ts b/private.ts",
    checkoutPath: "/tmp/private-checkout",
    installationToken: "ghs_do_not_return"
  });
  const blocked = evaluateHostedReadOnlyCheckoutScanGate({
    requestedAt: "2026-05-25T06:11:00.000Z",
    jobKey: "job-worker",
    commandStages: ["git_init", "git_remote_add", "git_fetch_head"],
    summaryCounts: { critical: 0, high: 0, medium: 0, low: 0, info: 0, total: 0 },
    compactFindingCount: 0,
    compactReportStored: false,
    checkRunPublished: false,
    checkoutDeleted: false,
    tokenRemovedBeforeCli: false,
    maxOutputBytes: 2_000_000,
    timeoutMs: 1_000_000
  });
  const serialized = JSON.stringify(passed);

  assert.equal(passed.readyForHostedTrial, true);
  assert.deepEqual(passed.blockedReasons, []);
  assert.equal(passed.privacy.includesRawSource, false);
  assert.equal(passed.privacy.includesRawDiffs, false);
  assert.equal(passed.privacy.includesPrivateCheckoutPath, false);
  assert.equal(passed.privacy.includesInstallationToken, false);
  assert.equal(serialized.includes("do-not-return"), false);
  assert.equal(serialized.includes("private-checkout"), false);
  assert.equal(serialized.includes("ghs_"), false);
  assert.equal(blocked.readyForHostedTrial, false);
  assert.deepEqual(blocked.blockedReasons, [
    "missing_command_stage_git_fetch_base",
    "missing_command_stage_git_checkout",
    "missing_command_stage_cli_scan",
    "compact_report_missing",
    "check_run_missing",
    "checkout_cleanup_missing",
    "token_boundary_missing",
    "output_budget_exceeded",
    "timeout_budget_exceeded"
  ]);
});
