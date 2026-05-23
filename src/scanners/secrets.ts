import type { Finding } from "../types.js";
import { finding } from "../report/findings.js";
import { collectTextFiles, lineAt, lineNumberForIndex, redactSecret } from "../utils/files.js";

interface SecretPattern {
  id: string;
  label: string;
  pattern: RegExp;
  severity: Finding["severity"];
}

const secretPatterns: SecretPattern[] = [
  {
    id: "stripe-secret-key",
    label: "Stripe secret key",
    pattern: /\bsk_(?:live|test)_[A-Za-z0-9]{16,}\b/g,
    severity: "critical"
  },
  {
    id: "openai-api-key",
    label: "OpenAI API key",
    pattern: /\bsk-(?:proj-)?[A-Za-z0-9_-]{20,}\b/g,
    severity: "critical"
  },
  {
    id: "github-token",
    label: "GitHub token",
    pattern: /\bgh[pousr]_[A-Za-z0-9_]{20,}\b/g,
    severity: "critical"
  },
  {
    id: "private-key",
    label: "private key block",
    pattern: /-----BEGIN (?:RSA |EC |OPENSSH |)PRIVATE KEY-----/g,
    severity: "critical"
  },
  {
    id: "supabase-service-role",
    label: "Supabase service role key",
    pattern: /SUPABASE_SERVICE_ROLE_KEY\s*=\s*[^\s"'`]+/gi,
    severity: "critical"
  },
  {
    id: "generic-secret-assignment",
    label: "secret-like assignment",
    pattern: /\b(?:api[_-]?key|secret|token|password)\b\s*[:=]\s*["']?[A-Za-z0-9_./+=-]{24,}/gi,
    severity: "high"
  },
  {
    id: "env-secret-assignment",
    label: "environment secret-like assignment",
    pattern: /\b[A-Z0-9_]*(?:API_KEY|SECRET|TOKEN|PASSWORD)[A-Z0-9_]*\s*=\s*["']?[A-Za-z0-9_./+=-]{24,}/g,
    severity: "high"
  },
  {
    id: "json-secret-assignment",
    label: "JSON secret-like assignment",
    pattern: /["']?[A-Z0-9_]*(?:API[_-]?KEY|SECRET|TOKEN|PASSWORD)["']?\s*:\s*["'][A-Za-z0-9_./+=-]{24,}["']/gi,
    severity: "high"
  }
];

export function hasSecretLikeValue(value: string): boolean {
  return secretPatterns.some((secretPattern) => {
    secretPattern.pattern.lastIndex = 0;
    return secretPattern.pattern.test(value);
  });
}

export async function scanSecrets(rootDir: string): Promise<Finding[]> {
  const files = await collectTextFiles(rootDir);
  const findings: Finding[] = [];

  for (const file of files) {
    for (const secretPattern of secretPatterns) {
      secretPattern.pattern.lastIndex = 0;
      for (const match of file.content.matchAll(secretPattern.pattern)) {
        const matchedText = match[0] ?? "";
        const line = lineNumberForIndex(file.content, match.index ?? 0);
        findings.push(
          finding({
            ruleId: "secrets.detected",
            title: `Secret-like value detected (${secretPattern.label})`,
            severity: secretPattern.severity,
            evidence: [
              {
                file: file.path,
                line,
                match: redactSecret(matchedText),
                snippet: redactSecret(lineAt(file.content, line))
              }
            ],
            why: "Launch-readiness scans should catch credentials committed to source or examples before the app is shared with users or CI.",
            suggestedVerification:
              "Rotate the credential if it is real, then confirm the value is removed from git history or intentionally replaced with a placeholder.",
            suggestedFix:
              "Move the secret to a server-only environment variable, keep examples as clearly fake placeholders, and add secret scanning to CI."
          })
        );
      }
    }
  }

  return findings;
}

export async function scanNextPublicEnv(rootDir: string): Promise<Finding[]> {
  const files = await collectTextFiles(rootDir);
  const findings: Finding[] = [];
  const publicEnvPattern = /\bNEXT_PUBLIC_[A-Z0-9_]+\b(?:\s*=\s*([^\s"'`]+))?/g;
  const riskyNamePattern = /(SECRET|TOKEN|PRIVATE|SERVICE_ROLE|PASSWORD|STRIPE_SECRET|DATABASE)/i;

  for (const file of files) {
    publicEnvPattern.lastIndex = 0;
    for (const match of file.content.matchAll(publicEnvPattern)) {
      const variableName = match[0].split(/[=\s]/)[0] ?? "";
      const value = match[1] ?? "";
      if (!riskyNamePattern.test(variableName) && !hasSecretLikeValue(value)) continue;

      const line = lineNumberForIndex(file.content, match.index ?? 0);
      findings.push(
        finding({
          ruleId: "next.env.public-secret",
          title: `Risky NEXT_PUBLIC environment variable: ${variableName}`,
          severity: "high",
          evidence: [
            {
              file: file.path,
              line,
              match: redactSecret(match[0]),
              snippet: redactSecret(lineAt(file.content, line))
            }
          ],
          why: "Next.js exposes NEXT_PUBLIC variables to browser code, so secret-like names or values can leak credentials to users.",
          suggestedVerification:
            "Search the production bundle and deployed client-side config for this variable, then rotate any real credential exposed through it.",
          suggestedFix:
            "Rename server-only values without NEXT_PUBLIC, keep them in server runtime env, and pass only short-lived public tokens to the client."
        })
      );
    }
  }

  return findings;
}
