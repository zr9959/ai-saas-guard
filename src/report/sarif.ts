import type { BaseReport, Finding } from "../types.js";
import { getRuleMetadata } from "../rules/catalog.js";

interface SarifRule {
  id: string;
  name: string;
  shortDescription: { text: string };
  fullDescription: { text: string };
  help: { text: string };
  defaultConfiguration: { level: "error" | "warning" | "note" };
  properties: {
    "ai-saas-guard/stability": string;
    tags: string[];
  };
}

export function formatSarifReport(report: BaseReport): string {
  const rules = new Map<string, SarifRule>();

  for (const finding of report.findings) {
    if (rules.has(finding.ruleId)) continue;
    const metadata = getRuleMetadata(finding.ruleId);
    const stability = metadata?.stability ?? "default";
    rules.set(finding.ruleId, {
      id: finding.ruleId,
      name: finding.ruleId,
      shortDescription: { text: metadata?.title ?? finding.title },
      fullDescription: { text: metadata?.why ?? finding.why },
      help: { text: `${finding.suggestedVerification}\n\nFix direction: ${finding.suggestedFix}` },
      defaultConfiguration: { level: sarifLevel(finding) },
      properties: {
        "ai-saas-guard/stability": stability,
        tags: [`stability:${stability}`]
      }
    });
  }

  return `${JSON.stringify(
    {
      version: "2.1.0",
      $schema: "https://json.schemastore.org/sarif-2.1.0.json",
      runs: [
        {
          tool: {
            driver: {
              name: "ai-saas-guard",
              informationUri: "https://github.com/zr9959/ai-saas-guard",
              rules: [...rules.values()]
            }
          },
          results: report.findings.map((finding) => sarifResult(finding))
        }
      ]
    },
    null,
    2
  )}\n`;
}

function sarifResult(finding: Finding) {
  const evidence = finding.evidence[0] ?? { file: "." };
  return {
    ruleId: finding.ruleId,
    level: sarifLevel(finding),
    message: {
      text: `${finding.title}\n\nWhy: ${finding.why}\n\nVerify: ${finding.suggestedVerification}\n\nFix direction: ${finding.suggestedFix}`
    },
    locations: [
      {
        physicalLocation: {
          artifactLocation: {
            uri: evidence.file
          },
          region: {
            startLine: evidence.line ?? 1
          }
        }
      }
    ]
  };
}

function sarifLevel(finding: Finding): "error" | "warning" | "note" {
  if (finding.severity === "critical" || finding.severity === "high") return "error";
  if (finding.severity === "medium" || finding.severity === "low") return "warning";
  return "note";
}
