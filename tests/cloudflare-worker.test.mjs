import assert from "node:assert/strict";
import { createHmac, generateKeyPairSync, randomUUID } from "node:crypto";
import { test } from "node:test";

import worker, {
  HOSTED_WORKER_PRIVACY,
  MAX_WEBHOOK_PAYLOAD_BYTES,
  createGitHubAppManifestCallback,
  createHostedInstallInfo,
  createHostedWorkerHealth,
  parsePullRequestWebhookIdentity,
  verifyGitHubWebhookSignature
} from "../hosted/cloudflare-worker/src/index.js";

function signPayload(payload, secret) {
  return `sha256=${createHmac("sha256", secret).update(payload).digest("hex")}`;
}

function createKv() {
  const records = new Map();
  return {
    records,
    async get(key) {
      return records.get(key) ?? null;
    },
    async put(key, value) {
      records.set(key, value);
    },
    async delete(key) {
      records.delete(key);
    },
    async list({ prefix } = {}) {
      return {
        keys: [...records.keys()]
          .filter((name) => !prefix || name.startsWith(prefix))
          .map((name) => ({ name }))
      };
    }
  };
}

function createGitHubAppPrivateKey() {
  const { privateKey } = generateKeyPairSync("rsa", { modulusLength: 2048 });
  return privateKey.export({ type: "pkcs1", format: "pem" });
}

function createPullRequestPayload(overrides = {}) {
  return {
    action: "synchronize",
    installation: { id: 12345 },
    repository: {
      id: 67890,
      full_name: "zr9959/ai-saas-guard",
      private: false
    },
    pull_request: {
      number: 42,
      draft: false,
      base: { sha: "b".repeat(40), ref: "main" },
      head: { sha: "a".repeat(40), ref: "feature-branch" },
      title: "Untrusted title should not choose identity",
      body: "Untrusted body should not choose identity"
    },
    ...overrides
  };
}

test("Cloudflare hosted worker health response is public-safe", () => {
  const health = createHostedWorkerHealth();

  assert.equal(health.ok, true);
  assert.equal(health.service, "ai-saas-guard-hosted");
  assert.equal(health.mode, "webhook-ingress");
  assert.equal(health.checkRunPublisher, "not_configured");
  assert.deepEqual(health.privacy, HOSTED_WORKER_PRIVACY);
  assert.doesNotMatch(JSON.stringify(health), /private key|webhook secret|installation token|raw source|raw diff/i);
});

test("Cloudflare hosted worker health reports configured Check Run publisher without secrets", () => {
  const health = createHostedWorkerHealth({
    GITHUB_APP_ID: "3834787",
    GITHUB_APP_PRIVATE_KEY: "secret-private-key",
    GITHUB_APP_INSTALLATION_ID: "135085075",
    SCANNER_VERSION: "0.28.0"
  });

  assert.equal(health.checkRunPublisher, "configured");
  assert.equal(health.scannerVersion, "0.28.0");
  assert.doesNotMatch(JSON.stringify(health), /secret-private-key|installation token|raw source|raw diff/i);
});

test("Cloudflare hosted worker exposes public-safe install guidance", async () => {
  const env = {
    GITHUB_APP_SLUG: "ai-saas-guard-hosted",
    GITHUB_APP_ID: "3834787",
    GITHUB_APP_PRIVATE_KEY: "secret-private-key",
    WEBHOOK_SECRET: "local-test-webhook-secret",
    SCANNER_VERSION: "0.38.0"
  };
  const direct = createHostedInstallInfo(env);
  const response = await worker.fetch(
    new Request("https://ai-saas-guard.example.workers.dev/github/app/install-info"),
    env
  );
  const body = await response.json();

  assert.equal(response.status, 200);
  assert.equal(direct.installUrl, "https://github.com/apps/ai-saas-guard-hosted/installations/new");
  assert.equal(body.installUrl, direct.installUrl);
  assert.deepEqual(body.permissions, {
    checks: "write",
    contents: "read",
    metadata: "read",
    pull_requests: "read"
  });
  assert.deepEqual(body.events, ["pull_request", "installation", "installation_repositories"]);
  assert.match(body.boundary, /selected repositories/i);
  assert.match(body.boundary, /not an AI reviewer/i);
  assert.match(body.uninstall, /compact records/i);
  assert.deepEqual(body.privacy, HOSTED_WORKER_PRIVACY);
  assert.doesNotMatch(JSON.stringify(body), /secret-private-key|webhook secret|local-test-webhook-secret|installation token|raw source|raw diff/i);
});

test("Cloudflare hosted worker manifest callback never stores the GitHub one-time code", () => {
  const callback = createGitHubAppManifestCallback(
    new URL("https://ai-saas-guard.example.workers.dev/github/app/manifest-callback?code=temporary-code")
  );

  assert.equal(callback.ok, true);
  assert.equal(callback.stage, "github_app_manifest_callback");
  assert.equal(callback.manifestCodeReceived, true);
  assert.equal(callback.storesManifestCode, false);
  assert.equal(callback.nextStep, "exchange_code_server_side");
  assert.deepEqual(callback.privacy, HOSTED_WORKER_PRIVACY);
  assert.doesNotMatch(JSON.stringify(callback), /temporary-code|private key|webhook secret|installation token/i);
});

test("Cloudflare hosted worker validates GitHub webhook signatures", async () => {
  const payload = JSON.stringify(createPullRequestPayload());
  const secret = "local-test-webhook-secret";

  assert.equal(
    await verifyGitHubWebhookSignature({
      payload,
      signatureHeader: signPayload(payload, secret),
      secret
    }),
    true
  );
  assert.equal(
    await verifyGitHubWebhookSignature({
      payload,
      signatureHeader: "sha256=bad",
      secret
    }),
    false
  );
  assert.equal(
    await verifyGitHubWebhookSignature({
      payload,
      signatureHeader: "",
      secret
    }),
    false
  );
});

test("Cloudflare hosted worker extracts only trusted pull request identity fields", () => {
  const identity = parsePullRequestWebhookIdentity(createPullRequestPayload());

  assert.deepEqual(identity, {
    action: "synchronize",
    installationId: 12345,
    repositoryId: 67890,
    repositoryFullName: "zr9959/ai-saas-guard",
    repositoryPrivate: false,
    pullRequestNumber: 42,
    baseSha: "b".repeat(40),
    headSha: "a".repeat(40),
    draft: false
  });
});

test("Cloudflare hosted worker queues a signed pull request webhook idempotently", async () => {
  const secret = "local-test-webhook-secret";
  const payload = JSON.stringify(createPullRequestPayload());
  const deliveryId = randomUUID();
  const env = {
    WEBHOOK_SECRET: secret,
    HOSTED_EVENTS: createKv(),
    SCANNER_VERSION: "0.28.0"
  };
  const request = new Request("https://ai-saas-guard.example.workers.dev/github/webhook", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-github-event": "pull_request",
      "x-github-delivery": deliveryId,
      "x-hub-signature-256": signPayload(payload, secret)
    },
    body: payload
  });

  const first = await worker.fetch(request.clone(), env);
  const duplicate = await worker.fetch(request.clone(), env);
  const firstBody = await first.json();
  const duplicateBody = await duplicate.json();

  assert.equal(first.status, 202);
  assert.equal(firstBody.accepted, true);
  assert.equal(firstBody.stage, "queued");
  assert.equal(firstBody.shouldCreateCheckRun, false);
  assert.match(firstBody.scanKey, /^scan:12345:67890:42:/);
  assert.equal(duplicate.status, 202);
  assert.equal(duplicateBody.accepted, true);
  assert.equal(duplicateBody.stage, "duplicate_delivery");
  assert.equal(env.HOSTED_EVENTS.records.size, 2);

  const storedValues = [...env.HOSTED_EVENTS.records.values()].join("\n");
  assert.match(storedValues, /zr9959\/ai-saas-guard/);
  assert.doesNotMatch(storedValues, /Untrusted title|Untrusted body|raw source|raw diff|webhook secret/i);
});

test("Cloudflare hosted worker exchanges installation token and publishes compact PR risk Check Run", async () => {
  const secret = "local-test-webhook-secret";
  const payload = JSON.stringify(createPullRequestPayload());
  const deliveryId = randomUUID();
  const githubRequests = [];
  const env = {
    WEBHOOK_SECRET: secret,
    HOSTED_EVENTS: createKv(),
    SCANNER_VERSION: "0.28.0",
    GITHUB_APP_ID: "3834787",
    GITHUB_APP_PRIVATE_KEY: createGitHubAppPrivateKey(),
    GITHUB_APP_INSTALLATION_ID: "12345",
    async GITHUB_FETCH(url, init) {
      const request = { url: String(url), init };
      githubRequests.push(request);

      if (request.url.endsWith("/app/installations/12345/access_tokens")) {
        assert.match(init.headers.authorization, /^Bearer [A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/);
        assert.doesNotMatch(init.body, /private|secret/i);
        return Response.json({ token: "ghs_test_installation_token" });
      }

      if (request.url.includes("/repos/zr9959/ai-saas-guard/pulls/42/files")) {
        assert.equal(init.headers.authorization, "Bearer ghs_test_installation_token");
        return Response.json([
          {
            filename: "app/api/stripe/webhook/route.ts",
            additions: 18,
            deletions: 2,
            patch: [
              "+ const event = await request.json();",
              "+ await grantSubscription(event.data.object.customer);",
              "+ console.log(process.env.STRIPE_SECRET_KEY);"
            ].join("\n")
          },
          {
            filename: "supabase/migrations/001_policy.sql",
            additions: 4,
            deletions: 0,
            patch: "+ create policy read_all on projects for select using (true);"
          }
        ]);
      }

      if (request.url.endsWith("/repos/zr9959/ai-saas-guard/check-runs")) {
        assert.equal(init.headers.authorization, "Bearer ghs_test_installation_token");
        const body = JSON.parse(init.body);
        assert.equal(body.name, "ai-saas-guard PR risk");
        assert.equal(body.head_sha, "a".repeat(40));
        assert.equal(body.status, "completed");
        assert.equal(body.conclusion, "neutral");
        assert.match(body.output.summary, /Review first/i);
        assert.match(body.output.summary, /Review queue/i);
        assert.match(body.output.summary, /Manual proof/i);
        assert.match(body.output.summary, /Selected-repository hosted check/i);
        assert.match(body.output.summary, /app\/api\/stripe\/webhook\/route\.ts/);
        assert.doesNotMatch(JSON.stringify(body), /ghs_test_installation_token|STRIPE_SECRET_KEY|grantSubscription|raw diff/i);
        return Response.json({ id: 777, html_url: "https://github.example/checks/777" });
      }

      throw new Error(`unexpected GitHub request: ${request.url}`);
    }
  };

  const response = await worker.fetch(
    new Request("https://ai-saas-guard.example.workers.dev/github/webhook", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-github-event": "pull_request",
        "x-github-delivery": deliveryId,
        "x-hub-signature-256": signPayload(payload, secret)
      },
      body: payload
    }),
    env
  );
  const body = await response.json();

  assert.equal(response.status, 202);
  assert.equal(body.accepted, true);
  assert.equal(body.stage, "processed");
  assert.equal(body.shouldCreateCheckRun, true);
  assert.equal(body.checkRunConclusion, "neutral");
  assert.equal(githubRequests.length, 3);

  const storedValues = [...env.HOSTED_EVENTS.records.values()].join("\n");
  assert.match(storedValues, /\"status\":\"completed\"/);
  assert.match(storedValues, /\"checkRunId\":777/);
  assert.match(storedValues, /billing\/subscription/);
  assert.doesNotMatch(storedValues, /ghs_test_installation_token|STRIPE_SECRET_KEY|grantSubscription|Untrusted title|Untrusted body/i);
});

test("Cloudflare hosted worker cleans compact records on installation deletion", async () => {
  const secret = "local-test-webhook-secret";
  const payload = JSON.stringify({
    action: "deleted",
    installation: { id: 12345 },
    repositories: [{ id: 67890, full_name: "zr9959/ai-saas-guard" }]
  });
  const kv = createKv();
  await kv.put("delivery:old", JSON.stringify({ deliveryId: "old" }));
  await kv.put("scan:12345:67890:42:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa:0.38.0", JSON.stringify({ status: "completed" }));
  await kv.put("scan:99999:67890:42:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa:0.38.0", JSON.stringify({ status: "completed" }));
  let githubCalls = 0;
  const env = {
    WEBHOOK_SECRET: secret,
    HOSTED_EVENTS: kv,
    SCANNER_VERSION: "0.38.0",
    GITHUB_APP_ID: "3834787",
    GITHUB_APP_PRIVATE_KEY: createGitHubAppPrivateKey(),
    GITHUB_APP_INSTALLATION_ID: "12345",
    async GITHUB_FETCH() {
      githubCalls += 1;
      return Response.json({});
    }
  };
  const response = await worker.fetch(
    new Request("https://ai-saas-guard.example.workers.dev/github/webhook", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-github-event": "installation",
        "x-github-delivery": randomUUID(),
        "x-hub-signature-256": signPayload(payload, secret)
      },
      body: payload
    }),
    env
  );
  const body = await response.json();

  assert.equal(response.status, 202);
  assert.equal(body.accepted, true);
  assert.equal(body.stage, "cleanup");
  assert.equal(body.reason, "installation_deleted");
  assert.equal(body.deletedRecords, 1);
  assert.equal(githubCalls, 0);
  assert.equal(kv.records.has("scan:12345:67890:42:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa:0.38.0"), false);
  assert.equal(kv.records.has("scan:99999:67890:42:aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa:0.38.0"), true);
  assert.doesNotMatch(JSON.stringify(body), /local-test-webhook-secret|secret-private-key|ghs_|STRIPE_SECRET_KEY|grantSubscription/i);
});

test("Cloudflare hosted worker blocks unexpected GitHub App installation before network calls", async () => {
  const secret = "local-test-webhook-secret";
  const payload = JSON.stringify(createPullRequestPayload());
  let githubCalls = 0;
  const env = {
    WEBHOOK_SECRET: secret,
    HOSTED_EVENTS: createKv(),
    SCANNER_VERSION: "0.28.0",
    GITHUB_APP_ID: "3834787",
    GITHUB_APP_PRIVATE_KEY: createGitHubAppPrivateKey(),
    GITHUB_APP_INSTALLATION_ID: "999",
    async GITHUB_FETCH() {
      githubCalls += 1;
      return Response.json({});
    }
  };

  const response = await worker.fetch(
    new Request("https://ai-saas-guard.example.workers.dev/github/webhook", {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-github-event": "pull_request",
        "x-github-delivery": randomUUID(),
        "x-hub-signature-256": signPayload(payload, secret)
      },
      body: payload
    }),
    env
  );
  const body = await response.json();

  assert.equal(response.status, 403);
  assert.equal(body.accepted, false);
  assert.equal(body.reason, "installation_mismatch");
  assert.equal(githubCalls, 0);
  assert.equal(env.HOSTED_EVENTS.records.size, 0);
});

test("Cloudflare hosted worker rejects invalid signatures before storage", async () => {
  const env = {
    WEBHOOK_SECRET: "local-test-webhook-secret",
    HOSTED_EVENTS: createKv(),
    SCANNER_VERSION: "0.28.0"
  };
  const response = await worker.fetch(
    new Request("https://ai-saas-guard.example.workers.dev/github/webhook", {
      method: "POST",
      headers: {
        "x-github-event": "pull_request",
        "x-github-delivery": randomUUID(),
        "x-hub-signature-256": "sha256=bad"
      },
      body: JSON.stringify(createPullRequestPayload())
    }),
    env
  );
  const body = await response.json();

  assert.equal(response.status, 400);
  assert.equal(body.accepted, false);
  assert.equal(body.stage, "signature");
  assert.equal(env.HOSTED_EVENTS.records.size, 0);
});

test("Cloudflare hosted worker rejects oversized payloads before storage", async () => {
  const env = {
    WEBHOOK_SECRET: "local-test-webhook-secret",
    HOSTED_EVENTS: createKv(),
    SCANNER_VERSION: "0.28.0"
  };
  const response = await worker.fetch(
    new Request("https://ai-saas-guard.example.workers.dev/github/webhook", {
      method: "POST",
      headers: {
        "content-length": String(MAX_WEBHOOK_PAYLOAD_BYTES + 1),
        "x-github-event": "pull_request",
        "x-github-delivery": randomUUID(),
        "x-hub-signature-256": "sha256=not-read-before-size-check"
      },
      body: "{}"
    }),
    env
  );
  const body = await response.json();

  assert.equal(response.status, 413);
  assert.equal(body.accepted, false);
  assert.equal(body.reason, "payload_too_large");
  assert.equal(body.maxBytes, MAX_WEBHOOK_PAYLOAD_BYTES);
  assert.equal(env.HOSTED_EVENTS.records.size, 0);
});
