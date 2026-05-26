export async function GET() {
  const response = await fetch(`${process.env.PAYPAL_API_BASE}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      authorization: `Basic ${Buffer.from(`${process.env.PAYPAL_CLIENT_ID}:${process.env.PAYPAL_SECRET}`).toString("base64")}`
    },
    body: "grant_type=client_credentials"
  });

  return Response.json({
    configured: response.ok,
    mode: process.env.PAYPAL_MODE ?? "sandbox"
  });
}
