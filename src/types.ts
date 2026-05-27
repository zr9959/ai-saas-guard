export type Severity = "critical" | "high" | "medium" | "low" | "info";

export type CommandName =
  | "scan"
  | "demo"
  | "check-supabase"
  | "check-stripe"
  | "check-mcp"
  | "check-actions"
  | "pr-risk";

export interface Evidence {
  file: string;
  line?: number;
  column?: number;
  match?: string;
  snippet?: string;
}

export interface Finding {
  ruleId: string;
  title: string;
  severity: Severity;
  evidence: Evidence[];
  why: string;
  suggestedVerification: string;
  suggestedFix: string;
}

export interface Summary {
  critical: number;
  high: number;
  medium: number;
  low: number;
  info: number;
  total: number;
}

export interface ScanOptions {
  rootDir: string;
}

export interface SupabaseOptions extends ScanOptions {
  doctor?: boolean;
}

export interface McpOptions extends ScanOptions {
  policyTemplate?: boolean;
}

export interface BaseReport {
  command: CommandName;
  rootDir: string;
  generatedAt: string;
  findings: Finding[];
  summary: Summary;
  stackInventory?: import("./stackInventory.js").StackInventory;
  fileCollection?: import("./utils/files.js").FileCollectionDiagnostics;
}

export interface ShowcaseReport extends BaseReport {
  command: "demo";
  demos: {
    risky: BaseReport;
    safe: BaseReport;
  };
  nextSteps: string[];
}

export interface StripeReport extends BaseReport {
  command: "check-stripe";
  webhookFiles: string[];
  handledEvents: string[];
  missingCriticalEvents: string[];
  testCommands: string[];
  stateReconciliationQuestions: string[];
}

export interface SupabasePolicyRisk {
  file: string;
  line?: number;
  policyName: string;
  tableName: string;
  reason: string;
}

export interface SupabaseReport extends BaseReport {
  command: "check-supabase";
  riskyTables: string[];
  riskyPolicies: SupabasePolicyRisk[];
  manualAuthorizationTest: string[];
  doctor: SupabaseDoctorReport;
}

export type McpSideEffect =
  | "read-only"
  | "filesystem-read"
  | "filesystem-write"
  | "write"
  | "network"
  | "shell"
  | "database"
  | "secret-bearing"
  | "unknown";

export interface SupabaseDoctorReport {
  staticChecks: string[];
  twoAccountVerificationSteps: string[];
  sqlCookbook: string[];
}

export interface McpServerInventory {
  name: string;
  configPath: string;
  command?: string;
  url?: string;
  tools: string[];
  sideEffects: McpSideEffect[];
}

export interface McpReport extends BaseReport {
  command: "check-mcp";
  servers: McpServerInventory[];
  tools: string[];
  policyTemplate?: McpPolicyTemplate;
}

export interface McpPolicyTemplate {
  servers: Array<{
    name: string;
    configPath: string;
    tools: string[];
    sideEffects: McpSideEffect[];
  }>;
  localPolicyTemplate: string[];
  receiptFormat: string[];
}

export interface ActionsReport extends BaseReport {
  command: "check-actions";
  workflows: string[];
  hygieneChecklist: string[];
}

export type PrRiskCategory =
  | "auth/session"
  | "billing/subscription"
  | "database schema/migration"
  | "RLS/policy"
  | "API contract"
  | "env/secrets/deploy"
  | "permissions/storage"
  | "tests removed or weakened"
  | "silent-success/fake-green"
  | "large AI-generated/refactor-like diff";

export interface PrRiskFile {
  path: string;
  score: number;
  categories: PrRiskCategory[];
  added: number;
  removed: number;
}

export interface PrRiskOptions {
  rootDir: string;
  diffText?: string;
  base?: string;
}

export interface PrRiskReport extends BaseReport {
  command: "pr-risk";
  categories: PrRiskCategory[];
  topRiskyFiles: PrRiskFile[];
  reviewChecklist: string[];
  suggestedSplit: string[];
  requiredTests: string[];
}
