import type { Finding } from "../types.js";
import type { ScanInput } from "../context.js";
import { resolveScanContext } from "../context.js";
import { finding, uniqueFindings } from "../report/findings.js";
import { lineAt, lineNumberForIndex } from "../utils/files.js";

export async function scanDeployConfig(input: ScanInput): Promise<Finding[]> {
  const context = await resolveScanContext(input);
  const files = context.files;
  const findings: Finding[] = [];
  const envExample = files.find((file) => /(^|\/)\.env\.example$/.test(file.path));
  const documentedEnv = collectDocumentedEnv(files);
  const referencedEnv = new Set<string>();
  const envReferences: Array<{ name: string; file: string; line: number; snippet: string }> = [];
  const sensitiveRoutes = files.filter((file) => isSensitiveServerRoute(file.path, file.content));
  const nextConfig = files.find((file) => /(^|\/)next\.config\.(ts|js|mjs|cjs)$/.test(file.path));

  for (const file of files) {
    for (const match of file.content.matchAll(/process\.env\.([A-Z0-9_]+)/g)) {
      referencedEnv.add(match[1]);
      envReferences.push({
        name: match[1],
        file: file.path,
        line: lineNumberForIndex(file.content, match.index ?? 0),
        snippet: lineAt(file.content, lineNumberForIndex(file.content, match.index ?? 0))
      });
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

    for (const match of file.content.matchAll(/process\.env\.(NEXT_PUBLIC_[A-Z0-9_]+)/g)) {
      const envName = match[1];
      if (/(SECRET|TOKEN|KEY|PASSWORD|PRIVATE)/i.test(envName)) continue;
      const line = lineNumberForIndex(file.content, match.index ?? 0);
      findings.push(
        finding({
          ruleId: "deploy.env.public-inventory",
          title: `Public Next.js env var is exposed to browser bundles: ${envName}`,
          severity: "info",
          evidence: [{ file: file.path, line, snippet: lineAt(file.content, line) }],
          why: "`NEXT_PUBLIC_*` variables are intentionally browser-visible; launch review should distinguish normal public config from accidental secrets.",
          suggestedVerification:
            "Confirm this value is safe for every browser user to see in built JavaScript and client logs.",
          suggestedFix:
            "Keep only non-secret public config under `NEXT_PUBLIC_*`; move sensitive values to server-only env vars."
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

    if (usesUnboundedNextImage(file.path, file.content, nextConfig?.content)) {
      const line = firstLine(file.content, /next\/image|remotePatterns|hostname\s*:\s*["']\*\*["']/i) ?? 1;
      findings.push(
        finding({
          ruleId: "deploy.next.image-cost-risk",
          title: `Next image configuration may allow unbounded remote optimization: ${file.path}`,
          severity: "medium",
          evidence: [{ file: file.path, line, snippet: lineAt(file.content, line) }],
          why: "Broad image remote patterns or dynamic image sources can amplify Vercel/Next image optimization costs and obscure which domains are trusted.",
          suggestedVerification:
            "List every expected remote image host and test that unexpected third-party image URLs are rejected before launch.",
          suggestedFix:
            "Constrain `images.remotePatterns` to known hostnames and avoid user-controlled `next/image` sources unless they are validated."
        })
      );
    }

    if (hasRequestAmplificationHint(file.path, file.content)) {
      const line = firstLine(file.content, /<Link\b|router\.prefetch|prefetch\s*=/i) ?? 1;
      findings.push(
        finding({
          ruleId: "deploy.next.request-amplification",
          title: `Dynamic route prefetch may amplify production requests: ${file.path}`,
          severity: "low",
          evidence: [{ file: file.path, line, snippet: lineAt(file.content, line) }],
          why: "High-cardinality dynamic routes can create many unnecessary server requests when prefetching is left enabled.",
          suggestedVerification:
            "Open the page in a production build and inspect network requests for tenant/project/customer/invoice routes before user interaction.",
          suggestedFix:
            "Disable prefetch for high-cardinality dynamic links or make the route cache behavior explicit."
        })
      );
    }

    if (isObservabilitySensitiveRoute(file.path, file.content) && !hasRequestLogging(file.content)) {
      const line = firstLine(file.content, /\b(POST|PUT|PATCH|DELETE)\b|export\s+async\s+function/i) ?? 1;
      findings.push(
        finding({
          ruleId: "deploy.observability.missing-request-id",
          title: `Billing/webhook/tenant route lacks obvious request ID logging: ${file.path}`,
          severity: "low",
          evidence: [{ file: file.path, line, snippet: lineAt(file.content, line) }],
          why: "Launch incidents in billing, webhook, and tenant paths are hard to debug without request IDs, trace IDs, or structured logs.",
          suggestedVerification:
            "Trigger the route in staging and confirm logs include a request or trace ID that can be followed through billing and tenant updates.",
          suggestedFix:
            "Add structured logging with request ID or trace ID near the route entry point and around billing/tenant state changes."
        })
      );
    }
  }

  if (sensitiveRoutes.length > 0 && !hasSecurityHeaders(files)) {
    const evidenceFile = nextConfig ?? sensitiveRoutes[0];
    const line = firstLine(evidenceFile.content, /module\.exports|export\s+default|export\s+async\s+function|\b(GET|POST|PUT|PATCH|DELETE)\b/i) ?? 1;
    findings.push(
      finding({
        ruleId: "deploy.next.missing-security-headers",
        title: "Next/Vercel app with sensitive routes lacks obvious security headers configuration",
        severity: "medium",
        evidence: [{ file: evidenceFile.path, line, snippet: lineAt(evidenceFile.content, line) }],
        why: "Auth, payment, and API routes should launch with explicit browser security headers rather than relying on platform defaults.",
        suggestedVerification:
          "Run a production build or deploy preview and inspect response headers for auth, billing, and API pages.",
        suggestedFix:
          "Add `headers()` in `next.config` or middleware for headers such as `X-Frame-Options`, `X-Content-Type-Options`, `Referrer-Policy`, and an appropriate CSP."
      })
    );
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

  for (const reference of envReferences) {
    if (!isServerRoute(reference.file)) continue;
    if (!isImportantServerEnv(reference.name)) continue;
    if (documentedEnv.has(reference.name)) continue;
    findings.push(
      finding({
        ruleId: "deploy.env.server-undocumented",
        title: `Server route env var is not documented for launch: ${reference.name}`,
        severity: "low",
        evidence: [{ file: reference.file, line: reference.line, snippet: reference.snippet }],
        why: "Next/Vercel server routes can work locally but fail in production when required server-only env vars are missing from examples or env docs.",
        suggestedVerification:
          "Compare this variable against `.env.example`, deployment docs, and the Vercel project environment before launch.",
        suggestedFix:
          "Document the variable in `.env.example` or env docs with a safe placeholder and whether it is server-only."
      })
    );
  }

  return uniqueFindings(findings);
}

function collectDocumentedEnv(files: readonly { path: string; content: string }[]): Set<string> {
  const documented = new Set<string>();
  for (const file of files) {
    if (!/(^|\/)(\.env\.example|\.env\.sample|env\.example|README\.md|docs\/.+\.md)$/i.test(file.path)) continue;
    for (const match of file.content.matchAll(/\b([A-Z][A-Z0-9_]{2,})\b/g)) {
      documented.add(match[1]);
    }
  }
  return documented;
}

function isSensitiveServerRoute(path: string, content: string): boolean {
  return isServerRoute(path) && /\b(auth|session|stripe|billing|payment|checkout|webhook|tenant|workspace|organization|api|secret|token)\b/i.test(`${path}\n${content}`);
}

function isServerRoute(path: string): boolean {
  return /(^|\/)(app\/api\/.+\/route|pages\/api\/.+|api\/.+|routes\/.+)\.[cm]?[jt]sx?$/i.test(path);
}

function isImportantServerEnv(name: string): boolean {
  return /(STRIPE|SUPABASE|DATABASE|NEXTAUTH|AUTH|WEBHOOK|SECRET|TOKEN|OPENAI|ANTHROPIC|PAYMENT)/.test(name);
}

function hasSecurityHeaders(files: readonly { path: string; content: string }[]): boolean {
  const combined = files
    .filter((file) => /(^|\/)(next\.config\.[cm]?[jt]s|middleware\.[cm]?[jt]s)$/i.test(file.path))
    .map((file) => file.content)
    .join("\n");
  return /\bheaders\s*\(/i.test(combined) && /(X-Frame-Options|Content-Security-Policy|X-Content-Type-Options|Referrer-Policy)/i.test(combined);
}

function usesUnboundedNextImage(path: string, content: string, nextConfigContent?: string): boolean {
  if (/next\.config\.(ts|js|mjs|cjs)$/.test(path) && /remotePatterns[\s\S]{0,240}hostname\s*:\s*["'](?:\*\*|\*)["']/i.test(content)) return true;
  if (!/next\/image/i.test(content)) return false;
  const configBroad = nextConfigContent ? /remotePatterns[\s\S]{0,240}hostname\s*:\s*["'](?:\*\*|\*)["']/i.test(nextConfigContent) : false;
  return configBroad || /<Image[\s\S]{0,200}src\s*=\s*{[^"'`]/i.test(content);
}

function hasRequestAmplificationHint(path: string, content: string): boolean {
  if (!/\[[^\]]*(tenant|project|workspace|customer|invoice|slug|id)[^\]]*\]/i.test(path) && !/href\s*=\s*{\s*`[^`]*\$\{[^`]+`/i.test(content)) return false;
  if (/prefetch\s*=\s*{\s*false\s*}/i.test(content)) return false;
  return /<Link\b|router\.prefetch/i.test(content);
}

function isObservabilitySensitiveRoute(path: string, content: string): boolean {
  return isServerRoute(path) && /\b(billing|stripe|payment|webhook|tenant|workspace|organization|checkout)\b/i.test(`${path}\n${content}`);
}

function hasRequestLogging(content: string): boolean {
  return /\b(requestId|request_id|traceId|trace_id|x-request-id|console\.(info|log|warn|error)|logger\.(info|warn|error))\b/i.test(content);
}

function firstLine(content: string, pattern: RegExp): number | undefined {
  const match = pattern.exec(content);
  pattern.lastIndex = 0;
  return match ? lineNumberForIndex(content, match.index) : undefined;
}
