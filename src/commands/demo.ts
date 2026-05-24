import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { ShowcaseReport } from "../types.js";
import { scanRepository } from "./scan.js";
import { createReport } from "../report/findings.js";
import { nextSteps } from "../report/launchGate.js";

export async function runShowcase(): Promise<ShowcaseReport> {
  const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
  const risky = await scanRepository({
    rootDir: resolve(packageRoot, "examples", "demo-risky-saas")
  });
  const safe = await scanRepository({
    rootDir: resolve(packageRoot, "examples", "demo-safe-saas")
  });

  return createReport<ShowcaseReport>("demo", packageRoot, risky.findings, {
    demos: {
      risky,
      safe
    },
    nextSteps: nextSteps(risky.findings)
  });
}
