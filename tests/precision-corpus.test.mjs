import assert from "node:assert/strict";
import { mkdir, mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";
import { test } from "node:test";

import { checkActions, checkStripe, checkSupabase, scanRepository } from "../dist/index.js";

// Precision corpus: every core rule carries a positive and a negative snippet.
// The positive snippet MUST fire the rule; the negative MUST NOT. This is the
// launch-gate precision guardrail: a scanner that cries wolf (false positive)
// or stays silent on a real hole (false negative) destroys reviewer trust.
// When adding a rule (new rules always start experimental), add its corpus
// pair here first, then the fixture in tests/fixtures/.

async function makeRepo(files) {
  const root = await mkdtemp(join(tmpdir(), "precision-corpus-"));
  try {
    for (const [rel, content] of Object.entries(files)) {
      await mkdir(join(root, dirname(rel)), { recursive: true });
      await writeFile(join(root, rel), content);
    }
    return root;
  } catch (error) {
    await rm(root, { recursive: true, force: true });
    throw error;
  }
}

function fired(report, ruleId) {
  return report.findings.some((finding) => finding.ruleId === ruleId);
}

const SUPABASE_BASE = `create table public.accounts (
  id uuid primary key,
  user_id uuid not null
);

alter table public.accounts enable row level security;
`;

test("corpus: broad RLS policy fires; scoped policy stays silent", async () => {
  const positive = await makeRepo({
    "supabase/migrations/001.sql": `${SUPABASE_BASE}
create policy "open accounts"
on public.accounts
for select
using (true);`
  });
  const negative = await makeRepo({
    "supabase/migrations/001.sql": `${SUPABASE_BASE}
create policy "users read own accounts"
on public.accounts
for select
using (auth.uid() = user_id);`
  });
  try {
    assert.ok(fired(await checkSupabase({ rootDir: positive }), "supabase.rls.broad-policy"));
    assert.ok(!fired(await checkSupabase({ rootDir: negative }), "supabase.rls.broad-policy"));
  } finally {
    await rm(positive, { recursive: true, force: true });
    await rm(negative, { recursive: true, force: true });
  }
});

test("corpus: missing RLS fires; schema-prefix mismatch does not false-positive", async () => {
  const positive = await makeRepo({
    "supabase/migrations/001.sql": `create table public.accounts (
  id uuid primary key,
  user_id uuid not null
);`
  });
  const negative = await makeRepo({
    "supabase/migrations/001.sql": `create table public.accounts (
  id uuid primary key,
  user_id uuid not null
);

alter table accounts enable row level security;

create policy "users read own accounts"
on accounts
for select
using (auth.uid() = user_id);`
  });
  try {
    assert.ok(fired(await checkSupabase({ rootDir: positive }), "supabase.rls.not-enabled"));
    assert.ok(!fired(await checkSupabase({ rootDir: negative }), "supabase.rls.not-enabled"));
  } finally {
    await rm(positive, { recursive: true, force: true });
    await rm(negative, { recursive: true, force: true });
  }
});

test("corpus: unscoped storage.objects policy fires; owner-scoped stays silent", async () => {
  const positive = await makeRepo({
    "supabase/migrations/001.sql": `create policy "open avatars"
on public.storage.objects
for select
using (bucket_id = 'avatars');`
  });
  const negative = await makeRepo({
    "supabase/migrations/001.sql": `create policy "users read own avatars"
on public.storage.objects
for select
using (auth.uid() = owner);`
  });
  try {
    assert.ok(fired(await checkSupabase({ rootDir: positive }), "supabase.storage.public-bucket"));
    assert.ok(!fired(await checkSupabase({ rootDir: negative }), "supabase.storage.public-bucket"));
  } finally {
    await rm(positive, { recursive: true, force: true });
    await rm(negative, { recursive: true, force: true });
  }
});

test("corpus: UPDATE without WITH CHECK fires; scoped WITH CHECK stays silent", async () => {
  const positive = await makeRepo({
    "supabase/migrations/001.sql": `${SUPABASE_BASE}
create policy "users update own accounts"
on public.accounts
for update
using (auth.uid() = user_id);`
  });
  const negative = await makeRepo({
    "supabase/migrations/001.sql": `${SUPABASE_BASE}
create policy "users update own accounts"
on public.accounts
for update
using (auth.uid() = user_id)
with check (auth.uid() = user_id);`
  });
  try {
    assert.ok(fired(await checkSupabase({ rootDir: positive }), "supabase.rls.update-without-with-check"));
    assert.ok(!fired(await checkSupabase({ rootDir: negative }), "supabase.rls.update-without-with-check"));
  } finally {
    await rm(positive, { recursive: true, force: true });
    await rm(negative, { recursive: true, force: true });
  }
});

test("corpus: committed secret fires; short non-secret value stays silent", async () => {
  const positive = await makeRepo({
    "src/config.ts": `export const STRIPE_SECRET_KEY = "example_stripe_secret_value_0123456789abcdef";\n`
  });
  const negative = await makeRepo({
    "src/config.ts": `export const STRIPE_SECRET_KEY = process.env.STRIPE_SECRET_KEY;\nexport const MODE = "test";\n`
  });
  try {
    assert.ok(fired(await scanRepository({ rootDir: positive }), "secrets.detected"));
    assert.ok(!fired(await scanRepository({ rootDir: negative }), "secrets.detected"));
  } finally {
    await rm(positive, { recursive: true, force: true });
    await rm(negative, { recursive: true, force: true });
  }
});

test("corpus: unsigned Stripe webhook fires; verified webhook stays silent", async () => {
  const positive = await makeRepo({
    "app/api/stripe/webhook/route.ts": `import Stripe from "stripe";

export async function POST(req: Request) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const body = await req.text();
  const event = JSON.parse(body);
  if (event.type === "checkout.session.completed") {
    await grantAccess(event.data.object);
  }
  return new Response("ok");
}
`
  });
  const negative = await makeRepo({
    "app/api/stripe/webhook/route.ts": `import Stripe from "stripe";

export async function POST(req: Request) {
  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  const body = await req.text();
  const signature = req.headers.get("stripe-signature");
  const event = stripe.webhooks.constructEvent(body, signature, process.env.STRIPE_WEBHOOK_SECRET);
  return new Response("ok");
}
`
  });
  try {
    assert.ok(fired(await checkStripe({ rootDir: positive }), "stripe.webhook.missing-signature"));
    assert.ok(!fired(await checkStripe({ rootDir: negative }), "stripe.webhook.missing-signature"));
  } finally {
    await rm(positive, { recursive: true, force: true });
    await rm(negative, { recursive: true, force: true });
  }
});

test("corpus: parenthesized catch-null fires; rethrowing catch stays silent", async () => {
  const positive = await makeRepo({
    "app/api/billing/route.ts": `export async function GET() {
  const plans = await fetchPlans().catch((err) => null);
  return Response.json({ plans });
}
`
  });
  const negative = await makeRepo({
    "app/api/billing/route.ts": `export async function GET() {
  const plans = await fetchPlans().catch((err) => {
    throw err;
  });
  return Response.json({ plans });
}
`
  });
  try {
    assert.ok(fired(await scanRepository({ rootDir: positive }), "silent-success.swallowed-error"));
    assert.ok(!fired(await scanRepository({ rootDir: negative }), "silent-success.swallowed-error"));
  } finally {
    await rm(positive, { recursive: true, force: true });
    await rm(negative, { recursive: true, force: true });
  }
});

test("corpus: write-all permissions fire; read-only permissions stay silent", async () => {
  const positive = await makeRepo({
    ".github/workflows/ci.yml": `name: ci
on: [push]
permissions: write-all
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
`
  });
  const negative = await makeRepo({
    ".github/workflows/ci.yml": `name: ci
on: [push]
permissions:
  contents: read
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
`
  });
  try {
    assert.ok(fired(await checkActions({ rootDir: positive }), "actions.permissions.too-broad"));
    assert.ok(!fired(await checkActions({ rootDir: negative }), "actions.permissions.too-broad"));
  } finally {
    await rm(positive, { recursive: true, force: true });
    await rm(negative, { recursive: true, force: true });
  }
});

test("corpus: wildcard CORS fires; allowlisted origin stays silent", async () => {
  const positive = await makeRepo({
    "app/api/profile/route.ts": `export async function GET() {
  const res = Response.json({ ok: true });
  res.headers.set("Access-Control-Allow-Origin", "*");
  return res;
}
`
  });
  const negative = await makeRepo({
    "app/api/profile/route.ts": `export async function GET() {
  const res = Response.json({ ok: true });
  res.headers.set("Access-Control-Allow-Origin", "https://app.example.com");
  return res;
}
`
  });
  try {
    assert.ok(fired(await scanRepository({ rootDir: positive }), "api.route.cors-wildcard"));
    assert.ok(!fired(await scanRepository({ rootDir: negative }), "api.route.cors-wildcard"));
  } finally {
    await rm(positive, { recursive: true, force: true });
    await rm(negative, { recursive: true, force: true });
  }
});

test("corpus: service role key in client component fires; server-only usage stays silent", async () => {
  const pkg = `{"dependencies":{"@supabase/supabase-js":"^2.0.0"},"name":"corpus-case","private":true}`;
  const positive = await makeRepo({
    "package.json": pkg,
    "app/admin/page.tsx": `"use client";
import { createClient } from "@supabase/supabase-js";
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
export default function Admin() { return null; }
`
  });
  const negative = await makeRepo({
    "package.json": pkg,
    "app/admin/page.tsx": `import { createClient } from "@supabase/supabase-js";
const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!);
export default async function Admin() { return null; }
`
  });
  try {
    assert.ok(fired(await scanRepository({ rootDir: positive }), "supabase.service-role.client-usage"));
    assert.ok(!fired(await scanRepository({ rootDir: negative }), "supabase.service-role.client-usage"));
  } finally {
    await rm(positive, { recursive: true, force: true });
    await rm(negative, { recursive: true, force: true });
  }
});

test("corpus: NEXT_PUBLIC_ service role variable fires even without client directive", async () => {
  const pkg = `{"dependencies":{"@supabase/supabase-js":"^2.0.0"},"name":"corpus-case","private":true}`;
  const positive = await makeRepo({
    "package.json": pkg,
    "lib/supabase.ts": `import { createClient } from "@supabase/supabase-js";
export const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY!);
`
  });
  const negative = await makeRepo({
    "package.json": pkg,
    "lib/supabase.ts": `import { createClient } from "@supabase/supabase-js";
export const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);
`
  });
  try {
    assert.ok(fired(await scanRepository({ rootDir: positive }), "supabase.service-role.client-usage"));
    assert.ok(!fired(await scanRepository({ rootDir: negative }), "supabase.service-role.client-usage"));
  } finally {
    await rm(positive, { recursive: true, force: true });
    await rm(negative, { recursive: true, force: true });
  }
});

test("corpus: middleware without auth signals fires; middleware with session check stays silent", async () => {
  const positive = await makeRepo({
    "middleware.ts": `import { NextRequest, NextResponse } from "next/server";
export function middleware(request: NextRequest) {
  const url = request.nextUrl.clone();
  url.pathname = "/en" + request.nextUrl.pathname;
  return NextResponse.redirect(url);
}
export const config = { matcher: ["/((?!api|_next).*)"] };
`
  });
  const negative = await makeRepo({
    "middleware.ts": `import { NextRequest, NextResponse } from "next/server";
import { getToken } from "next-auth/jwt";
export async function middleware(request: NextRequest) {
  const token = await getToken({ req: request });
  if (!token && request.nextUrl.pathname.startsWith("/dashboard")) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }
  return NextResponse.next();
}
export const config = { matcher: ["/((?!api|_next).*)"] };
`
  });
  try {
    assert.ok(fired(await scanRepository({ rootDir: positive }), "next.middleware.missing-auth"));
    assert.ok(!fired(await scanRepository({ rootDir: negative }), "next.middleware.missing-auth"));
  } finally {
    await rm(positive, { recursive: true, force: true });
    await rm(negative, { recursive: true, force: true });
  }
});
