import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative } from "node:path";

export interface TextFile {
  path: string;
  absolutePath: string;
  content: string;
}

const ignoredDirectories = new Set([
  ".git",
  ".next",
  ".turbo",
  "coverage",
  "dist",
  "build",
  "node_modules",
  "out"
]);

const textFilePattern =
  /(^|\/)(\.env[^/]*|\.mcp\.json|mcp\.json|claude_desktop_config\.json)$|\.(cjs|cts|js|jsx|json|mjs|mts|prisma|sql|toml|ts|tsx|yaml|yml|env|md|txt)$/i;

export async function collectTextFiles(rootDir: string): Promise<TextFile[]> {
  const files: TextFile[] = [];
  const ignores = await loadIgnoreRules(rootDir);
  await walk(rootDir, rootDir, files, ignores);
  return files;
}

async function walk(rootDir: string, currentDir: string, files: TextFile[], ignores: IgnoreRule[]): Promise<void> {
  let entries;
  try {
    entries = await readdir(currentDir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    if (entry.name === ".DS_Store" || entry.name.startsWith("._")) continue;

    const absolutePath = join(currentDir, entry.name);
    const relativePath = toPosix(relative(rootDir, absolutePath));
    if (isIgnored(relativePath, ignores)) continue;

    if (entry.isDirectory()) {
      if (ignoredDirectories.has(entry.name)) continue;
      await walk(rootDir, absolutePath, files, ignores);
      continue;
    }

    if (!entry.isFile() || !textFilePattern.test(relativePath)) continue;

    const fileStat = await stat(absolutePath);
    if (fileStat.size > 1024 * 1024) continue;

    try {
      files.push({
        path: relativePath,
        absolutePath,
        content: await readFile(absolutePath, "utf8")
      });
    } catch {
      continue;
    }
  }
}

export function lineNumberForIndex(content: string, index: number): number {
  let line = 1;
  for (let position = 0; position < index; position += 1) {
    if (content.charCodeAt(position) === 10) line += 1;
  }
  return line;
}

export function lineAt(content: string, lineNumber: number): string {
  return content.split(/\r?\n/)[lineNumber - 1]?.trim() ?? "";
}

export function toPosix(path: string): string {
  return path.split("\\").join("/");
}

export function redactSecret(value: string): string {
  if (value.length <= 10) return "[redacted]";
  return `${value.slice(0, 4)}...[redacted]...${value.slice(-4)}`;
}

export function isLikelyTextPath(path: string): boolean {
  return textFilePattern.test(path);
}

interface IgnoreRule {
  raw: string;
  regex: RegExp;
}

async function loadIgnoreRules(rootDir: string): Promise<IgnoreRule[]> {
  let content = "";
  try {
    content = await readFile(join(rootDir, ".ai-saas-guardignore"), "utf8");
  } catch {
    return [];
  }

  return content
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("#"))
    .map((line) => ({
      raw: line,
      regex: ignorePatternToRegex(line)
    }));
}

function isIgnored(path: string, rules: IgnoreRule[]): boolean {
  return rules.some((rule) => rule.regex.test(path));
}

function ignorePatternToRegex(pattern: string): RegExp {
  const anchored = pattern.startsWith("/");
  const normalized = pattern.replace(/^\/+/, "");
  let regexSource = escapeRegex(normalized)
    .replace(/\\\*\\\*/g, ".*")
    .replace(/\\\*/g, "[^/]*");

  if (normalized.endsWith("/")) {
    regexSource = `${escapeRegex(normalized.slice(0, -1))}(?:/.*)?`;
  }

  if (normalized.endsWith("/**")) {
    regexSource = `${escapeRegex(normalized.slice(0, -3))}(?:/.*)?`;
  }

  return new RegExp(anchored ? `^${regexSource}$` : `(^|/)${regexSource}$|^${regexSource}(?:/|$)`);
}

function escapeRegex(value: string): string {
  return value.replace(/[|\\{}()[\]^$+?.]/g, "\\$&");
}
