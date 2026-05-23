import { collectTextFiles, type TextFile } from "./utils/files.js";

export interface ScanContext {
  rootDir: string;
  files: readonly TextFile[];
  filesByPath: ReadonlyMap<string, TextFile>;
  getFiles: (predicate?: (file: TextFile) => boolean) => TextFile[];
}

export type ScanInput = string | ScanContext;

export async function createScanContext(rootDir: string): Promise<ScanContext> {
  const files = await collectTextFiles(rootDir);
  const filesByPath = new Map(files.map((file) => [file.path, file]));

  return {
    rootDir,
    files,
    filesByPath,
    getFiles(predicate) {
      return predicate ? files.filter(predicate) : [...files];
    }
  };
}

export async function resolveScanContext(input: ScanInput): Promise<ScanContext> {
  return typeof input === "string" ? createScanContext(input) : input;
}
