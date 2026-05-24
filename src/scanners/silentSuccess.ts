import type { Finding } from "../types.js";
import type { ScanInput } from "../context.js";
import { resolveScanContext } from "../context.js";
import { finding, uniqueFindings } from "../report/findings.js";
import { lineAt, lineNumberForIndex } from "../utils/files.js";

const codeFilePattern = /\.(?:[cm]?[jt]sx?)$/i;
const sensitivePathPattern = /(^|\/)(app\/api|pages\/api|api|routes?|controllers?|auth|billing|stripe|payment|webhook|supabase|openai|ai|data|mutation|server)(\/|\.|-|$)/i;
const sensitiveContentPattern = /\b(stripe|supabase|openai|payment|billing|checkout|subscription|auth|session|webhook|entitlement|insert|update|delete|upsert|mutate)\b/i;
const safeFailurePattern = /\b(console\.(error|warn)|logger\.(error|warn)|throw\b|return\s+new\s+Response\s*\([^)]*status\s*:\s*(4|5)\d\d|NextResponse\.json\s*\([^)]*status\s*:\s*(4|5)\d\d|Response\.json\s*\([^)]*status\s*:\s*(4|5)\d\d|degraded\s*:\s*true|error\s*:|ok\s*:\s*false)\b/is;
const fakeSuccessPattern = /\b(return\s+)?(?:NextResponse|Response)\.json\s*\(\s*(?:\{\s*)?(?:success\s*:\s*true|ok\s*:\s*true|data\s*:\s*(?:\{\s*\}|\[\s*\]|null)|subscription\s*:\s*(?:mock|demo|sample|fallback)|user\s*:\s*null)|return\s+(?:\{\s*\}|\[\s*\]|null|true)\b/is;
const mockDataPattern = /\b(mock|fixture|fixtures|demo|sample|stub|fake)\b/i;
const bypassPattern = /\b(TODO\s*:?\s*(auth|verify|validation|rate|owner|webhook)|temporary\s+bypass|temp\s+bypass|skip\s+(auth|verification|validation|ownership|webhook)|disable\s+(auth|verification|validation)|SKIP_(AUTH|WEBHOOK|VERIFICATION|VALIDATION)|ALLOW_UNVERIFIED)\b/i;
const assertionPattern = /\b(expect\s*\(|assert\.|assert\s*\(|t\.is\s*\(|t\.true\s*\(|should\.|toEqual\s*\(|toBe\s*\(|toMatch\s*\()/i;
const truthyOnlyPattern = /\b(expect\s*\([^)]*\)\.(toBeTruthy|toBeDefined|toBeOk)\s*\(\s*\)|assert\.ok\s*\([^)]*\)|t\.truthy\s*\([^)]*\))/i;

export async function scanSilentSuccess(input: ScanInput): Promise<Finding[]> {
  const context = await resolveScanContext(input);
  const findings: Finding[] = [];

  for (const file of context.getFiles((candidate) => codeFilePattern.test(candidate.path))) {
    const isTest = isTestFile(file.path);
    const isSensitive = isSensitiveProductionFile(file.path, file.content);

    if (isTest) {
      findings.push(...scanTestIntegrity(file.path, file.content));
      continue;
    }

    if (!isSensitive) continue;

    findings.push(...scanSwallowedErrors(file.path, file.content));
    findings.push(...scanProductionMockData(file.path, file.content));
    findings.push(...scanHardcodedFallbacks(file.path, file.content));
    findings.push(...scanTemporaryBypasses(file.path, file.content));
  }

  return uniqueFindings(findings);
}

function scanSwallowedErrors(filePath: string, content: string): Finding[] {
  const findings: Finding[] = [];

  for (const block of findCatchBlocks(content)) {
    if (fakeSuccessPattern.test(block.text) && !safeFailurePattern.test(block.text)) {
      findings.push(
        finding({
          ruleId: "silent-success.swallowed-error",
          title: `Catch block may turn upstream failure into success: ${filePath}`,
          severity: "high",
          evidence: [{ file: filePath, line: block.line, snippet: lineAt(content, block.line) }],
          why: "AI-generated SaaS code often hides integration failures by returning empty, null, or success-shaped data after an exception.",
          suggestedVerification:
            "Force the upstream API, auth provider, billing provider, or database call to fail and confirm the route returns an error or disclosed degraded mode, not a fake success.",
          suggestedFix:
            "Log the failure, return an explicit error status or degraded response, and avoid granting access or mutating state after the failed dependency."
        })
      );
    }
  }

  for (const match of content.matchAll(/\.catch\s*\([^)]*=>\s*(?:\(\s*)?(?:\{\s*\}|\[\s*\]|null|true|\{\s*(?:success|ok)\s*:\s*true)/gi)) {
    const line = lineNumberForIndex(content, match.index ?? 0);
    findings.push(
      finding({
        ruleId: "silent-success.swallowed-error",
        title: `Promise catch may hide upstream failure: ${filePath}`,
        severity: "high",
        evidence: [{ file: filePath, line, snippet: lineAt(content, line) }],
        why: "A `.catch()` fallback that returns default success data can make failed integrations look healthy before launch.",
        suggestedVerification:
          "Make the promise reject in a local test and confirm callers receive an error or disclosed degraded mode.",
        suggestedFix:
          "Propagate the error or return an explicit failure response with logging and no entitlement or ownership side effect."
      })
    );
  }

  return findings;
}

function scanProductionMockData(filePath: string, content: string): Finding[] {
  const findings: Finding[] = [];

  for (const match of content.matchAll(/^\s*import\s+[^;]*(?:fixture|fixtures|mock|mocks|demo|sample|stub|fake)[^;]*;?/gim)) {
    const line = lineNumberForIndex(content, match.index ?? 0);
    findings.push(
      finding({
        ruleId: "silent-success.production-mock-data",
        title: `Production-sensitive path imports mock or demo data: ${filePath}`,
        severity: "medium",
        evidence: [{ file: filePath, line, snippet: lineAt(content, line) }],
        why: "Mock, fixture, demo, or sample data in auth, billing, API, AI, or data mutation paths can make launch tests pass without real integrations.",
        suggestedVerification:
          "Run the route with real provider credentials disabled and confirm it does not return fixture/demo data as if it came from production.",
        suggestedFix:
          "Keep fixtures under tests or local demos only, and make production fallback behavior explicit with errors or degraded-mode metadata."
      })
    );
  }

  if (/(^|\/)(fixtures?|mocks?|demo|samples?)(\/|$)/i.test(filePath)) {
    const line = firstLine(content, mockDataPattern) ?? 1;
    findings.push(
      finding({
        ruleId: "silent-success.production-mock-data",
        title: `Mock or demo data file appears reachable from production scan surface: ${filePath}`,
        severity: "low",
        evidence: [{ file: filePath, line, snippet: lineAt(content, line) }],
        why: "Fixture and demo data should stay isolated from production launch paths.",
        suggestedVerification:
          "Trace imports of this file and confirm no server route, billing path, auth path, or data mutation imports it.",
        suggestedFix:
          "Move mock data under tests or examples, or rename and document it as a non-production-only asset."
      })
    );
  }

  return findings;
}

function scanHardcodedFallbacks(filePath: string, content: string): Finding[] {
  const findings: Finding[] = [];
  const fallbackPattern = /(fallback|mock|demo|sample|stub|fake)[\s\S]{0,180}(Response\.json|NextResponse\.json|success\s*:\s*true|ok\s*:\s*true|active|subscription|entitlement)/gi;

  for (const match of content.matchAll(fallbackPattern)) {
    const index = match.index ?? 0;
    const window = content.slice(Math.max(0, index - 180), index + match[0].length + 180);
    if (/degraded\s*:\s*true|status\s*:\s*(4|5)\d\d|error\s*:/i.test(window)) continue;
    const line = lineNumberForIndex(content, index);
    findings.push(
      finding({
        ruleId: "silent-success.hardcoded-fallback",
        title: `Sensitive path contains a hardcoded fallback response: ${filePath}`,
        severity: "high",
        evidence: [{ file: filePath, line, snippet: lineAt(content, line) }],
        why: "Hardcoded fallback responses in auth, Stripe, Supabase, OpenAI, payment, or entitlement paths can grant access or hide broken integrations.",
        suggestedVerification:
          "Disable the real upstream provider and confirm the route does not return hardcoded active subscriptions, successful auth, or generated sample data.",
        suggestedFix:
          "Replace hardcoded success fallbacks with explicit error/degraded responses and a launch checklist item for real provider verification."
      })
    );
  }

  return findings;
}

function scanTemporaryBypasses(filePath: string, content: string): Finding[] {
  const findings: Finding[] = [];

  for (const match of content.matchAll(new RegExp(bypassPattern.source, "gi"))) {
    const line = lineNumberForIndex(content, match.index ?? 0);
    findings.push(
      finding({
        ruleId: "silent-success.temporary-bypass",
        title: `Temporary bypass language in trust-boundary path: ${filePath}`,
        severity: "high",
        evidence: [{ file: filePath, line, snippet: lineAt(content, line) }],
        why: "Temporary auth, rate-limit, webhook, validation, or ownership bypasses are easy to forget in AI-built launch paths.",
        suggestedVerification:
          "Run the auth/rate-limit/webhook/ownership path with the bypass disabled and confirm unauthorized or unverified requests fail closed.",
        suggestedFix:
          "Remove the bypass before launch, or gate it behind non-production-only configuration with tests proving production fails closed."
      })
    );
  }

  return findings;
}

function scanTestIntegrity(filePath: string, content: string): Finding[] {
  const findings: Finding[] = [];

  for (const match of content.matchAll(/\b(?:describe|it|test)\.skip\s*\(/gi)) {
    const line = lineNumberForIndex(content, match.index ?? 0);
    findings.push(testFinding(filePath, content, line, "Skipped test in launch-risk area"));
  }

  for (const testCase of findTestBlocks(content)) {
    const body = testCase.body.trim();
    if (
      body.length === 0 ||
      /^\/\/\s*TODO\b/i.test(body) ||
      !assertionPattern.test(body) ||
      (truthyOnlyPattern.test(body) && !/\b(toEqual|toStrictEqual|toBe\(|toMatch|toHave|rejects|resolves)\b/i.test(body))
    ) {
      findings.push(testFinding(filePath, content, testCase.line, "Weak or placeholder test may create fake confidence"));
    }
  }

  return findings;
}

function testFinding(filePath: string, content: string, line: number, title: string): Finding {
  return finding({
    ruleId: "silent-success.weakened-test",
    title: `${title}: ${filePath}`,
    severity: "medium",
    evidence: [{ file: filePath, line, snippet: lineAt(content, line) }],
    why: "AI agents often keep test suites green by skipping tests, replacing bodies with TODOs, or asserting only truthiness.",
    suggestedVerification:
      "Run the test with the real auth, billing, webhook, or data failure case and confirm it would fail before the fix.",
    suggestedFix:
      "Restore behavior assertions for status codes, ownership, webhook verification, provider failure, and state changes instead of placeholder truthy checks."
  });
}

function isSensitiveProductionFile(path: string, content: string): boolean {
  return !isTestFile(path) && (sensitivePathPattern.test(path) || sensitiveContentPattern.test(content));
}

function isTestFile(path: string): boolean {
  return /(^|\/)(__tests__|tests?|specs?)\//i.test(path) || /\.(test|spec)\.[cm]?[jt]sx?$/i.test(path);
}

function findCatchBlocks(content: string): Array<{ text: string; line: number }> {
  const blocks: Array<{ text: string; line: number }> = [];
  const catchPattern = /catch\s*(?:\([^)]*\))?\s*\{/gi;

  for (const match of content.matchAll(catchPattern)) {
    const start = (match.index ?? 0) + match[0].length - 1;
    const end = findMatchingBrace(content, start);
    if (end <= start) continue;
    blocks.push({
      text: content.slice(start, end + 1),
      line: lineNumberForIndex(content, match.index ?? 0)
    });
  }

  return blocks;
}

function findTestBlocks(content: string): Array<{ body: string; line: number }> {
  const blocks: Array<{ body: string; line: number }> = [];
  const testPattern = /\b(?:test|it)\s*\(\s*["'`][^"'`]+["'`]\s*,\s*(?:async\s*)?\([^)]*\)\s*=>\s*\{/gi;

  for (const match of content.matchAll(testPattern)) {
    const start = (match.index ?? 0) + match[0].length - 1;
    const end = findMatchingBrace(content, start);
    if (end <= start) continue;
    blocks.push({
      body: content.slice(start + 1, end),
      line: lineNumberForIndex(content, match.index ?? 0)
    });
  }

  return blocks;
}

function findMatchingBrace(content: string, openBrace: number): number {
  let depth = 0;
  let inSingle = false;
  let inDouble = false;
  let inTemplate = false;

  for (let index = openBrace; index < content.length; index += 1) {
    const char = content[index];
    const prev = content[index - 1];
    if (prev === "\\") continue;
    if (char === "'" && !inDouble && !inTemplate) inSingle = !inSingle;
    if (char === "\"" && !inSingle && !inTemplate) inDouble = !inDouble;
    if (char === "`" && !inSingle && !inDouble) inTemplate = !inTemplate;
    if (inSingle || inDouble || inTemplate) continue;
    if (char === "{") depth += 1;
    if (char === "}") {
      depth -= 1;
      if (depth === 0) return index;
    }
  }

  return -1;
}

function firstLine(content: string, pattern: RegExp): number | undefined {
  const match = pattern.exec(content);
  pattern.lastIndex = 0;
  return match ? lineNumberForIndex(content, match.index) : undefined;
}
