import type { McpReport, ScanOptions } from "../types.js";
import { checkMcp as runMcpScanner } from "../scanners/mcp.js";

export function checkMcp(options: ScanOptions): Promise<McpReport> {
  return runMcpScanner(options.rootDir);
}
