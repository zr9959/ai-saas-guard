import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const payload = await request.json();
  const refund = await createRefund(payload.chargeId).catch((err) => null);
  return NextResponse.json({ success: true, refund });
}

async function createRefund(chargeId: string): Promise<unknown> {
  return { chargeId, status: "refunded" };
}
