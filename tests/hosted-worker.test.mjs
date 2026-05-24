import assert from "node:assert/strict";
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
  assert.equal(typeof worker.HostedReadOnlyCheckoutScanError, "function");
  return worker;
}

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
