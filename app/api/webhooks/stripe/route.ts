import { createHmac, timingSafeEqual } from "crypto";
import { NextResponse } from "next/server";

import { cancelPendingOrder, markOrderPaid, refundOrder } from "@/lib/checkout/orders";
import { prisma } from "@/lib/db";
import { getServerEnv } from "@/lib/env";

/**
 * POST /api/webhooks/stripe — Stripe webhook receiver.
 *
 * - Signature verified manually (HMAC-SHA256 over `t.payload`, constant-time).
 * - Idempotent: every event id is claimed in WebhookEvent before handling;
 *   a failed handler releases the claim so Stripe's retry can reprocess.
 * - Fulfillment (stock decrement) happens ONLY here,
 *   never at order creation.
 */

type StripeEvent = {
  id: string;
  type: string;
  data?: { object?: Record<string, unknown> };
};

/** Extracts a `pi_...` id from a webhook object field (string or object). */
function paymentIntentIdOf(value: unknown): string | null {
  if (typeof value === "string" && value.startsWith("pi_")) return value;
  if (typeof value === "object" && value !== null && "id" in value) {
    const id = (value as { id?: unknown }).id;
    if (typeof id === "string" && id.startsWith("pi_")) return id;
  }
  return null;
}

function orderIdOf(object: Record<string, unknown>): string | null {
  const metadata = object.metadata as Record<string, unknown> | undefined;
  const fromMetadata = metadata?.orderId;
  if (typeof fromMetadata === "string" && fromMetadata) return fromMetadata;
  const fromReference = object.client_reference_id;
  if (typeof fromReference === "string" && fromReference) return fromReference;
  return null;
}

/**
 * Best-effort refund when fulfillment failed after money was captured
 * (e.g. stock ran out between checkout and the webhook). Never throws.
 */
async function refundCapturedPayment(orderId: string): Promise<void> {
  try {
    const env = getServerEnv();
    const payment = await prisma.payment.findUnique({
      where: { orderId },
      select: { stripePaymentIntentId: true, status: true },
    });
    if (!payment?.stripePaymentIntentId || !env.STRIPE_SECRET_KEY) return;

    const { default: Stripe } = await import("stripe");
    const stripe = new Stripe(env.STRIPE_SECRET_KEY);
    await stripe.refunds.create({
      payment_intent: payment.stripePaymentIntentId,
    });
    console.error(`order ${orderId}: fulfillment failed — refund issued automatically`);
  } catch (error) {
    console.error(`order ${orderId}: AUTOMATIC REFUND FAILED — manual action required`, error);
  }
}

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
  // processedAt doubles as the receive timestamp for retention pruning.
  let claimed = false;
  try {
    await prisma.webhookEvent.create({
      data: { id: event.id, type: event.type, processedAt: new Date() },
    });
    claimed = true;
  } catch (error) {
    if (isUniqueViolation(error)) {
      return NextResponse.json({ received: true, duplicate: true });
    }
    return NextResponse.json({ error: "Unable to record event." }, { status: 500 });
  }

  // Opportunistic retention: keep processed events for 30 days.
  if (Math.random() < 0.05) {
    prisma.webhookEvent
      .deleteMany({
        where: { processedAt: { lt: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
      })
      .catch(() => undefined);
  }

  try {
    const object = event.data?.object ?? {};

    if (event.type === "checkout.session.completed" || event.type === "payment_intent.succeeded") {
      const orderId = orderIdOf(object);
      if (orderId) {
        const result = await markOrderPaid(orderId);
        if (result.reason === "INSUFFICIENT_STOCK") {
          // Money captured but stock is gone — refund the customer.
          await refundCapturedPayment(orderId);
        }
      }
    } else if (event.type === "checkout.session.expired") {
      const orderId = orderIdOf(object);
      if (orderId) {
        await cancelPendingOrder(orderId);
      }
    } else if (event.type === "charge.refunded") {
      const paymentIntentId = paymentIntentIdOf(object.payment_intent);
      if (paymentIntentId) {
        const payment = await prisma.payment.findUnique({
          where: { stripePaymentIntentId: paymentIntentId },
          select: { orderId: true },
        });
        if (payment) {
          await refundOrder(payment.orderId);
        }
      }
    } else if (event.type === "payment_intent.payment_failed") {
      const paymentIntentId = typeof object.id === "string" && object.id.startsWith("pi_") ? object.id : null;
      const orderId = orderIdOf(object);

      if (paymentIntentId) {
        const payment = await prisma.payment.findUnique({
          where: { stripePaymentIntentId: paymentIntentId },
          select: { orderId: true },
        });
        const targetOrderId = payment?.orderId ?? orderId;
        if (targetOrderId) {
          await cancelPendingOrder(targetOrderId);
        } else {
          await prisma.payment.updateMany({
            where: { stripePaymentIntentId: paymentIntentId, status: "PENDING" },
            data: { status: "FAILED" },
          });
        }
      } else if (orderId) {
        await cancelPendingOrder(orderId);
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
