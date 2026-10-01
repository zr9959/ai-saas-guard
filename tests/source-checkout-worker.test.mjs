import assert from "node:assert/strict";
import { test } from "node:test";

import {
  SCAN_JOB_LIMITS,
  STAGING_ALLOWED_REPOSITORIES,
  STAGING_PRIVACY_FLAGS,
  ScanJobValidationError,
  buildScanJobKey,
  validateScanJobRequest
} from "../dist/hosted/scan-worker/job.js";
import { MAX_COMPACT_FINDINGS, runSourceScan } from "../dist/hosted/scan-worker/engine.js";

const HEAD = "a".repeat(40);
const BASE = "b".repeat(40);

const FIXTURE_DIFF = `diff --git a/app/api/staging-trial/route.ts b/app/api/staging-trial/route.ts
new file mode 100644
index 0000000..1111111 100644
--- /dev/null
+++ b/app/api/staging-trial/route.ts
@@ -0,0 +1,11 @@
+// STAGING TRIAL FIXTURE
+export async function POST(request: Request) {
+  try {
+    const body = await request.json();
+    return Response.json({ ok: true, echo: body });
+  } catch {
+    return Response.json({ success: true, user: null });
+  }
+}
`;

const FIXTURE_CONTENT = `// STAGING TRIAL FIXTURE
export async function POST(request: Request) {
  try {
    const body = await request.json();
    return Response.json({ ok: true, echo: body });
  } catch {
    return Response.json({ success: true, user: null });
  }
}
`;

function goodBody() {
  return {
    repositoryFullName: "zr9959/ai-saas-guard",
    pullRequestNumber: 999,
    baseSha: BASE,
    headSha: HEAD,
    diffText: FIXTURE_DIFF,
    files: [{ path: "app/api/staging-trial/route.ts", content: FIXTURE_CONTENT }]
  };
}

test("validateScanJobRequest accepts a well-formed staging job", () => {
  const job = validateScanJobRequest(goodBody());
  assert.equal(job.repositoryFullName, "zr9959/ai-saas-guard");
  assert.equal(job.pullRequestNumber, 999);
  assert.equal(job.headSha, HEAD);
  assert.equal(job.files.length, 1);
  assert.match(job.jobKey, /^scan:staging:zr9959:ai-saas-guard:999:/);
});

test("validateScanJobRequest rejects repos outside the staging allowlist", () => {
  assert.ok(STAGING_ALLOWED_REPOSITORIES.has("zr9959/ai-saas-guard"));
  assert.throws(() => validateScanJobRequest({ ...goodBody(), repositoryFullName: "evil/repo" }), (error) => {
    assert.ok(error instanceof ScanJobValidationError);
    assert.equal(error.code, "repository_not_allowed");
    return true;
  });
});

test("validateScanJobRequest rejects malformed SHAs, PR numbers, and paths", () => {
  const expectCode = (fn, code) =>
    assert.throws(fn, (error) => error instanceof ScanJobValidationError && error.code === code);
  expectCode(() => validateScanJobRequest({ ...goodBody(), headSha: "short" }), "invalid_sha");
  expectCode(() => validateScanJobRequest({ ...goodBody(), pullRequestNumber: 0 }), "invalid_pr_number");
  expectCode(
    () => validateScanJobRequest({ ...goodBody(), files: [{ path: "../escape.ts", content: "x" }] }),
    "invalid_file_path"
  );
  expectCode(() => validateScanJobRequest({ ...goodBody(), diffText: "" }), "diff_required");
  expectCode(() => validateScanJobRequest({ ...goodBody(), files: [] }), "files_required");
});

test("validateScanJobRequest enforces staging size caps", () => {
  const tooMany = Array.from({ length: SCAN_JOB_LIMITS.maxFiles + 1 }, (_, i) => ({
    path: `f${i}.ts`,
    content: "x"
  }));
  assert.throws(
    () => validateScanJobRequest({ ...goodBody(), files: tooMany }),
    (error) => error instanceof ScanJobValidationError && error.code === "too_many_files"
  );
});

test("buildScanJobKey is deterministic and charset-safe", () => {
  const key = buildScanJobKey({ repositoryFullName: "zr9959/ai-saas-guard", pullRequestNumber: 42, headSha: "c".repeat(40) });
  assert.equal(key, `scan:staging:zr9959:ai-saas-guard:42:${"c".repeat(40)}`);
});

test("runSourceScan runs the real pr-risk engine over the diff", async () => {
  const job = validateScanJobRequest(goodBody());
  const result = await runSourceScan(job, { scannerVersion: "0.43.3" });
  assert.equal(result.status, "completed");
  assert.equal(result.scannerEngine, "cli-identical");
  assert.equal(result.headSha, HEAD);
  assert.deepEqual(
    result.stages.map((s) => s.id),
    ["validate", "pr_risk", "full_scan", "compact"]
  );
  assert.ok(result.stages.every((s) => s.ok));
  assert.ok(result.prRisk.categories.includes("silent-success/fake-green"), "pr-risk must flag the fake-success catch");
  assert.ok(result.prRisk.categories.includes("API contract"), "pr-risk must flag the API route surface");
  const risky = result.prRisk.topRiskyFiles.find((f) => f.path === "app/api/staging-trial/route.ts");
  assert.ok(risky, "fixture must appear in the review queue");
  assert.ok(result.summaryCounts.total >= 1, "the full scan suite must produce findings");
  assert.ok(
    result.compactFindings.some((f) => f.ruleId === "silent-success.swallowed-error"),
    "content scanners must run, not just diff classification"
  );
});

test("runSourceScan compacts findings without raw source, diffs, or PR text", async () => {
  const job = validateScanJobRequest(goodBody());
  const result = await runSourceScan(job, { scannerVersion: "0.43.3" });
  assert.ok(result.compactFindingCount <= MAX_COMPACT_FINDINGS);
  const blob = JSON.stringify(result);
  assert.ok(!blob.includes("Response.json({ success: true, user: null })"), "raw source must not leak");
  assert.ok(!blob.includes("new file mode"), "raw diff must not leak");
  for (const finding of result.compactFindings) {
    assert.deepEqual(Object.keys(finding).sort(), ["file", "line", "ruleId", "severity"].filter((k) => k in finding).sort());
    assert.ok(!("match" in finding || "snippet" in finding || "why" in finding), "no excerpts in compact findings");
  }
});

test("staging privacy flags deny all raw/secret persistence", () => {
  for (const value of Object.values(STAGING_PRIVACY_FLAGS)) {
    assert.equal(value, false);
  }
});
