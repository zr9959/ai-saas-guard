import { NextResponse } from "next/server";

const ALLOWED_ORIGIN = process.env.FRONTEND_ORIGIN ?? "https://app.example.com";

export async function GET() {
  return NextResponse.json(
    { ok: true },
    { headers: { "Access-Control-Allow-Origin": ALLOWED_ORIGIN } }
  );
}
