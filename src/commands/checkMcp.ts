import type { McpOptions, McpReport } from "../types.js";
import { checkMcp as runMcpScanner } from "../scanners/mcp.js";

export function checkMcp(options: McpOptions): Promise<McpReport> {
  return runMcpScanner(options.rootDir, { policyTemplate: options.policyTemplate });
}
