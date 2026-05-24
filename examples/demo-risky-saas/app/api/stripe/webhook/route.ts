export async function POST(req: Request) {
  const event = await req.json();

  if (event.type === "checkout.session.completed") {
    await grantAccess(event.data.object.customer);
    return Response.json({ success: true });
  }

  return Response.json({ ok: true });
}

async function grantAccess(customerId: string) {
  console.log("granting access", customerId);
}
