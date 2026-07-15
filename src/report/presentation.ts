import type { BaseReport, Evidence, Summary } from "../types.js";

const terminalControlPattern = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f-\u009f]/g;
const ESCAPE = 0x1b;
const BELL = 0x07;
const CSI_OPEN = 0x5b;
const OSC_OPEN = 0x5d;
const STRING_TERMINATOR = 0x5c;

export function formatSummaryCounts(summary: Summary): string {
  if (summary.total === 0) return "0 findings";
  return `${summary.total} ${summary.total === 1 ? "finding" : "findings"} | ${summary.critical} critical | ${summary.high} high | ${summary.medium} medium | ${summary.low} low | ${summary.info} info`;
}

export function formatEvidenceLocation(evidence: Evidence | undefined): string | undefined {
  if (!evidence) return undefined;
  const line = evidence.line === undefined ? "" : `:${evidence.line}`;
  const column = evidence.column === undefined ? "" : `:${evidence.column}`;
  return `${evidence.file}${line}${column}`;
}

export function sanitizeTerminalInline(value: string): string {
  return stripTerminalEscapeSequences(value)
    .replace(terminalControlPattern, "")
    .replace(/[\r\n]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function escapeMarkdownInline(value: string): string {
  const normalized = normalizeInline(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
  const segments = normalized.split("`");

  if (segments.length % 2 === 1) {
    return segments
      .map((segment, index) => index % 2 === 0 ? escapeMarkdownSyntax(segment) : segment)
      .join("`");
  }

  return escapeMarkdownSyntax(normalized.replaceAll("`", "'"));
}

export function markdownCode(value: string): string {
  const safe = normalizeInline(value).replaceAll("`", "'");
  return `\`${safe}\``;
}

export function hasIncompleteScanCoverage(report: BaseReport): boolean {
  const collection = report.fileCollection;
  const malformedPackages = report.stackInventory?.warnings.some(
    (warning) => warning.reason === "invalid_package_json"
  ) ?? false;
  if (!collection) return malformedPackages;
  return (
    collection.filesScanned === 0 ||
    collection.unreadableFiles.length > 0 ||
    collection.unreadableDirectories.length > 0 ||
    collection.skippedLargeFiles.length > 0 ||
    collection.skippedBudgetFiles.length > 0 ||
    collection.maxFilesReached ||
    collection.maxTotalBytesReached ||
    malformedPackages
  );
}

export function formatScanCoverage(report: BaseReport): string | undefined {
  const parts: string[] = [];
  const collection = report.fileCollection;
  if (collection && hasIncompleteScanCoverage(report)) {
    const unreadableFileCount = collection.unreadableFiles.length;
    const unreadableDirectoryCount = collection.unreadableDirectories.length;
    const skippedLargeCount = collection.skippedLargeFiles.length;
    const skippedBudgetCount = collection.skippedBudgetFiles.length;
    parts.push(`${collection.filesScanned} ${plural(collection.filesScanned, "file")} scanned`);
    if (unreadableFileCount > 0) parts.push(`${unreadableFileCount} unreadable ${plural(unreadableFileCount, "file")}`);
    if (unreadableDirectoryCount > 0) {
      parts.push(`${unreadableDirectoryCount} unreadable ${plural(unreadableDirectoryCount, "directory", "directories")}`);
    }
    if (skippedLargeCount > 0) parts.push(`${skippedLargeCount} large ${plural(skippedLargeCount, "file")} skipped`);
    if (skippedBudgetCount > 0) parts.push(`${skippedBudgetCount} budget-skipped ${plural(skippedBudgetCount, "file")}`);
    if (collection.maxFilesReached) parts.push("file count budget reached");
    if (collection.maxTotalBytesReached) parts.push("total byte budget reached");
  }

  const malformedPackageCount =
    report.stackInventory?.warnings.filter((warning) => warning.reason === "invalid_package_json").length ?? 0;
  if (malformedPackageCount > 0) {
    parts.push(`${malformedPackageCount} malformed package ${plural(malformedPackageCount, "manifest")}`);
  }

  return parts.length > 0 ? parts.join("; ") : undefined;
}

function normalizeInline(value: string): string {
  return value
    .replace(terminalControlPattern, "")
    .replace(/[\r\n]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function stripTerminalEscapeSequences(value: string): string {
  const parts: string[] = [];
  let index = 0;
  let textStart = 0;

  while (index < value.length) {
    if (value.charCodeAt(index) !== ESCAPE) {
      index += 1;
      continue;
    }

    if (textStart < index) parts.push(value.slice(textStart, index));
    index = skipTerminalEscapeSequence(value, index);
    textStart = index;
  }

  if (textStart < value.length) parts.push(value.slice(textStart));
  return parts.join("");
}

function skipTerminalEscapeSequence(value: string, escapeIndex: number): number {
  const nextIndex = escapeIndex + 1;
  if (nextIndex >= value.length) return value.length;
  const kind = value.charCodeAt(nextIndex);

  if (kind === CSI_OPEN) {
    let cursor = nextIndex + 1;
    while (cursor < value.length && isCodeInRange(value, cursor, 0x30, 0x3f)) cursor += 1;
    while (cursor < value.length && isCodeInRange(value, cursor, 0x20, 0x2f)) cursor += 1;
    if (cursor < value.length && isCodeInRange(value, cursor, 0x40, 0x7e)) cursor += 1;
    return cursor;
  }

  if (kind === OSC_OPEN) {
    let cursor = nextIndex + 1;
    while (cursor < value.length) {
      const code = value.charCodeAt(cursor);
      if (code === BELL) return cursor + 1;
      if (code === ESCAPE && value.charCodeAt(cursor + 1) === STRING_TERMINATOR) return cursor + 2;
      cursor += 1;
    }
    return value.length;
  }

  return Math.min(value.length, escapeIndex + 2);
}

function isCodeInRange(value: string, index: number, lower: number, upper: number): boolean {
  const code = value.charCodeAt(index);
  return code >= lower && code <= upper;
}

function escapeMarkdownSyntax(value: string): string {
  return value
    .replace(/([\\*_[\]])/g, "\\$1")
    .replaceAll("|", "\\|");
}

function plural(count: number, singular: string, pluralValue = `${singular}s`): string {
  return count === 1 ? singular : pluralValue;
}
