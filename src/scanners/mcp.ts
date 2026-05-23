import { stat } from "node:fs/promises";
import type { Finding, McpReport, McpServerInventory, McpSideEffect } from "../types.js";
import { createReport, finding, uniqueFindings } from "../report/findings.js";
import { collectTextFiles, lineAt, redactSecret } from "../utils/files.js";
import { hasSecretLikeValue } from "./secrets.js";

export async function checkMcp(rootDir: string): Promise<McpReport> {
  const files = (await collectTextFiles(rootDir)).filter((file) => isMcpConfigPath(file.path));
  const findings: Finding[] = [];
  const servers: McpServerInventory[] = [];

  for (const file of files) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(file.content);
    } catch {
      findings.push(
        finding({
          ruleId: "mcp.config.invalid-json",
          title: "MCP config is not valid JSON",
          severity: "medium",
          evidence: [{ file: file.path }],
          why: "Broken MCP configs create confusing local-agent behavior and can hide which tools are actually enabled.",
          suggestedVerification: "Parse this config with `node -e \"JSON.parse(require('fs').readFileSync(process.argv[1], 'utf8'))\" <file>`.",
          suggestedFix: "Fix the JSON syntax, then rerun the MCP inventory."
        })
      );
      continue;
    }

    const rawServers = extractServers(parsed);
    for (const [name, config] of Object.entries(rawServers)) {
      const serverText = JSON.stringify(config);
      const tools = extractTools(config);
      const sideEffects = classifySideEffects(config, tools);
      const server: McpServerInventory = {
        name,
        configPath: file.path,
        command: stringValue((config as Record<string, unknown>).command),
        url: stringValue((config as Record<string, unknown>).url),
        tools,
        sideEffects
      };
      servers.push(server);

      if (sideEffects.includes("secret-bearing")) {
        findings.push(
          finding({
            ruleId: "mcp.config.plaintext-secret",
            title: `MCP server ${name} contains plaintext secret-like config`,
            severity: "high",
            evidence: [{ file: file.path, snippet: redactSecret(serverText.slice(0, 160)) }],
            why: "MCP configs are often read by local agents; plaintext credentials can leak through prompts, logs, or tool arguments.",
            suggestedVerification:
              "Inspect the config and shell environment for real API keys, database URLs, and tokens, then rotate any exposed credentials.",
            suggestedFix:
              "Move secrets to scoped environment variables or a secret manager and pass only least-privilege credentials to MCP servers."
          })
        );
      }

      if (/0\.0\.0\.0|\[::\]|--host\s+0\.0\.0\.0|--bind\s+0\.0\.0\.0/i.test(serverText)) {
        findings.push(
          finding({
            ruleId: "mcp.config.non-local-bind",
            title: `MCP server ${name} may bind outside localhost`,
            severity: "high",
            evidence: [{ file: file.path, snippet: lineAt(file.content, findLineContaining(file.content, "0.0.0.0")) }],
            why: "MCP servers should usually bind only to localhost; broad bind addresses can expose tools on the local network.",
            suggestedVerification:
              "Start the server and confirm the listening address is 127.0.0.1 or a Unix socket, not 0.0.0.0.",
            suggestedFix:
              "Configure the server host/bind option to localhost and add firewall rules if remote access is truly required."
          })
        );
      }

      if (/http:\/\/(?!localhost|127\.0\.0\.1|\[::1\])/i.test(serverText)) {
        findings.push(
          finding({
            ruleId: "mcp.config.insecure-http",
            title: `MCP server ${name} uses insecure HTTP for a non-local endpoint`,
            severity: "medium",
            evidence: [{ file: file.path }],
            why: "Plain HTTP can expose tool calls and credentials if traffic leaves the local machine.",
            suggestedVerification: "Confirm whether the endpoint is local-only. If it is remote, inspect transport security and auth.",
            suggestedFix: "Use localhost for local servers or HTTPS with authentication for remote MCP endpoints."
          })
        );
      }

      if (/["']\/["']|allowPaths|filesystem\.write|\bwrite\b|\bdelete\b/i.test(serverText)) {
        findings.push(
          finding({
            ruleId: "mcp.config.broad-filesystem",
            title: `MCP server ${name} has broad filesystem or write access`,
            severity: "high",
            evidence: [{ file: file.path }],
            why: "Prompt-injected tool calls become more dangerous when a server can write files across broad paths.",
            suggestedVerification: "List the exact filesystem roots the server can read and write, then test a denied path.",
            suggestedFix: "Constrain the server to a repo-local directory and prefer read-only tools unless writes are required."
          })
        );
      }

      if (sideEffects.includes("shell")) {
        findings.push(
          finding({
            ruleId: "mcp.tool.shell",
            title: `MCP server ${name} exposes shell-like tools`,
            severity: "high",
            evidence: [{ file: file.path }],
            why: "Generic shell tools turn prompt injection into arbitrary command execution risk.",
            suggestedVerification: "Inventory shell commands this server can run and confirm prompts cannot invoke them without review.",
            suggestedFix: "Replace generic shell access with narrow parameterized tools or add allow/deny policy gates."
          })
        );
      }

      if (sideEffects.includes("database")) {
        findings.push(
          finding({
            ruleId: "mcp.tool.raw-sql",
            title: `MCP server ${name} exposes database or raw SQL capability`,
            severity: "high",
            evidence: [{ file: file.path }],
            why: "Raw SQL tools can read or mutate production data if credentials are over-scoped.",
            suggestedVerification: "Confirm database credentials are read-only and scoped to non-production unless write access is intentional.",
            suggestedFix: "Use least-privilege credentials and replace raw SQL with narrow read-only queries where possible."
          })
        );
      }

      const mode = await fileMode(file.absolutePath);
      if (mode !== undefined && (mode & 0o077) !== 0) {
        findings.push(
          finding({
            ruleId: "mcp.config.loose-permissions",
            title: "MCP config file is readable by group or other users",
            severity: "low",
            evidence: [{ file: file.path, match: `mode ${mode.toString(8)}` }],
            why: "Loose permissions matter when MCP configs contain credentials or sensitive local paths.",
            suggestedVerification: "Run `ls -l` on the config and confirm only the owning user can read secret-bearing files.",
            suggestedFix: "Run `chmod 600 <config>` for secret-bearing MCP config files."
          })
        );
      }
    }
  }

  return createReport<McpReport>("check-mcp", rootDir, uniqueFindings(findings), {
    servers,
    tools: [...new Set(servers.flatMap((server) => server.tools))].sort()
  });
}

function isMcpConfigPath(path: string): boolean {
  return /(^|\/)(\.mcp\.json|mcp\.json|claude_desktop_config\.json|mcp-config\.json)$/i.test(path) || path.includes(".cursor/mcp");
}

function extractServers(parsed: unknown): Record<string, unknown> {
  if (!parsed || typeof parsed !== "object") return {};
  const root = parsed as Record<string, unknown>;
  const candidates = root.mcpServers ?? root.servers ?? root;
  return candidates && typeof candidates === "object" ? (candidates as Record<string, unknown>) : {};
}

function extractTools(config: unknown): string[] {
  if (!config || typeof config !== "object") return [];
  const record = config as Record<string, unknown>;
  const tools = record.tools;
  if (Array.isArray(tools)) return tools.map((tool) => String(tool));
  if (tools && typeof tools === "object") return Object.keys(tools);
  return [];
}

function classifySideEffects(config: unknown, tools: string[]): McpSideEffect[] {
  const text = JSON.stringify(config).toLowerCase();
  const sideEffects = new Set<McpSideEffect>();

  if (/write|delete|mutate|filesystem\.write|allowpaths/.test(text)) sideEffects.add("write");
  if (/http|url|fetch|browser|network/.test(text)) sideEffects.add("network");
  if (/shell|exec|bash|zsh|terminal|command/.test(text) || tools.some((tool) => /shell|exec|terminal/i.test(tool))) sideEffects.add("shell");
  if (/sql|database|postgres|mysql|sqlite|supabase|database_url/.test(text)) sideEffects.add("database");
  if (/(secret|token|api[_-]?key|password|database_url)/i.test(text) && hasSecretLikeValue(text)) sideEffects.add("secret-bearing");
  if (sideEffects.size === 0) sideEffects.add("read-only");

  return [...sideEffects];
}

function stringValue(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function findLineContaining(content: string, value: string): number {
  const lines = content.split(/\r?\n/);
  const index = lines.findIndex((line) => line.includes(value));
  return index >= 0 ? index + 1 : 1;
}

async function fileMode(path: string): Promise<number | undefined> {
  try {
    return (await stat(path)).mode & 0o777;
  } catch {
    return undefined;
  }
}
