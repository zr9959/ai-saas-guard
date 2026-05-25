export async function POST(request: Request) {
  const event = await request.json();

  if (event.type === "checkout.session.completed") {
    await grantEntitlement(event.data.object.customer);
  }

  return Response.json({ received: true });
}

async function grantEntitlement(customerId: string) {
  console.log("grant", customerId);
}
