import type { ScanInput } from "./context.js";
import { createScanContext, resolveScanContext } from "./context.js";
import type { TextFile } from "./utils/files.js";

export type StackCategory =
  | "frameworks"
  | "databases"
  | "orms"
  | "auth"
  | "payments"
  | "storage"
  | "deploy";

export interface StackEvidence {
  category: StackCategory;
  tool: string;
  file: string;
  reason: string;
}

export interface StackInventory {
  frameworks: string[];
  databases: string[];
  orms: string[];
  auth: string[];
  payments: string[];
  storage: string[];
  deploy: string[];
  evidence: StackEvidence[];
}

export type StackInventoryInput = ScanInput | { rootDir: string };

type MutableInventory = Record<StackCategory, Set<string>> & { evidence: StackEvidence[] };

export async function detectStackInventory(input: StackInventoryInput): Promise<StackInventory> {
  const context = await resolveStackInventoryContext(input);
  const inventory = createMutableInventory();

  for (const file of context.files) {
    detectFromPath(file, inventory);
    detectFromContent(file, inventory);
  }

  return finalizeInventory(inventory);
}

async function resolveStackInventoryContext(input: StackInventoryInput) {
  if (typeof input === "object" && "rootDir" in input && !("files" in input)) return createScanContext(input.rootDir);
  return resolveScanContext(input as ScanInput);
}

function createMutableInventory(): MutableInventory {
  return {
    frameworks: new Set<string>(),
    databases: new Set<string>(),
    orms: new Set<string>(),
    auth: new Set<string>(),
    payments: new Set<string>(),
    storage: new Set<string>(),
    deploy: new Set<string>(),
    evidence: []
  };
}

function addEvidence(inventory: MutableInventory, category: StackCategory, tool: string, file: string, reason: string): void {
  if (inventory[category].has(tool)) return;
  inventory[category].add(tool);
  inventory.evidence.push({ category, tool, file, reason });
}

function detectFromPath(file: TextFile, inventory: MutableInventory): void {
  const path = file.path.toLowerCase();

  if (path === "vercel.json") addEvidence(inventory, "deploy", "vercel", file.path, "vercel.json");
  if (path === "netlify.toml") addEvidence(inventory, "deploy", "netlify", file.path, "netlify.toml");
  if (path === "wrangler.toml" || path === "wrangler.jsonc") addEvidence(inventory, "deploy", "cloudflare", file.path, "wrangler config");
  if (path === "dockerfile" || path.endsWith("/dockerfile") || path.includes("docker-compose")) addEvidence(inventory, "deploy", "docker", file.path, "docker config");
  if (path.startsWith(".github/workflows/")) addEvidence(inventory, "deploy", "github-actions", file.path, "GitHub Actions workflow");
  if (path.includes("kubernetes") || path.includes("/k8s/")) addEvidence(inventory, "deploy", "kubernetes", file.path, "Kubernetes path");
  if (path.includes("supabase/")) {
    addEvidence(inventory, "databases", "supabase", file.path, "supabase path");
    addEvidence(inventory, "auth", "supabase-auth", file.path, "supabase path");
    addEvidence(inventory, "storage", "supabase-storage", file.path, "supabase path");
  }
  if (path.includes("firebase.json") || path.includes(".firebaserc")) {
    addEvidence(inventory, "databases", "firebase", file.path, "Firebase config");
    addEvidence(inventory, "auth", "firebase-auth", file.path, "Firebase config");
    addEvidence(inventory, "storage", "firebase-storage", file.path, "Firebase config");
  }
  if (path === "prisma/schema.prisma" || path.endsWith("/prisma/schema.prisma")) addEvidence(inventory, "orms", "prisma", file.path, "Prisma schema");
  if (path.includes("drizzle.config")) addEvidence(inventory, "orms", "drizzle", file.path, "Drizzle config");
  if (path.endsWith("requirements.txt") || path.endsWith("pyproject.toml")) detectPythonStack(file, inventory);
  if (path.endsWith("composer.json")) detectPhpStack(file, inventory);
  if (path.endsWith("gemfile")) detectRubyStack(file, inventory);
  if (path.endsWith(".csproj")) detectDotnetStack(file, inventory);
  if (path.endsWith("pom.xml") || path.endsWith("build.gradle") || path.endsWith("build.gradle.kts")) detectJavaStack(file, inventory);
}

function detectFromContent(file: TextFile, inventory: MutableInventory): void {
  const path = file.path.toLowerCase();
  if (path === "package.json") {
    detectPackageJson(file, inventory);
    return;
  }

  if (path.endsWith(".prisma")) {
    if (/\bprovider\s*=\s*"postgresql"/i.test(file.content)) addEvidence(inventory, "databases", "postgresql", file.path, "Prisma datasource");
    if (/\bprovider\s*=\s*"mysql"/i.test(file.content)) addEvidence(inventory, "databases", "mysql", file.path, "Prisma datasource");
    if (/\bprovider\s*=\s*"sqlite"/i.test(file.content)) addEvidence(inventory, "databases", "sqlite", file.path, "Prisma datasource");
    if (/\bprovider\s*=\s*"mongodb"/i.test(file.content)) addEvidence(inventory, "databases", "mongodb", file.path, "Prisma datasource");
    if (/\bprovider\s*=\s*"sqlserver"/i.test(file.content)) addEvidence(inventory, "databases", "sqlserver", file.path, "Prisma datasource");
    if (/\bprovider\s*=\s*"cockroachdb"/i.test(file.content)) addEvidence(inventory, "databases", "cockroachdb", file.path, "Prisma datasource");
  }

  if (/\bcreate\s+policy\b|enable\s+row\s+level\s+security|auth\.uid\s*\(|storage\.objects/i.test(file.content)) {
    addEvidence(inventory, "databases", "supabase", file.path, "Supabase SQL policy syntax");
  }
}

function detectPackageJson(file: TextFile, inventory: MutableInventory): void {
  const dependencies = readPackageDependencies(file.content);
  const has = (name: string) => dependencies.has(name);
  const hasAny = (names: string[]) => names.some((name) => has(name));

  if (has("next")) addEvidence(inventory, "frameworks", "next", file.path, "package dependency");
  if (has("react")) addEvidence(inventory, "frameworks", "react", file.path, "package dependency");
  if (has("express")) addEvidence(inventory, "frameworks", "express", file.path, "package dependency");
  if (has("fastify")) addEvidence(inventory, "frameworks", "fastify", file.path, "package dependency");
  if (hasAny(["@nestjs/core", "@nestjs/common"])) addEvidence(inventory, "frameworks", "nestjs", file.path, "package dependency");
  if (has("astro")) addEvidence(inventory, "frameworks", "astro", file.path, "package dependency");
  if (has("nuxt")) addEvidence(inventory, "frameworks", "nuxt", file.path, "package dependency");
  if (hasAny(["@sveltejs/kit", "svelte"])) addEvidence(inventory, "frameworks", "sveltekit", file.path, "package dependency");
  if (hasAny(["@remix-run/node", "@remix-run/react", "react-router"])) addEvidence(inventory, "frameworks", "remix", file.path, "package dependency");

  if (hasAny(["pg", "postgres", "postgresql", "@neondatabase/serverless"])) addEvidence(inventory, "databases", "postgresql", file.path, "package dependency");
  if (hasAny(["mysql", "mysql2", "mariadb"])) addEvidence(inventory, "databases", "mysql", file.path, "package dependency");
  if (has("mariadb")) addEvidence(inventory, "databases", "mariadb", file.path, "package dependency");
  if (hasAny(["sqlite3", "better-sqlite3", "@libsql/client"])) addEvidence(inventory, "databases", "sqlite", file.path, "package dependency");
  if (hasAny(["mongodb", "mongoose"])) addEvidence(inventory, "databases", "mongodb", file.path, "package dependency");
  if (hasAny(["redis", "ioredis", "@upstash/redis"])) addEvidence(inventory, "databases", "redis", file.path, "package dependency");
  if (hasAny(["@supabase/supabase-js", "@supabase/ssr"])) addEvidence(inventory, "databases", "supabase", file.path, "package dependency");
  if (hasAny(["firebase", "firebase-admin"])) addEvidence(inventory, "databases", "firebase", file.path, "package dependency");
  if (hasAny(["@aws-sdk/client-dynamodb", "dynamodb"])) addEvidence(inventory, "databases", "dynamodb", file.path, "package dependency");
  if (hasAny(["@elastic/elasticsearch", "@opensearch-project/opensearch"])) addEvidence(inventory, "databases", "elasticsearch", file.path, "package dependency");
  if (has("mssql")) addEvidence(inventory, "databases", "sqlserver", file.path, "package dependency");

  if (hasAny(["prisma", "@prisma/client"])) addEvidence(inventory, "orms", "prisma", file.path, "package dependency");
  if (has("drizzle-orm")) addEvidence(inventory, "orms", "drizzle", file.path, "package dependency");
  if (has("kysely")) addEvidence(inventory, "orms", "kysely", file.path, "package dependency");
  if (has("mongoose")) addEvidence(inventory, "orms", "mongoose", file.path, "package dependency");
  if (has("typeorm")) addEvidence(inventory, "orms", "typeorm", file.path, "package dependency");
  if (has("sequelize")) addEvidence(inventory, "orms", "sequelize", file.path, "package dependency");

  if (hasAny(["@clerk/nextjs", "@clerk/clerk-js"])) addEvidence(inventory, "auth", "clerk", file.path, "package dependency");
  if (hasAny(["next-auth", "@auth/core", "@auth/nextjs"])) addEvidence(inventory, "auth", "authjs", file.path, "package dependency");
  if (has("better-auth")) addEvidence(inventory, "auth", "better-auth", file.path, "package dependency");
  if (hasAny(["firebase", "firebase-admin"])) addEvidence(inventory, "auth", "firebase-auth", file.path, "package dependency");
  if (hasAny(["@supabase/supabase-js", "@supabase/ssr"])) addEvidence(inventory, "auth", "supabase-auth", file.path, "package dependency");
  if (hasAny(["@auth0/nextjs-auth0", "auth0"])) addEvidence(inventory, "auth", "auth0", file.path, "package dependency");
  if (hasAny(["@kinde-oss/kinde-auth-nextjs", "@kinde/js-utils"])) addEvidence(inventory, "auth", "kinde", file.path, "package dependency");

  if (has("stripe")) addEvidence(inventory, "payments", "stripe", file.path, "package dependency");
  if (hasAny(["@paypal/checkout-server-sdk", "@paypal/paypal-js"])) addEvidence(inventory, "payments", "paypal", file.path, "package dependency");
  if (hasAny(["@paddle/paddle-js", "paddle-sdk"])) addEvidence(inventory, "payments", "paddle", file.path, "package dependency");
  if (hasAny(["@lemonsqueezy/lemonsqueezy.js", "lemonsqueezy.ts"])) addEvidence(inventory, "payments", "lemon-squeezy", file.path, "package dependency");
  if (hasAny(["@polar-sh/sdk", "@polar-sh/nextjs"])) addEvidence(inventory, "payments", "polar", file.path, "package dependency");

  if (has("@aws-sdk/client-s3")) addEvidence(inventory, "storage", "aws-s3", file.path, "package dependency");
  if (hasAny(["firebase", "firebase-admin"])) addEvidence(inventory, "storage", "firebase-storage", file.path, "package dependency");
  if (hasAny(["@supabase/supabase-js", "@supabase/ssr"])) addEvidence(inventory, "storage", "supabase-storage", file.path, "package dependency");
  if (hasAny(["uploadthing", "@uploadthing/react"])) addEvidence(inventory, "storage", "uploadthing", file.path, "package dependency");
  if (hasAny(["@cloudflare/workers-types", "wrangler"])) addEvidence(inventory, "deploy", "cloudflare", file.path, "package dependency");
}

function readPackageDependencies(content: string): Set<string> {
  try {
    const parsed = JSON.parse(content) as Record<string, unknown>;
    const result = new Set<string>();
    for (const section of ["dependencies", "devDependencies", "peerDependencies", "optionalDependencies"]) {
      const values = parsed[section];
      if (!values || typeof values !== "object" || Array.isArray(values)) continue;
      for (const name of Object.keys(values)) result.add(name);
    }
    return result;
  } catch {
    return new Set<string>();
  }
}

function detectPythonStack(file: TextFile, inventory: MutableInventory): void {
  if (/fastapi/i.test(file.content)) addEvidence(inventory, "frameworks", "fastapi", file.path, "Python dependency");
  if (/django/i.test(file.content)) {
    addEvidence(inventory, "frameworks", "django", file.path, "Python dependency");
    addEvidence(inventory, "orms", "django-orm", file.path, "Python dependency");
  }
  if (/flask/i.test(file.content)) addEvidence(inventory, "frameworks", "flask", file.path, "Python dependency");
  if (/sqlalchemy/i.test(file.content)) addEvidence(inventory, "orms", "sqlalchemy", file.path, "Python dependency");
}

function detectPhpStack(file: TextFile, inventory: MutableInventory): void {
  if (/laravel\/framework/i.test(file.content)) {
    addEvidence(inventory, "frameworks", "laravel", file.path, "Composer dependency");
    addEvidence(inventory, "orms", "eloquent", file.path, "Composer dependency");
  }
}

function detectRubyStack(file: TextFile, inventory: MutableInventory): void {
  if (/rails/i.test(file.content)) {
    addEvidence(inventory, "frameworks", "rails", file.path, "Ruby dependency");
    addEvidence(inventory, "orms", "active-record", file.path, "Ruby dependency");
  }
}

function detectDotnetStack(file: TextFile, inventory: MutableInventory): void {
  if (/Microsoft\.AspNetCore/i.test(file.content)) addEvidence(inventory, "frameworks", "aspnet-core", file.path, ".NET project");
  if (/EntityFrameworkCore/i.test(file.content)) addEvidence(inventory, "orms", "ef-core", file.path, ".NET project");
}

function detectJavaStack(file: TextFile, inventory: MutableInventory): void {
  if (/spring-boot|org\.springframework\.boot/i.test(file.content)) addEvidence(inventory, "frameworks", "spring-boot", file.path, "Java build file");
}

function finalizeInventory(inventory: MutableInventory): StackInventory {
  return {
    frameworks: [...inventory.frameworks].sort(),
    databases: [...inventory.databases].sort(),
    orms: [...inventory.orms].sort(),
    auth: [...inventory.auth].sort(),
    payments: [...inventory.payments].sort(),
    storage: [...inventory.storage].sort(),
    deploy: [...inventory.deploy].sort(),
    evidence: [...inventory.evidence].sort((a, b) => `${a.category}:${a.tool}:${a.file}`.localeCompare(`${b.category}:${b.tool}:${b.file}`))
  };
}
