import type { Finding, StripeReport } from "../types.js";
import { createReport, finding, uniqueFindings } from "../report/findings.js";
import { collectTextFiles, lineAt, lineNumberForIndex } from "../utils/files.js";

const criticalEvents = [
  "invoice.payment_failed",
  "customer.subscription.deleted",
  "customer.subscription.updated",
  "charge.refunded"
];

const eventPattern =
  /["']((?:checkout\.session\.completed|invoice\.payment_failed|customer\.subscription\.(?:deleted|updated|created)|charge\.(?:refunded|dispute\.created)|refund\.(?:created|updated)))["']/g;

export async function checkStripe(rootDir: string): Promise<StripeReport> {
  const files = await collectTextFiles(rootDir);
  const webhookFiles = files.filter((file) => {
    const path = file.path.toLowerCase();
    const content = file.content.toLowerCase();
    return (
      (path.includes("stripe") && path.includes("webhook")) ||
      content.includes("stripe.webhooks") ||
      content.includes("stripe-signature") ||
      content.includes("checkout.session.completed")
    );
  });
  const stripeSignalFiles = files.filter((file) => !/\.(md|txt)$/i.test(file.path) && !file.path.startsWith("docs/"));
  const usesStripe =
    webhookFiles.length > 0 ||
    stripeSignalFiles.some((file) =>
      /STRIPE_SECRET_KEY|STRIPE_WEBHOOK_SECRET|from\s+["']stripe["']|require\(["']stripe["']\)|new\s+Stripe|stripe\.webhooks|checkout\.session\.completed/i.test(
        `${file.path}\n${file.content}`
      )
    );

  const findings: Finding[] = [];
  const handledEvents = new Set<string>();

  if (webhookFiles.length === 0 && !usesStripe) {
    return createReport<StripeReport>("check-stripe", rootDir, [], {
      webhookFiles: [],
      handledEvents: [],
      missingCriticalEvents: [],
      testCommands: [
        "stripe trigger checkout.session.completed",
        "stripe trigger invoice.payment_failed",
        "stripe trigger customer.subscription.updated",
        "stripe trigger customer.subscription.deleted",
        "stripe trigger charge.refunded"
      ],
      stateReconciliationQuestions: [
        "Is Stripe used for checkout, subscriptions, invoices, refunds, or entitlements in this repo?"
      ]
    });
  }

  if (webhookFiles.length === 0) {
    findings.push(
      finding({
        ruleId: "stripe.webhook.missing-route",
        title: "No Stripe webhook handler found",
        severity: "medium",
        evidence: [{ file: "." }],
        why: "Stripe checkout redirects are not a reliable source of billing truth; subscription access should be driven by signed webhooks.",
        suggestedVerification:
          "Confirm whether this app accepts payments. If it does, locate the deployed webhook endpoint and trace how subscription state changes.",
        suggestedFix:
          "Add a server-side webhook route that verifies Stripe signatures and reconciles entitlement state from Stripe events."
      })
    );
  }

  for (const file of webhookFiles) {
    for (const match of file.content.matchAll(eventPattern)) {
      handledEvents.add(match[1]);
    }

    const hasConstructEvent = /webhooks\.constructEvent|constructEvent\s*\(/.test(file.content);
    const readsStripeSignature = /stripe-signature/i.test(file.content);
    const usesRawBody = /req\.text\s*\(|rawBody|buffer\s*\(/.test(file.content);
    const usesJsonBody = /req\.json\s*\(/.test(file.content);

    if (!hasConstructEvent || !readsStripeSignature) {
      findings.push(
        finding({
          ruleId: "stripe.webhook.missing-signature",
          title: "Stripe webhook does not verify the Stripe signature",
          severity: "critical",
          evidence: [
            {
              file: file.path,
              line: firstLineMatching(file.content, /POST|handler|webhook/i),
              snippet: firstSnippetMatching(file.content, /POST|handler|webhook/i)
            }
          ],
          why: "Without `stripe.webhooks.constructEvent` and the `stripe-signature` header, attackers can forge billing events that grant or revoke access.",
          suggestedVerification:
            "Send a request without a valid Stripe signature and confirm the handler rejects it before changing entitlement state.",
          suggestedFix:
            "Read the raw request body, call `stripe.webhooks.constructEvent(body, signature, STRIPE_WEBHOOK_SECRET)`, and reject invalid signatures."
        })
      );
    }

    if (hasConstructEvent && usesJsonBody && !usesRawBody) {
      findings.push(
        finding({
          ruleId: "stripe.webhook.raw-body-risk",
          title: "Stripe signature verification may be using a parsed JSON body",
          severity: "high",
          evidence: [{ file: file.path, line: firstLineMatching(file.content, /req\.json\s*\(/), snippet: firstSnippetMatching(file.content, /req\.json\s*\(/) }],
          why: "Stripe signature checks require the exact raw payload bytes; parsed JSON can make verification fail or be bypassed in rewrites.",
          suggestedVerification:
            "Replay a signed test webhook through the deployed route and confirm signature verification succeeds only with the raw body.",
          suggestedFix:
            "Use `await req.text()` in Next.js route handlers or equivalent raw-body middleware before calling `constructEvent`."
        })
      );
    }

    if (/NEXT_PUBLIC_STRIPE_WEBHOOK_SECRET|NEXT_PUBLIC_STRIPE_SECRET_KEY/.test(file.content)) {
      findings.push(
        finding({
          ruleId: "stripe.webhook.public-secret",
          title: "Stripe signing secret appears to use a public environment variable",
          severity: "critical",
          evidence: [{ file: file.path, line: firstLineMatching(file.content, /NEXT_PUBLIC_STRIPE/), snippet: firstSnippetMatching(file.content, /NEXT_PUBLIC_STRIPE/) }],
          why: "Public Stripe secrets can be bundled into client code and used to forge or abuse payment flows.",
          suggestedVerification:
            "Inspect deployed client bundles for the variable and rotate the Stripe secret if it was exposed.",
          suggestedFix:
            "Store Stripe secrets in server-only environment variables without the NEXT_PUBLIC prefix."
        })
      );
    }

    const hasIdempotency =
      /event\.id/.test(file.content) &&
      /(processed|idempot|webhook_events|recordProcessed|hasProcessed|dedupe)/i.test(file.content);
    if (!hasIdempotency) {
      findings.push(
        finding({
          ruleId: "stripe.webhook.missing-idempotency",
          title: "Stripe webhook lacks obvious duplicate event idempotency",
          severity: "high",
          evidence: [{ file: file.path, line: firstLineMatching(file.content, /event/i), snippet: firstSnippetMatching(file.content, /event/i) }],
          why: "Stripe can retry and deliver duplicate events; without storing processed event IDs, access grants and revocations can drift.",
          suggestedVerification:
            "Replay the same Stripe event ID twice and confirm the second delivery does not create duplicate fulfillment or inconsistent state.",
          suggestedFix:
            "Persist processed Stripe event IDs and make entitlement updates idempotent around event ID and subscription/customer IDs."
        })
      );
    }

    if (!/(entitlement|subscription|access|grant|revoke|pastDue|sync)/i.test(file.content)) {
      findings.push(
        finding({
          ruleId: "stripe.webhook.no-entitlement-path",
          title: "Stripe webhook does not show an entitlement update path",
          severity: "medium",
          evidence: [{ file: file.path }],
          why: "A webhook returning 200 is not enough; billing state needs to change application access deterministically.",
          suggestedVerification:
            "Trigger checkout success, failed renewal, cancellation, and refund events, then compare Stripe state with database entitlements and UI access.",
          suggestedFix:
            "Route each critical event to a small entitlement reconciliation function and record whether state changed."
        })
      );
    }
  }

  const missingCriticalEvents = criticalEvents.filter((eventName) => !handledEvents.has(eventName));
  for (const eventName of missingCriticalEvents) {
    findings.push(
      finding({
        ruleId: "stripe.webhook.missing-critical-event",
        title: `Stripe webhook does not handle ${eventName}`,
        severity: eventName === "invoice.payment_failed" || eventName === "customer.subscription.deleted" ? "high" : "medium",
        evidence: webhookFiles.length > 0 ? webhookFiles.map((file) => ({ file: file.path })) : [{ file: "." }],
        why: "Subscription products need failure, cancellation, update, and refund paths so access cannot remain active after billing changes.",
        suggestedVerification: `Run \`stripe trigger ${eventName}\` in test mode and confirm application entitlement state changes as expected.`,
        suggestedFix: `Add an explicit ${eventName} handler that reconciles subscription or entitlement state from Stripe.`
      })
    );
  }

  return createReport<StripeReport>("check-stripe", rootDir, uniqueFindings(findings), {
    webhookFiles: webhookFiles.map((file) => file.path),
    handledEvents: [...handledEvents].sort(),
    missingCriticalEvents,
    testCommands: [
      "stripe trigger checkout.session.completed",
      "stripe trigger invoice.payment_failed",
      "stripe trigger customer.subscription.updated",
      "stripe trigger customer.subscription.deleted",
      "stripe trigger charge.refunded"
    ],
    stateReconciliationQuestions: [
      "Which table stores active entitlement or plan state?",
      "Does checkout success only redirect, or does webhook state grant access?",
      "What happens when Stripe retries the same event ID?",
      "Can app access stay active after failed payment, cancellation, refund, or chargeback?"
    ]
  });
}

function firstLineMatching(content: string, pattern: RegExp): number | undefined {
  const match = pattern.exec(content);
  pattern.lastIndex = 0;
  return match ? lineNumberForIndex(content, match.index) : undefined;
}

function firstSnippetMatching(content: string, pattern: RegExp): string | undefined {
  const line = firstLineMatching(content, pattern);
  return line ? lineAt(content, line) : undefined;
}
