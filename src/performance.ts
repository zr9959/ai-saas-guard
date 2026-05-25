import {
  DEFAULT_MAX_TEXT_FILE_BYTES,
  DEFAULT_MAX_TEXT_FILES,
  DEFAULT_MAX_TOTAL_TEXT_BYTES
} from "./utils/files.js";

export interface LocalScanResourceBudgetInput {
  repositoryKind?: string;
  maxFiles?: number;
  maxTotalBytes?: number;
  maxFileBytes?: number;
}

export interface LocalScanResourceBudget {
  repositoryKind: string;
  localFirst: true;
  deterministic: true;
  uploadsCode: false;
  callsLlm: false;
  limits: {
    maxFiles: number;
    maxTotalBytes: number;
    maxFileBytes: number;
  };
  ignoredDirectories: string[];
  operatorNote: string;
}

export function createLocalScanResourceBudget(
  input: LocalScanResourceBudgetInput = {}
): LocalScanResourceBudget {
  return {
    repositoryKind: input.repositoryKind ?? "ai-built-saas",
    localFirst: true,
    deterministic: true,
    uploadsCode: false,
    callsLlm: false,
    limits: {
      maxFiles: positiveIntegerOrDefault(input.maxFiles, DEFAULT_MAX_TEXT_FILES),
      maxTotalBytes: positiveIntegerOrDefault(
        input.maxTotalBytes,
        DEFAULT_MAX_TOTAL_TEXT_BYTES
      ),
      maxFileBytes: positiveIntegerOrDefault(input.maxFileBytes, DEFAULT_MAX_TEXT_FILE_BYTES)
    },
    ignoredDirectories: [".git", ".next", ".turbo", "coverage", "dist", "build", "node_modules", "out"],
    operatorNote:
      "This keeps local scans bounded for large AI SaaS repositories without uploading code or calling an LLM."
  };
}

function positiveIntegerOrDefault(value: number | undefined, fallback: number): number {
  if (value === undefined) return fallback;
  const normalized = Math.floor(value);
  return Number.isFinite(normalized) && normalized > 0 ? normalized : fallback;
}
