import type { ActionsReport, ScanOptions } from "../types.js";
import { checkActions as runActionsScanner } from "../scanners/actions.js";

export function checkActions(options: ScanOptions): Promise<ActionsReport> {
  return runActionsScanner(options.rootDir);
}
