import type { Finding, SupabasePolicyRisk, SupabaseReport } from "../types.js";
import { createReport, finding, uniqueFindings } from "../report/findings.js";
import { collectTextFiles, lineAt, lineNumberForIndex } from "../utils/files.js";

const sensitiveTablePattern =
  /\b(user|account|profile|team|tenant|project|order|subscription|invoice|customer|organization|member|message|document|file|workspace)s?\b/i;
const ownershipColumnPattern = /\b(user_id|owner_id|tenant_id|account_id|organization_id|workspace_id|created_by)\b/i;

interface TableInfo {
  name: string;
  file: string;
  line: number;
  columns: string;
  sensitive: boolean;
}

export async function checkSupabase(rootDir: string): Promise<SupabaseReport> {
  const files = (await collectTextFiles(rootDir)).filter((file) => {
    const path = file.path.toLowerCase();
    return path.includes("supabase") || path.includes("migration") || path.endsWith(".sql") || path.endsWith(".prisma");
  });
  const findings: Finding[] = [];
  const tables: TableInfo[] = [];
  const rlsEnabledTables = new Set<string>();
  const riskyPolicies: SupabasePolicyRisk[] = [];

  for (const file of files) {
    for (const match of file.content.matchAll(/create\s+table\s+(?:if\s+not\s+exists\s+)?([a-zA-Z0-9_."]+)\s*\(([\s\S]*?)\)\s*;/gi)) {
      const tableName = normalizeSqlIdentifier(match[1]);
      const columns = match[2] ?? "";
      tables.push({
        name: tableName,
        file: file.path,
        line: lineNumberForIndex(file.content, match.index ?? 0),
        columns,
        sensitive: sensitiveTablePattern.test(tableName)
      });
    }

    for (const match of file.content.matchAll(/alter\s+table\s+([a-zA-Z0-9_."]+)\s+enable\s+row\s+level\s+security/gi)) {
      rlsEnabledTables.add(normalizeSqlIdentifier(match[1]));
    }

    for (const match of file.content.matchAll(/create\s+policy\s+"?([^"\n]+)"?\s+on\s+([a-zA-Z0-9_."]+)[\s\S]*?(?:using\s*\(([\s\S]*?)\)|with\s+check\s*\(([\s\S]*?)\))\s*;/gi)) {
      const policyName = match[1].trim();
      const tableName = normalizeSqlIdentifier(match[2]);
      const predicate = `${match[3] ?? ""} ${match[4] ?? ""}`.trim();
      const line = lineNumberForIndex(file.content, match.index ?? 0);

      if (/\btrue\b/i.test(predicate) || /\bto\s+(public|anon|authenticated)\b[\s\S]*\busing\s*\(\s*true\s*\)/i.test(match[0])) {
        riskyPolicies.push({
          file: file.path,
          line,
          policyName,
          tableName,
          reason: "Policy predicate is broad (`USING (true)` or equivalent)."
        });
        findings.push(
          finding({
            ruleId: "supabase.rls.broad-policy",
            title: `Broad Supabase RLS policy on ${tableName}`,
            severity: "critical",
            evidence: [{ file: file.path, line, snippet: lineAt(file.content, line) }],
            why: "A broad RLS predicate can make user data readable or writable across accounts even when login exists.",
            suggestedVerification:
              "Run the generated two-account IDOR test and confirm User B cannot read, update, or delete User A resources.",
            suggestedFix:
              "Replace broad predicates with ownership checks such as `auth.uid() = user_id` or a tenant membership join."
          })
        );
      }

      if (!/\bauth\.uid\s*\(/i.test(predicate) && !ownershipColumnPattern.test(predicate) && sensitiveTablePattern.test(tableName)) {
        riskyPolicies.push({
          file: file.path,
          line,
          policyName,
          tableName,
          reason: "Policy does not reference `auth.uid()` or an ownership/tenant column."
        });
        findings.push(
          finding({
            ruleId: "supabase.rls.missing-ownership-filter",
            title: `Supabase policy on ${tableName} lacks an obvious ownership filter`,
            severity: "high",
            evidence: [{ file: file.path, line, snippet: lineAt(file.content, line) }],
            why: "Founders often confuse authentication with authorization; table policies need resource-level ownership checks.",
            suggestedVerification:
              "Create the same resource as User A and attempt to read, update, and delete it with User B's session.",
            suggestedFix:
              "Reference `auth.uid()` and a stable ownership or membership column in every sensitive table policy."
          })
        );
      }
    }

    for (const match of file.content.matchAll(/storage\.buckets[\s\S]{0,200}\bpublic\b\s*[,=]\s*true|create\s+policy[\s\S]{0,200}\bstorage\.objects[\s\S]{0,200}using\s*\(\s*true\s*\)/gi)) {
      const line = lineNumberForIndex(file.content, match.index ?? 0);
      findings.push(
        finding({
          ruleId: "supabase.storage.public-bucket",
          title: "Supabase storage policy or bucket appears public",
          severity: "high",
          evidence: [{ file: file.path, line, snippet: lineAt(file.content, line) }],
          why: "Public buckets can expose uploads, invoices, profile documents, or tenant files even when database rows are protected.",
          suggestedVerification:
            "Upload a private file as User A and confirm unauthenticated users and User B cannot fetch it by URL.",
          suggestedFix:
            "Make buckets private by default and add storage object policies scoped by owner or tenant."
        })
      );
    }
  }

  for (const table of tables) {
    if (!table.sensitive) continue;

    if (!ownershipColumnPattern.test(table.columns)) {
      findings.push(
        finding({
          ruleId: "supabase.table.missing-owner-column",
          title: `Sensitive table ${table.name} has no obvious owner or tenant column`,
          severity: "medium",
          evidence: [{ file: table.file, line: table.line, snippet: lineAt(files.find((file) => file.path === table.file)?.content ?? "", table.line) }],
          why: "RLS policies are hard to write safely when user data tables lack a stable ownership or tenant key.",
          suggestedVerification:
            "Trace how rows in this table are associated with a user or tenant before launch.",
          suggestedFix:
            "Add `user_id`, `owner_id`, `tenant_id`, or a membership relationship and enforce it in RLS policies."
        })
      );
    }

    if (!rlsEnabledTables.has(table.name)) {
      findings.push(
        finding({
          ruleId: "supabase.rls.not-enabled",
          title: `Sensitive table ${table.name} does not enable row level security`,
          severity: "critical",
          evidence: [{ file: table.file, line: table.line, snippet: lineAt(files.find((file) => file.path === table.file)?.content ?? "", table.line) }],
          why: "Supabase tables with user data need RLS enabled; otherwise application bugs can expose cross-user records.",
          suggestedVerification:
            "Query the table as an authenticated low-privilege user and confirm rows are denied unless a matching policy allows them.",
          suggestedFix:
            "Add `alter table ... enable row level security;` and explicit ownership policies for each sensitive table."
        })
      );
    }
  }

  return createReport<SupabaseReport>("check-supabase", rootDir, uniqueFindings(findings), {
    riskyTables: [...new Set(tables.filter((table) => table.sensitive && !rlsEnabledTables.has(table.name)).map((table) => table.name))],
    riskyPolicies,
    manualAuthorizationTest: [
      "Create User A and User B in the same environment.",
      "Create a sensitive resource as User A.",
      "Try reading the resource with User B's session; expected result is denial.",
      "Try updating and deleting the resource with User B's session; expected result is denial.",
      "Repeat for tenant/member resources and storage objects, not only top-level tables."
    ]
  });
}

function normalizeSqlIdentifier(value: string): string {
  return value.replace(/"/g, "").trim().toLowerCase();
}
