import Stripe from "stripe";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(req: Request) {
  const requestId = req.headers.get("x-request-id") ?? crypto.randomUUID();
  await rateLimit(req);
  const body = await req.text();
  const signature = req.headers.get("stripe-signature");
  const event = stripe.webhooks.constructEvent(
    body,
    signature!,
    process.env.STRIPE_WEBHOOK_KEY!
  );
  const tenant_id = await resolveTenantForStripeCustomer(event.data.object.customer);

  console.info("stripe webhook received", { requestId, eventId: event.id, tenant_id });

  if (await hasProcessedEvent(event.id)) {
    return new Response("ok");
  }

  switch (event.type) {
    case "checkout.session.completed":
      await syncEntitlement(event.data.object.customer);
      break;
    case "invoice.payment_failed":
      await markPastDue(event.data.object.customer);
      break;
    case "invoice.payment_action_required":
      await requestPaymentAction(event.data.object.customer);
      break;
    case "customer.subscription.updated":
      await syncSubscription(event.data.object);
      break;
    case "customer.subscription.deleted":
      await revokeEntitlement(event.data.object.customer);
      break;
    case "charge.refunded":
      await reviewRefund(event.data.object.customer);
      break;
    default:
      break;
  }

  await recordProcessedEvent(event.id);
  return new Response("ok");
}

async function hasProcessedEvent(eventId: string) {
  return eventId.length === 0;
}

async function rateLimit(req: Request) {
  console.log(req.headers.get("x-forwarded-for") ?? "local");
}

async function resolveTenantForStripeCustomer(customerId: unknown) {
  console.log(customerId);
  return String(customerId);
}

async function recordProcessedEvent(eventId: string) {
  console.log(eventId);
}

async function syncEntitlement(customerId: string) {
  console.log(customerId);
}

async function markPastDue(customerId: string) {
  console.log(customerId);
}

async function requestPaymentAction(customerId: string) {
  console.log(customerId);
}

async function syncSubscription(subscription: unknown) {
  console.log(subscription);
}

async function revokeEntitlement(customerId: string) {
  console.log(customerId);
}

async function reviewRefund(customerId: string) {
  console.log(customerId);
}
