import type { Finding, SupabasePolicyRisk, SupabaseReport } from "../types.js";
import type { ScanInput } from "../context.js";
import { resolveScanContext } from "../context.js";
import { createReport, finding, uniqueFindings } from "../report/findings.js";
import { lineAt, lineNumberForIndex, type TextFile } from "../utils/files.js";

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

interface PolicyInfo {
  name: string;
  tableName: string;
  operation: "select" | "insert" | "update" | "delete" | "all" | "unknown";
  usingPredicate?: string;
  withCheckPredicate?: string;
  statement: string;
  line: number;
}

interface ScannedPolicy extends PolicyInfo {
  file: string;
}

export async function checkSupabase(input: ScanInput, options: { doctor?: boolean } = {}): Promise<SupabaseReport> {
  const context = await resolveScanContext(input);
  const doctor = buildDoctorReport(options.doctor ?? true);
  if (!hasSupabaseContext(context.files)) {
    return createReport<SupabaseReport>("check-supabase", context.rootDir, [], {
      riskyTables: [],
      riskyPolicies: [],
      manualAuthorizationTest: [],
      doctor
    });
  }

  const files = context.getFiles((file) => {
    const path = file.path.toLowerCase();
    return path.includes("supabase") || path.includes("migration") || path.endsWith(".sql") || path.endsWith(".prisma");
  });
  const findings: Finding[] = [];
  const tables: TableInfo[] = [];
  const rlsEnabledTables = new Set<string>();
  const riskyPolicies: SupabasePolicyRisk[] = [];
  const policies: ScannedPolicy[] = [];

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

    for (const policy of parsePolicies(file.content)) {
      policies.push({ ...policy, file: file.path });
      const { name: policyName, tableName, line } = policy;
      const predicates = [policy.usingPredicate, policy.withCheckPredicate].filter((value): value is string => Boolean(value));

      if (isStorageObjectsTable(tableName)) {
        const riskyStoragePredicate = predicates.find((predicate) => isUnscopedStoragePredicate(predicate));
        if (riskyStoragePredicate) {
          findings.push(storageFinding(file.path, file.content, line, "Supabase storage.objects policy lacks owner or tenant scope"));
        }
        continue;
      }

      const broadPredicate = predicates.find((predicate) => isBroadPredicate(predicate));
      if (broadPredicate || /\bto\s+(public|anon|authenticated)\b[\s\S]*\busing\s*\(\s*true\s*\)/i.test(policy.statement)) {
        riskyPolicies.push({
          file: file.path,
          line,
          policyName,
          tableName,
          reason: "Policy predicate is broad (`USING (true)`, `WITH CHECK (true)`, or equivalent)."
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
              "Replace broad predicates with ownership checks such as `auth.uid() = user_id`; for writes, mirror the same scope in `WITH CHECK`, and rerun the two-account cross-tenant verification."
          })
        );
      }

      const combinedPredicate = predicates.join(" ");
      if (!/\bauth\.uid\s*\(/i.test(combinedPredicate) && !ownershipColumnPattern.test(combinedPredicate) && sensitiveTablePattern.test(tableName)) {
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
              "Reference `auth.uid()` and a stable owner column, or join through a tenant/workspace membership table, in every sensitive table policy."
          })
        );
      }

      if (sensitiveTablePattern.test(tableName) && hasWeakWithCheck(policy)) {
        riskyPolicies.push({
          file: file.path,
          line,
          policyName,
          tableName,
          reason: "Write policy has a weak or missing `WITH CHECK` predicate."
        });
        findings.push(
          finding({
            ruleId: "supabase.rls.weak-with-check",
            title: `Supabase write policy "${policyName}" has a weak WITH CHECK predicate`,
            severity: "high",
            evidence: [{ file: file.path, line, snippet: lineAt(file.content, line) }],
            why: "A write policy can read the right tenant rows but still allow inserted or updated rows to move into another owner or tenant unless `WITH CHECK` is scoped.",
            suggestedVerification:
              "As User A, try inserting or updating a row with User B's owner, organization, workspace, or tenant ID and confirm the database rejects it.",
            suggestedFix:
              "Use `auth.uid()` in a `WITH CHECK` predicate tied to the same owner, tenant, or membership relationship used by the read policy."
          })
        );
      }
    }

    for (const match of file.content.matchAll(/storage\.buckets[\s\S]{0,200}\bpublic\b\s*[,=]\s*true/gi)) {
      const line = lineNumberForIndex(file.content, match.index ?? 0);
      findings.push(storageFinding(file.path, file.content, line, "Supabase storage bucket appears public"));
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

  findings.push(...buildDoctorFindings(files, tables, rlsEnabledTables, policies));

  return createReport<SupabaseReport>("check-supabase", context.rootDir, uniqueFindings(findings), {
    riskyTables: [...new Set(tables.filter((table) => table.sensitive && !rlsEnabledTables.has(table.name)).map((table) => table.name))],
    riskyPolicies,
    manualAuthorizationTest: [
      "Create User A and User B in the same environment.",
      "Create a sensitive resource as User A.",
      "Try reading the resource with User B's session; expected result is denial.",
      "Try updating and deleting the resource with User B's session; expected result is denial.",
      "Repeat for tenant/member resources and storage objects, not only top-level tables."
    ],
    doctor
  });
}

function hasSupabaseContext(files: readonly TextFile[]): boolean {
  return files.some((file) => {
    const path = file.path.toLowerCase();
    if (path.includes("supabase")) return true;
    if (path === "package.json" && /@supabase\/supabase-js|supabase/i.test(file.content)) return true;
    return /\bfrom\s+["']@supabase\/|create\s+policy\b|enable\s+row\s+level\s+security|auth\.uid\s*\(|storage\.objects/i.test(file.content);
  });
}

function buildDoctorFindings(
  files: readonly TextFile[],
  tables: TableInfo[],
  rlsEnabledTables: Set<string>,
  policies: ScannedPolicy[]
): Finding[] {
  const findings: Finding[] = [];
  const policiesByTable = new Map<string, ScannedPolicy[]>();
  for (const policy of policies) {
    const list = policiesByTable.get(policy.tableName) ?? [];
    list.push(policy);
    policiesByTable.set(policy.tableName, list);
  }

  for (const table of tables) {
    const tablePolicies = policiesByTable.get(table.name) ?? [];
    const content = files.find((file) => file.path === table.file)?.content ?? "";

    if (rlsEnabledTables.has(table.name) && tablePolicies.length === 0) {
      findings.push(
        finding({
          ruleId: "supabase.rls.enabled-no-policy",
          title: `RLS is enabled on ${table.name} but no policies were found`,
          severity: "high",
          evidence: [{ file: table.file, line: table.line, snippet: lineAt(content, table.line) }],
          why: "Supabase RLS with no policies fails closed in confusing ways; builders often see empty results and cannot tell whether auth, data, or policy logic is wrong.",
          suggestedVerification:
            "Run the two-account RLS doctor SQL probes and confirm expected SELECT/INSERT/UPDATE/DELETE behavior for this table.",
          suggestedFix:
            "Add explicit SELECT and write policies for the intended owner or tenant relationship, or document that the table is intentionally inaccessible."
        })
      );
    }

    if (hasOperation(tablePolicies, "select") && !hasAnyOperation(tablePolicies, ["insert", "update", "delete", "all"]) && table.sensitive) {
      const policy = tablePolicies.find((candidate) => candidate.operation === "select") ?? tablePolicies[0];
      findings.push(
        finding({
          ruleId: "supabase.rls.write-policy-missing",
          title: `Table ${table.name} has SELECT policy but no common write policy`,
          severity: "medium",
          evidence: [{ file: policy.file, line: policy.line, snippet: lineAt(files.find((file) => file.path === policy.file)?.content ?? "", policy.line) }],
          why: "A common RLS launch failure is reads working while inserts, updates, or deletes silently fail because write policies are missing.",
          suggestedVerification:
            "As User A, try INSERT, UPDATE, and DELETE on an owned row; then repeat as User B and confirm only the intended operations pass.",
          suggestedFix:
            "Add scoped INSERT/UPDATE/DELETE policies with `WITH CHECK` predicates tied to `auth.uid()` or tenant membership where the product supports writes."
        })
      );
    }

    if (isTenantLikeTable(table) && tablePolicies.length > 0 && !tablePolicies.some((policy) => hasTenantPredicate(policy, table))) {
      const policy = tablePolicies[0];
      findings.push(
        finding({
          ruleId: "supabase.rls.tenant-predicate-missing",
          title: `Tenant-like table ${table.name} lacks an obvious tenant or membership predicate`,
          severity: "high",
          evidence: [{ file: policy.file, line: policy.line, snippet: lineAt(files.find((file) => file.path === policy.file)?.content ?? "", policy.line) }],
          why: "Multi-tenant tables need tenant, workspace, organization, project, client, owner, or membership predicates, not just generic login checks.",
          suggestedVerification:
            "Create rows in two tenants and confirm User A cannot SELECT, INSERT, UPDATE, or DELETE User B's tenant rows.",
          suggestedFix:
            "Tie every policy to tenant/workspace/organization membership or owner columns, and mirror the same tenant scope in `WITH CHECK` for INSERT and UPDATE."
        })
      );
    }
  }

  for (const policy of policies) {
    const predicate = [policy.usingPredicate, policy.withCheckPredicate].filter(Boolean).join(" ");
    const fileContent = files.find((file) => file.path === policy.file)?.content ?? "";

    if (isWriteOperation(policy.operation) && /\bto\s+public\b/i.test(policy.statement)) {
      findings.push(
        finding({
          ruleId: "supabase.rls.public-write-policy",
          title: `Write policy "${policy.name}" is granted to public`,
          severity: "high",
          evidence: [{ file: policy.file, line: policy.line, snippet: lineAt(fileContent, policy.line) }],
          why: "Public write policies can allow anonymous or unintended clients to insert or mutate data when predicates are incomplete or misunderstood.",
          suggestedVerification:
            "Try the INSERT/UPDATE/DELETE path with an anonymous client and with User B's session; expected result is denial unless explicitly intended.",
          suggestedFix:
            "Grant write policies to authenticated roles only and require owner or tenant `WITH CHECK` predicates tied to `auth.uid()` or membership."
        })
      );
    }

    const mismatch = findAuthUidColumnMismatch(predicate, tables.find((table) => table.name === policy.tableName));
    if (mismatch) {
      findings.push(
        finding({
          ruleId: "supabase.rls.uid-column-mismatch",
          title: `Policy "${policy.name}" compares auth.uid() to suspicious column ${mismatch.column}`,
          severity: "medium",
          evidence: [{ file: policy.file, line: policy.line, snippet: lineAt(fileContent, policy.line) }],
          why: "`auth.uid()` is a UUID. Comparing it to email, name, text, or unexpected owner fields commonly causes silent empty RLS results.",
          suggestedVerification:
            "Run a policy probe with User A's JWT and confirm the compared column has the same UUID identity semantics as `auth.uid()`.",
          suggestedFix:
            "Compare `auth.uid()` to a UUID owner/user column, or cast and document the claim mapping if using a custom JWT claim."
        })
      );
    }
  }

  return findings;
}

function buildDoctorReport(enabled: boolean) {
  const base = {
    staticChecks: [
      "RLS enabled with no policies",
      "SELECT policy without common write policies",
      "Public-role write policies",
      "`auth.uid()` compared to suspicious owner/user columns",
      "Tenant-like tables missing tenant/owner/member predicates"
    ],
    twoAccountVerificationSteps: [
      "Create User A and User B with separate tenants, organizations, or workspaces.",
      "Create rows as User A, then attempt SELECT, INSERT, UPDATE, and DELETE with User B's authenticated session.",
      "Repeat the same probes for storage objects and join-table membership paths.",
      "Expected result: User B cannot read or mutate User A resources, and User A cannot write rows into another tenant."
    ],
    sqlCookbook: [
      "-- Run in a transaction against a disposable staging database.",
      "begin;",
      "set local role authenticated;",
      "-- Set User A JWT claims, then SELECT/INSERT/UPDATE/DELETE rows owned by User A.",
      "-- Switch to User B JWT claims and repeat against User A row IDs.",
      "-- Example Supabase helpers differ by setup; verify `request.jwt.claim.sub` maps to auth.uid().",
      "rollback;"
    ]
  };

  if (enabled) return base;
  return {
    staticChecks: [],
    twoAccountVerificationSteps: [],
    sqlCookbook: []
  };
}

function hasOperation(policies: ScannedPolicy[], operation: PolicyInfo["operation"]): boolean {
  return policies.some((policy) => policy.operation === operation || policy.operation === "all");
}

function hasAnyOperation(policies: ScannedPolicy[], operations: PolicyInfo["operation"][]): boolean {
  return policies.some((policy) => operations.includes(policy.operation));
}

function isWriteOperation(operation: PolicyInfo["operation"]): boolean {
  return operation === "insert" || operation === "update" || operation === "delete" || operation === "all";
}

function isTenantLikeTable(table: TableInfo): boolean {
  return /(tenant|organization|org|workspace|client|project)/i.test(`${table.name}\n${table.columns}`);
}

function hasTenantPredicate(policy: ScannedPolicy, table: TableInfo): boolean {
  const predicate = [policy.usingPredicate, policy.withCheckPredicate].filter(Boolean).join(" ");
  const tableText = `${table.name}\n${table.columns}`;
  const hasTenantColumn = /(tenant_id|organization_id|org_id|workspace_id|client_id|project_id)/i.test(tableText);
  if (hasTenantColumn) {
    if (/\bmembers?\b|_members\b/i.test(table.name) && /\bauth\.uid\s*\(/i.test(predicate) && /\buser_id\b/i.test(predicate)) return true;
    return /\b(tenant_id|organization_id|org_id|workspace_id|client_id|project_id|memberships?|organization_members|workspace_members|tenant_members)\b/i.test(predicate);
  }
  if (/\b(tenant_id|organization_id|org_id|workspace_id|client_id|project_id|owner_id|user_id|memberships?|organization_members|workspace_members)\b/i.test(predicate)) {
    return true;
  }
  if (/\bauth\.uid\s*\(/i.test(predicate) && /\b(user_id|owner_id|created_by)\b/i.test(table.columns.toLowerCase())) return true;
  return false;
}

function findAuthUidColumnMismatch(predicate: string, table: TableInfo | undefined): { column: string } | undefined {
  if (!table || !/\bauth\.uid\s*\(/i.test(predicate)) return undefined;
  const columns = parseColumnTypes(table.columns);
  const comparisonPattern = /auth\.uid\s*\(\s*\)(?:::text)?\s*=\s*([a-zA-Z_][a-zA-Z0-9_]*)|([a-zA-Z_][a-zA-Z0-9_]*)\s*=\s*auth\.uid\s*\(\s*\)(?:::text)?/gi;

  for (const match of predicate.matchAll(comparisonPattern)) {
    const column = (match[1] ?? match[2] ?? "").toLowerCase();
    if (!column) continue;
    const type = columns.get(column);
    if (type && !/\buuid\b/i.test(type)) return { column };
    if (!/(^|_)(user|owner|created_by|member|account|profile)(_id)?$|^(user_id|owner_id|created_by|id)$/i.test(column)) return { column };
  }

  return undefined;
}

function parseColumnTypes(columns: string): Map<string, string> {
  const result = new Map<string, string>();
  for (const line of columns.split(/\r?\n/)) {
    const match = /^\s*"?([a-zA-Z_][a-zA-Z0-9_]*)"?\s+([a-zA-Z0-9_]+)/.exec(line);
    if (!match) continue;
    result.set(match[1].toLowerCase(), match[2].toLowerCase());
  }
  return result;
}

function normalizeSqlIdentifier(value: string): string {
  return value.replace(/"/g, "").trim().toLowerCase();
}

function parsePolicies(content: string): PolicyInfo[] {
  const policies: PolicyInfo[] = [];
  const policyPattern = /create\s+policy\s+(?:"([^"]+)"|([^\s\n]+))\s+on\s+([a-zA-Z0-9_."]+)[\s\S]*?;/gi;

  for (const match of content.matchAll(policyPattern)) {
    const statement = match[0];
    policies.push({
      name: (match[1] ?? match[2] ?? "").trim(),
      tableName: normalizeSqlIdentifier(match[3]),
      operation: parsePolicyOperation(statement),
      usingPredicate: extractPredicate(statement, "using"),
      withCheckPredicate: extractPredicate(statement, "with check"),
      statement,
      line: lineNumberForIndex(content, match.index ?? 0)
    });
  }

  return policies;
}

function parsePolicyOperation(statement: string): PolicyInfo["operation"] {
  const match = /\bfor\s+(select|insert|update|delete|all)\b/i.exec(statement);
  const operation = match?.[1]?.toLowerCase();
  if (
    operation === "select" ||
    operation === "insert" ||
    operation === "update" ||
    operation === "delete" ||
    operation === "all"
  ) {
    return operation;
  }
  return "unknown";
}

function extractPredicate(statement: string, clause: "using" | "with check"): string | undefined {
  const clausePattern = clause === "using" ? /\busing\s*\(/i : /\bwith\s+check\s*\(/i;
  const match = clausePattern.exec(statement);
  if (!match) return undefined;

  const openParen = match.index + match[0].lastIndexOf("(");
  return extractBalancedParentheses(statement, openParen);
}

function extractBalancedParentheses(value: string, openParen: number): string | undefined {
  let depth = 0;
  let inSingleQuote = false;

  for (let index = openParen; index < value.length; index += 1) {
    const char = value[index];
    const next = value[index + 1];

    if (char === "'" && next === "'") {
      index += 1;
      continue;
    }

    if (char === "'") {
      inSingleQuote = !inSingleQuote;
      continue;
    }

    if (inSingleQuote) continue;

    if (char === "(") depth += 1;
    if (char === ")") {
      depth -= 1;
      if (depth === 0) return value.slice(openParen + 1, index).trim();
    }
  }

  return undefined;
}

function isBroadPredicate(predicate: string): boolean {
  return predicate.trim().toLowerCase() === "true";
}

function hasWeakWithCheck(policy: PolicyInfo): boolean {
  if (policy.operation !== "insert" && policy.operation !== "update" && policy.operation !== "all") return false;
  if (!policy.withCheckPredicate) return policy.operation === "insert";
  if (isBroadPredicate(policy.withCheckPredicate)) return true;
  return !isScopedOwnershipPredicate(policy.withCheckPredicate);
}

function isScopedOwnershipPredicate(predicate: string): boolean {
  return /\bauth\.uid\s*\(/i.test(predicate) && ownershipColumnPattern.test(predicate);
}

function isStorageObjectsTable(tableName: string): boolean {
  return tableName === "storage.objects";
}

function isUnscopedStoragePredicate(predicate: string): boolean {
  if (isBroadPredicate(predicate)) return true;
  return !/\bauth\.uid\s*\(|\bowner\b|\bowner_id\b|\buser_id\b|\btenant_id\b|\borganization_id\b|\bworkspace_id\b/i.test(predicate);
}

function storageFinding(filePath: string, content: string, line: number, title: string): Finding {
  return finding({
    ruleId: "supabase.storage.public-bucket",
    title,
    severity: "high",
    evidence: [{ file: filePath, line, snippet: lineAt(content, line) }],
    why: "Storage object policies or public buckets can expose tenant files even when database rows are protected.",
    suggestedVerification:
      "Upload a private file as User A and confirm unauthenticated users and User B cannot fetch it by URL or object path.",
    suggestedFix:
      "Keep buckets private and scope storage object policies by `owner`, `auth.uid()`, tenant, workspace, or a membership relationship."
  });
}
