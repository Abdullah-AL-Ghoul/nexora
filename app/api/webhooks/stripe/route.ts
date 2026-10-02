import { createHmac, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";

import { markOrderPaid } from "@/lib/checkout/orders";
import { prisma } from "@/lib/db";
import { getServerEnv } from "@/lib/env";

/**
 * POST /api/webhooks/stripe — Stripe webhook receiver.
 *
 * - Signature verified manually (HMAC-SHA256 over `t.payload`, constant-time).
 * - Idempotent: every event id is claimed in WebhookEvent before handling;
 *   a failed handler releases the claim so Stripe's retry can reprocess.
 * - Fulfillment (stock decrement) happens ONLY here (or the local mock),
 *   never at order creation.
 */

type StripeEvent = {
  id: string;
  type: string;
  data?: { object?: Record<string, unknown> };
};

function verifySignature(payload: string, header: string, secret: string): boolean {
  const parts = new Map<string, string[]>();
  for (const pair of header.split(",")) {
    const [key, value] = pair.split("=", 2);
    if (!key || !value) continue;
    const list = parts.get(key) ?? [];
    list.push(value);
    parts.set(key, list);
  }

  const timestamp = parts.get("t")?.[0];
  const candidates = parts.get("v1") ?? [];
  if (!timestamp || candidates.length === 0) return false;

  const ageSeconds = Math.abs(Math.floor(Date.now() / 1000) - Number(timestamp));
  if (!Number.isFinite(ageSeconds) || ageSeconds > 300) return false;

  const expected = createHmac("sha256", secret)
    .update(`${timestamp}.${payload}`)
    .digest("hex");

  return candidates.some((candidate) => {
    const a = Buffer.from(candidate, "utf8");
    const b = Buffer.from(expected, "utf8");
    return a.length === b.length && timingSafeEqual(a, b);
  });
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}

export async function POST(request: Request) {
  const env = getServerEnv();
  if (!env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: "Webhooks are not configured." }, { status: 503 });
  }

  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return NextResponse.json({ error: "Missing signature." }, { status: 400 });
  }

  const payload = await request.text();
  if (!verifySignature(payload, signature, env.STRIPE_WEBHOOK_SECRET)) {
    return NextResponse.json({ error: "Invalid signature." }, { status: 400 });
  }

  let event: StripeEvent;
  try {
    event = JSON.parse(payload) as StripeEvent;
    if (typeof event.id !== "string" || typeof event.type !== "string") {
      throw new Error("Malformed event");
    }
  } catch {
    return NextResponse.json({ error: "Malformed event." }, { status: 400 });
  }

  // Idempotency claim: first delivery wins; duplicates are acknowledged.
  let claimed = false;
  try {
    await prisma.webhookEvent.create({ data: { id: event.id, type: event.type } });
    claimed = true;
  } catch (error) {
    if (isUniqueViolation(error)) {
      return NextResponse.json({ received: true, duplicate: true });
    }
    return NextResponse.json({ error: "Unable to record event." }, { status: 500 });
  }

  try {
    const object = event.data?.object ?? {};

    if (event.type === "checkout.session.completed" || event.type === "payment_intent.succeeded") {
      const metadata = object.metadata as Record<string, unknown> | undefined;
      const orderId = metadata?.orderId;
      if (typeof orderId === "string" && orderId) {
        await markOrderPaid(orderId);
      }
    } else if (event.type === "payment_intent.payment_failed") {
      const paymentIntentId = object.id;
      if (typeof paymentIntentId === "string" && paymentIntentId.startsWith("pi_")) {
        await prisma.payment.updateMany({
          where: { stripePaymentIntentId: paymentIntentId },
          data: { status: "FAILED" },
        });
      }
    }

    return NextResponse.json({ received: true });
  } catch (error) {
    // Release the claim so Stripe's retry reprocesses this event.
    if (claimed) {
      await prisma.webhookEvent.delete({ where: { id: event.id } }).catch(() => undefined);
    }
    console.error("stripe webhook handler failed", error);
    return NextResponse.json({ error: "Handler failed." }, { status: 500 });
  }
}
