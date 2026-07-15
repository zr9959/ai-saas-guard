import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { tmpdir } from "node:os";
import { test } from "node:test";

import fc from "fast-check";

import { scanRepository } from "../dist/index.js";
import { formatMarkdownReport } from "../dist/report/markdown.js";
import { formatSarifReport } from "../dist/report/sarif.js";

const fuzzSeed = 20260524;

function baseReport(overrides = {}) {
  return {
    command: "scan",
    rootDir: ".",
    generatedAt: "2026-05-24T00:00:00.000Z",
    findings: [],
    summary: {
      critical: 0,
      high: 0,
      medium: 0,
      low: 0,
      info: 0,
      total: 0
    },
    ...overrides
  };
}

function findingFromText(text) {
  return {
    ruleId: "secrets.detected",
    title: `Fuzzed title ${text}`,
    severity: "high",
    evidence: [
      {
        file: "src/example.ts",
        line: 1,
        snippet: `prefix ${text}\n### injected heading\n| injected | table |`
      }
    ],
    why: `why ${text}\n### injected why`,
    suggestedVerification: `verify ${text}\n### injected verify`,
    suggestedFix: `fix ${text}\n### injected fix`
  };
}

test("fuzz: markdown report keeps arbitrary evidence from creating structure", () => {
  fc.assert(
    fc.property(fc.string({ maxLength: 160 }), (text) => {
      const markdown = formatMarkdownReport(
        baseReport({
          findings: [findingFromText(text)],
          summary: {
            critical: 0,
            high: 1,
            medium: 0,
            low: 0,
            info: 0,
            total: 1
          }
        })
      );

      assert.doesNotMatch(markdown, /^### injected/m);
      assert.doesNotMatch(markdown, /^\| injected \| table \|$/m);
      assert.match(markdown, /\*\*Evidence 1:\*\* `src\/example\.ts:1` - prefix/);
    }),
    { numRuns: 120, seed: fuzzSeed }
  );
});

test("fuzz: SARIF report remains valid JSON for arbitrary finding text", () => {
  fc.assert(
    fc.property(fc.string({ maxLength: 240 }), (text) => {
      const sarif = JSON.parse(
        formatSarifReport(
          baseReport({
            findings: [findingFromText(text)],
            summary: {
              critical: 0,
              high: 1,
              medium: 0,
              low: 0,
              info: 0,
              total: 1
            }
          })
        )
      );

      assert.equal(sarif.version, "2.1.0");
      assert.equal(sarif.runs[0].results[0].ruleId, "secrets.detected");
      assert.equal(
        sarif.runs[0].results[0].locations[0].physicalLocation.artifactLocation.uri,
        "src/example.ts"
      );
    }),
    { numRuns: 120, seed: fuzzSeed + 1 }
  );
});

test("fuzz: secret findings redact generated OpenAI-style credentials", async () => {
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-";
  const tokenSuffix = fc
    .array(fc.constantFrom(...alphabet), { minLength: 24, maxLength: 64 })
    .map((characters) => characters.join(""));

  await fc.assert(
    fc.asyncProperty(tokenSuffix, async (suffix) => {
      const rootDir = await mkdtemp(resolve(tmpdir(), "ai-saas-guard-fuzz-secrets-"));
      const secret = `sk-proj-${suffix}`;

      try {
        await mkdir(resolve(rootDir, "src"), { recursive: true });
        await writeFile(resolve(rootDir, "src", "config.ts"), `export const key = "${secret}";\n`);

        const report = await scanRepository({ rootDir });
        const finding = report.findings.find((item) => item.ruleId === "secrets.detected");
        const serializedEvidence = JSON.stringify(finding?.evidence ?? []);

        assert.ok(finding);
        assert.doesNotMatch(serializedEvidence, new RegExp(secret.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
        assert.match(serializedEvidence, /\[redacted\]/);
      } finally {
        await rm(rootDir, { recursive: true, force: true });
      }
    }),
    { numRuns: 40, seed: fuzzSeed + 2 }
  );
});
