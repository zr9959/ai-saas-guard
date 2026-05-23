export type Severity = "critical" | "high" | "medium" | "low" | "info";

export type CommandName =
  | "scan"
  | "check-supabase"
  | "check-stripe"
  | "check-mcp"
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

export interface BaseReport {
  command: CommandName;
  rootDir: string;
  generatedAt: string;
  findings: Finding[];
  summary: Summary;
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
}

export type McpSideEffect =
  | "read-only"
  | "write"
  | "network"
  | "shell"
  | "database"
  | "secret-bearing";

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
