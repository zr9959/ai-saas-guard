import {
  collectTextFilesWithDiagnostics,
  type FileCollectionDiagnostics,
  type TextFile
} from "./utils/files.js";

export interface ScanContext {
  rootDir: string;
  files: readonly TextFile[];
  filesByPath: ReadonlyMap<string, TextFile>;
  fileCollection: FileCollectionDiagnostics;
  getFiles: (predicate?: (file: TextFile) => boolean) => TextFile[];
}

export type ScanInput = string | ScanContext;

export async function createScanContext(rootDir: string): Promise<ScanContext> {
  const collection = await collectTextFilesWithDiagnostics(rootDir);
  const { files } = collection;
  const filesByPath = new Map(files.map((file) => [file.path, file]));

  return {
    rootDir,
    files,
    filesByPath,
    fileCollection: collection.diagnostics,
    getFiles(predicate) {
      return predicate ? files.filter(predicate) : [...files];
    }
  };
}

export async function resolveScanContext(input: ScanInput): Promise<ScanContext> {
  return typeof input === "string" ? createScanContext(input) : input;
}
