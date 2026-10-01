#!/usr/bin/env node
/**
 * Build the staging source-checkout worker bundle.
 *
 * Bundles src/hosted/scan-worker/worker.ts (the real CLI scanner engine)
 * into a single platform-neutral ESM file with esbuild. node: builtins that
 * do not exist in the Workers isolate are aliased to
 * src/hosted/scan-worker/node-shims.ts; none of those code paths execute in
 * the worker (see the shims file for the audit).
 *
 * Usage:
 *   node hosted/source-checkout-worker/build-bundle.mjs [--out /tmp/ai-saas-guard-scan-worker.mjs]
 */
import { execFile } from "node:child_process";
import { stat } from "node:fs/promises";
import { promisify } from "node:util";

const execFileAsync = promisify(execFile);

const args = process.argv.slice(2);
const outIndex = args.indexOf("--out");
const outFile = outIndex === -1 ? "/tmp/ai-saas-guard-scan-worker.mjs" : args[outIndex + 1];
if (!outFile) throw new Error("--out requires a path");

const repoRoot = new URL("../../", import.meta.url).pathname.replace(/\/+$/, "");
const shims = `${repoRoot}/src/hosted/scan-worker/node-shims.ts`;

await execFileAsync(
  "npx",
  [
    "--yes",
    "esbuild",
    `${repoRoot}/src/hosted/scan-worker/worker.ts`,
    "--bundle",
    "--format=esm",
    "--platform=neutral",
    "--main-fields=module,main",
    "--minify",
    `--alias:node:child_process=${shims}`,
    `--alias:node:fs/promises=${shims}`,
    `--alias:node:util=${shims}`,
    `--alias:node:path=${shims}`,
    `--outfile=${outFile}`,
    "--log-level=warning"
  ],
  { cwd: repoRoot, maxBuffer: 16 * 1024 * 1024 }
);

const info = await stat(outFile);
console.log(JSON.stringify({ bundle: outFile, bytes: info.size }));
