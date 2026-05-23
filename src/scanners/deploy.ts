import type { Finding } from "../types.js";
import { finding, uniqueFindings } from "../report/findings.js";
import { collectTextFiles, lineAt, lineNumberForIndex } from "../utils/files.js";

export async function scanDeployConfig(rootDir: string): Promise<Finding[]> {
  const files = await collectTextFiles(rootDir);
  const findings: Finding[] = [];
  const envExample = files.find((file) => /(^|\/)\.env\.example$/.test(file.path));
  const referencedEnv = new Set<string>();

  for (const file of files) {
    for (const match of file.content.matchAll(/process\.env\.([A-Z0-9_]+)/g)) {
      referencedEnv.add(match[1]);
    }

    if (/next\.config\.(ts|js|mjs)$/.test(file.path) && /output\s*:\s*["']export["']/.test(file.content) && /app\/api|route\.ts|serverActions/i.test(file.content)) {
      const line = lineNumberForIndex(file.content, file.content.search(/output\s*:/));
      findings.push(
        finding({
          ruleId: "deploy.next.static-export-api-risk",
          title: "Next static export may conflict with server routes",
          severity: "medium",
          evidence: [{ file: file.path, line, snippet: lineAt(file.content, line) }],
          why: "Next/Vercel deploys often break when local server behavior depends on runtime routes that static export cannot serve.",
          suggestedVerification: "Run the same production build command used by CI and request each API route locally from the built output.",
          suggestedFix: "Use a server-capable Next deployment target for API routes, or split static pages from server endpoints."
        })
      );
    }

    if (/runtime\s*=\s*["']edge["']/.test(file.content) && /(PrismaClient|fs\.|node:fs|stripe\.webhooks\.constructEvent)/.test(file.content)) {
      const line = lineNumberForIndex(file.content, file.content.search(/runtime\s*=/));
      findings.push(
        finding({
          ruleId: "deploy.edge-runtime-node-api",
          title: `Route may use Node-only APIs while configured for Edge runtime: ${file.path}`,
          severity: "medium",
          evidence: [{ file: file.path, line, snippet: lineAt(file.content, line) }],
          why: "Next.js routes that work locally can fail on Vercel when Edge runtime code uses Node-only libraries or raw body assumptions.",
          suggestedVerification: "Run `next build` and deploy-preview logs for this route with production runtime settings.",
          suggestedFix: "Move Node-only code to the Node.js runtime or replace incompatible dependencies."
        })
      );
    }
  }

  if (envExample) {
    const documentedEnv = new Set([...envExample.content.matchAll(/^([A-Z0-9_]+)=/gm)].map((match) => match[1]));
    const missingImportantEnv = [...referencedEnv].filter((name) => {
      return /(STRIPE|SUPABASE|DATABASE|NEXTAUTH|AUTH|WEBHOOK|SECRET|TOKEN)/.test(name) && !documentedEnv.has(name);
    });

    for (const name of missingImportantEnv.slice(0, 10)) {
      findings.push(
        finding({
          ruleId: "deploy.env.example-missing",
          title: `Important runtime env var is not documented in .env.example: ${name}`,
          severity: "low",
          evidence: [{ file: envExample.path, match: name }],
          why: "Missing production env variables are a common reason Next/Vercel apps work locally and fail after deploy.",
          suggestedVerification: "Compare required variables against Vercel or CI environment settings before launch.",
          suggestedFix: "Add a placeholder and short purpose comment for this variable in .env.example."
        })
      );
    }
  }

  return uniqueFindings(findings);
}
