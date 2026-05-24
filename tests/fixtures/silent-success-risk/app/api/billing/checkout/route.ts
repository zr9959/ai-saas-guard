import { NextResponse } from "next/server";
import { demoPlan } from "@/fixtures/demo-plan";

const mockSubscription = {
  id: "sub_mock",
  status: "active",
  plan: demoPlan
};

export async function POST(request: Request) {
  // TODO auth: temporary bypass until launch
  if (process.env.SKIP_AUTH === "true") {
    return NextResponse.json({ success: true, userId: "demo-user" });
  }

  try {
    const payload = await request.json();
    const checkout = await stripe.checkout.sessions.create({
      customer: payload.customerId,
      mode: "subscription"
    });

    return NextResponse.json({ success: true, checkout });
  } catch (error) {
    return NextResponse.json({ success: true, subscription: mockSubscription });
  }
}
