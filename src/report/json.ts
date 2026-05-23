import type { BaseReport } from "../types.js";

export function formatJsonReport(report: BaseReport): string {
  return `${JSON.stringify(report, null, 2)}\n`;
}
