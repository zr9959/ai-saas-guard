# Stripe Webhook Replay Cookbook

Use this cookbook after `ai-saas-guard check-stripe` flags missing signature checks, missing idempotency, missing lifecycle handlers, or unclear entitlement updates.

It is a local test workflow for reviewers. It does not prove the production integration is secure, and it does not replace Stripe Dashboard checks, production endpoint configuration review, or two-account authorization tests.

## Preconditions

- Run against a sandbox or test-mode Stripe account.
- Start the app locally with the same webhook route code that will be deployed.
- Use fake local users and test subscriptions only.
- Do not paste real API keys, signing secrets, customer data, or production URLs into issue comments or logs.
- Make sure your handler verifies the `Stripe-Signature` header with Stripe's raw request body before changing billing state.

Start local forwarding in one terminal:

```bash
stripe listen --forward-to localhost:3000/api/stripe/webhook
```

Copy the signing secret printed by `stripe listen` into your local server-only environment variable. Keep it out of client bundles and public logs.

In another terminal, run the scanner first:

```bash
npx ai-saas-guard@latest check-stripe --root .
```

Use the findings as the review queue. Each finding should map to at least one replay below.

## What To Observe

For every replay, record these four facts:

| Question | Expected evidence |
| --- | --- |
| Did the webhook return `2xx` only after verification and reconciliation? | Server log or test assertion |
| Was the Stripe event ID stored or deduped? | `event.id` row, unique key, or idempotency log |
| Did app entitlement state change correctly? | Plan, access, seat, credit, or subscription status row |
| Is the user-facing state consistent after refresh? | Dashboard, gated route, API response, or account page |

Entitlement reconciliation means the app derives access from Stripe's current billing truth, then writes one durable local state. Typical examples are `plan`, `subscription_status`, `current_period_end`, `cancel_at_period_end`, active seats, credit balance, or an access table keyed by user, organization, customer, or subscription.

## Replay Matrix

Run the commands one at a time. Watch both the `stripe listen` terminal and your app server logs.

| Scenario | Command | What to verify |
| --- | --- | --- |
| Checkout success | `stripe trigger checkout.session.completed` | The app maps the Checkout Session to the correct user or tenant and grants access only after signature verification. |
| Failed renewal | `stripe trigger invoice.payment_failed` | The app marks the subscription past-due, starts a grace path if intended, and does not leave unrestricted paid access forever. |
| Subscription update | `stripe trigger customer.subscription.updated` | Plan, quantity, cancel-at-period-end, period end, and status changes reconcile into local entitlement state. |
| Cancellation | `stripe trigger customer.subscription.deleted` | Access is revoked or downgraded deterministically for the correct customer or tenant. |
| Refund | `stripe trigger charge.refunded` | Refund handling does not accidentally grant access, double-credit an account, or ignore a required downgrade workflow. |

If a command is not available in your installed Stripe CLI, run `stripe trigger --help` or the event category help such as `stripe trigger customer.subscription --help`, then use the closest supported test event for the same billing state transition.

## Checkout Success

```bash
stripe trigger checkout.session.completed
```

Review checklist:

- The handler rejects unsigned requests before any database write.
- The handler stores or checks the Stripe `event.id`.
- The session is linked to a local user, organization, or tenant through metadata, customer ID, or subscription ID.
- The app does not grant access only from the success redirect page.
- Refreshing the app shows access from database state, not from a one-time URL parameter.

`ai-saas-guard` findings this can validate:

- `stripe.webhook.missing-signature`
- `stripe.webhook.no-entitlement-path`
- `stripe.webhook.missing-idempotency`

## Failed Invoice

```bash
stripe trigger invoice.payment_failed
```

Review checklist:

- The local subscription is not left as fully active without a documented grace policy.
- The app records failure state in the same entitlement system used by normal access checks.
- Customer notification or billing portal recovery is queued if that is part of the product flow.
- A later recovery event can move the account back to the intended state without manual database edits.

`ai-saas-guard` findings this can validate:

- `stripe.webhook.missing-critical-event`
- `stripe.webhook.no-entitlement-path`

## Subscription Update

```bash
stripe trigger customer.subscription.updated
```

Review checklist:

- Plan upgrades and downgrades update the local plan or entitlement rows.
- Seat quantity changes do not leave stale access.
- `cancel_at_period_end` and period boundaries are persisted if the app uses them.
- The handler reconciles from Stripe identifiers instead of trusting a client-provided user ID.

`ai-saas-guard` findings this can validate:

- `stripe.webhook.missing-critical-event`
- `stripe.webhook.no-entitlement-path`

## Cancellation

```bash
stripe trigger customer.subscription.deleted
```

Review checklist:

- The correct user, organization, or tenant loses paid access.
- Shared team access is downgraded consistently, not only the account owner.
- The app handles repeated cancellation events without throwing or creating inconsistent rows.
- Historical records remain available only according to product policy.

`ai-saas-guard` findings this can validate:

- `stripe.webhook.missing-critical-event`
- `stripe.webhook.missing-idempotency`

## Refund

```bash
stripe trigger charge.refunded
```

Review checklist:

- Refund handling is explicit, even if the intended action is "record and review manually."
- Credits, invoices, or access extensions are not applied twice.
- Refund events do not bypass subscription status checks.
- Support/admin workflows have enough evidence to understand which customer, invoice, and subscription were involved.

`ai-saas-guard` findings this can validate:

- `stripe.webhook.missing-critical-event`
- `stripe.webhook.no-entitlement-path`

## Duplicate Event Replay

Stripe can retry events, and the same event can reach your handler more than once. Your handler should be idempotent around the Stripe event ID and the domain object it mutates.

Practical replay:

```bash
stripe trigger checkout.session.completed
```

Then replay the same captured event through your own test harness, fixture, or integration test. The important assertion is not that the Stripe CLI creates the same event twice; it is that your app has a test path where the same `event.id` is processed twice and the second attempt is a no-op.

Review checklist:

- `event.id` is stored with a unique constraint or equivalent dedupe guard.
- The second delivery returns success without repeating fulfillment.
- Access grants, invoices, credits, seats, and emails are not duplicated.
- The handler is safe if the first attempt partially wrote state and then crashed.

`ai-saas-guard` findings this can validate:

- `stripe.webhook.missing-idempotency`

## Out-of-Order Event Questions

Stripe events should be treated as signals to reconcile state, not as a guarantee that the app saw every prior transition in the expected order.

Use these questions during review:

- What happens if `customer.subscription.updated` arrives before the app processed `checkout.session.completed`?
- What happens if `invoice.payment_failed` arrives after a manual admin upgrade?
- What happens if `customer.subscription.deleted` arrives after a refund workflow already changed local access?
- Does the handler fetch or derive current subscription/customer state before writing final entitlement state?
- Is the local write guarded by Stripe customer, subscription, and tenant ownership, not just by event type?

When possible, add tests that call the entitlement reconciliation function directly with events in a different order. The durable result should match Stripe's current billing truth and the product's explicit grace/cancellation policy.

## Minimal Acceptance Checklist

Before launch or merge, a reviewer should be able to answer yes to each item:

- Unsigned webhook requests are rejected before database writes.
- Raw request body is used for signature verification.
- Every handled event stores or dedupes `event.id`.
- `checkout.session.completed` grants access through webhook reconciliation, not only redirect success.
- `invoice.payment_failed` has an explicit past-due or grace behavior.
- `customer.subscription.updated` updates plan, quantity, period, cancellation, and status fields used by access checks.
- `customer.subscription.deleted` revokes or downgrades access for the correct user or tenant.
- `charge.refunded` has an explicit record, downgrade, or manual review path.
- Duplicate deliveries are no-ops after the first successful reconciliation.
- Out-of-order events reconcile to one durable local entitlement state.

## Source Links

- Stripe CLI trigger docs: https://docs.stripe.com/stripe-cli/triggers
- Stripe CLI forwarding docs: https://docs.stripe.com/stripe-cli/use-cli
- Stripe webhook signature docs: https://docs.stripe.com/webhooks/signature
