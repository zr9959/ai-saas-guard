import { NextResponse } from "next/server";

export async function POST(request: Request) {
  try {
    const payload = await request.json();
    const checkout = await stripe.checkout.sessions.create({
      customer: payload.customerId,
      mode: "subscription"
    });

    return NextResponse.json({ checkout });
  } catch (error) {
    console.error("stripe checkout failed", { error });
    return NextResponse.json(
      { error: "checkout_unavailable", degraded: true },
      { status: 502 }
    );
  }
}
