/**
 * esbuild alias shims for node: builtins that do not exist in the Workers isolate.
 *
 * None of these code paths execute in the scan worker:
 * - `node:child_process` execFile: only used by `readGitDiff` in
 *   `src/scanners/gitDiff.ts`, which is bypassed because the worker always
 *   passes explicit `diffText` to `classifyPrRisk`.
 * - `node:fs/promises`: only used by file collectors (never called; the worker
 *   builds its ScanContext in memory) and by `fileMode` in `src/scanners/mcp.ts`,
 *   which catches the failure and treats the mode as unknown.
 * - `node:util` promisify: only wraps execFile at module scope in gitDiff.ts.
 * - `node:path` join/relative: only used by the file collectors.
 *
 * Aliasing keeps the bundle 100% platform-neutral so no nodejs_compat flag is
 * required, and guarantees the real scanner engine (same code as the CLI) runs
 * in the worker instead of a reimplementation.
 */

export function execFile(..._args: unknown[]): never {
  throw new Error("node:child_process is unavailable in the scan worker");
}

type Callback = (err: unknown, ...results: unknown[]) => void;

export function promisify(fn: (...args: unknown[]) => void): (...args: unknown[]) => Promise<unknown> {
  return (...args: unknown[]) =>
    new Promise<unknown>((resolve, reject) => {
      const callback: Callback = (err, ...results) => {
        if (err) {
          reject(err);
          return;
        }
        reject(new Error("node:util.promisify stub is unavailable in the scan worker"));
      };
      try {
        fn(...args, callback);
      } catch (error) {
        reject(error);
      }
    });
}

export async function stat(..._args: unknown[]): Promise<never> {
  throw new Error("node:fs is unavailable in the scan worker");
}

export async function readdir(..._args: unknown[]): Promise<never> {
  throw new Error("node:fs is unavailable in the scan worker");
}

export async function readFile(..._args: unknown[]): Promise<never> {
  throw new Error("node:fs is unavailable in the scan worker");
}

export function join(...parts: string[]): string {
  return parts
    .join("/")
    .replace(/\/{2,}/g, "/")
    .replace(/\/\.\//g, "/");
}

export function relative(_from: string, to: string): string {
  return to;
}

export function resolve(...parts: string[]): string {
  return join(...parts);
}

export function dirname(path: string): string {
  const index = path.lastIndexOf("/");
  return index <= 0 ? "." : path.slice(0, index);
}

export function basename(path: string): string {
  const index = path.lastIndexOf("/");
  return index === -1 ? path : path.slice(index + 1);
}

export function extname(path: string): string {
  const base = basename(path);
  const index = base.lastIndexOf(".");
  return index <= 0 ? "" : base.slice(index);
}
