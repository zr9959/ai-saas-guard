import type { PrRiskOptions, PrRiskReport } from "../types.js";
import { classifyPrRisk as runPrRiskScanner } from "../scanners/gitDiff.js";

export function classifyPrRisk(options: PrRiskOptions): Promise<PrRiskReport> {
  return runPrRiskScanner(options);
}
