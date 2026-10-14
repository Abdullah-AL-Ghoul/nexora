import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth/guards";
import { cancelPendingOrder, createOrder } from "@/lib/checkout/orders";
import { getPublicEnv, getServerEnv } from "@/lib/env";
import { prisma } from "@/lib/db";
import { clientIp, rateLimit, rateLimitResponse } from "@/lib/rate-limit";
import { checkoutSchema } from "@/lib/validators/checkout";

/**
 * POST /api/checkout — creates an order from a verified server quote.
 * - PaymentMethod "card": initializes a secure hosted Stripe Checkout session.
 * - PaymentMethod "cod": creates an active order with Cash on Delivery.
 * Totals/address/stock are recomputed on the server (strict zod, no client money tampering).
 */
export async function POST(request: Request) {
  const limit = rateLimit(`checkout:${clientIp(request)}`, 10, 60_000);
  if (!limit.ok) return rateLimitResponse(limit.retryAfterSeconds);

  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in to check out." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = checkoutSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid checkout payload.",
        issues: parsed.error.issues.map((issue) => ({
          path: issue.path.join("."),
          message: issue.message,
        })),
      },
      { status: 400 }
    );
  }

  try {
    const result = await createOrder(session.user.id, parsed.data);
    if (!result.ok) {
      return NextResponse.json(
        { error: result.error, issues: result.issues },
        { status: result.status }
      );
    }

    const order = result.order;

    // Auto-save address to patron profile if none exists yet for future 1-click checkout
    try {
      const existingAddr = await prisma.address.findFirst({
        where: { userId: session.user.id },
      });
      if (!existingAddr) {
        await prisma.address.create({
          data: {
            userId: session.user.id,
            label: "Primary Shipping",
            fullName: parsed.data.address.fullName,
            line1: parsed.data.address.line1,
            line2: parsed.data.address.line2 ?? null,
            city: parsed.data.address.city,
            region: parsed.data.address.region ?? null,
            postalCode: parsed.data.address.postalCode,
            country: parsed.data.address.country,
            phone: parsed.data.address.phone ?? null,
            isDefault: true,
          },
        });
      }
    } catch {
      // Non-blocking error handling
    }

    const env = getServerEnv();

    // Cash on Delivery (COD) path: order remains PENDING with payment provider "cod"
    if (parsed.data.paymentMethod === "cod") {
      return NextResponse.json(
        { orderId: order.id, orderNumber: order.orderNumber, cod: true },
        { status: 201 }
      );
    }

    if (env.STRIPE_SECRET_KEY) {
      try {
        const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
        const proto = request.headers.get("x-forwarded-proto") || "https";
        const defaultUrl = getPublicEnv().NEXT_PUBLIC_APP_URL || "https://nexora-luxury.vercel.app";
        const appUrl = (host ? `${proto}://${host}` : defaultUrl).replace(/\/$/, "");

        const stripeIdempotencyKey = `checkout-${parsed.data.idempotencyKey ?? order.id}`;

        const params = new URLSearchParams();
        params.append("mode", "payment");
        params.append("client_reference_id", order.id);
        params.append("metadata[orderId]", order.id);
        order.items.forEach((item, index) => {
          params.append(`line_items[${index}][quantity]`, String(item.quantity));
          params.append(`line_items[${index}][price_data][currency]`, "usd");
          params.append(`line_items[${index}][price_data][unit_amount]`, String(item.unitPrice));
          params.append(`line_items[${index}][price_data][product_data][name]`, item.name);
        });
        params.append("success_url", `${appUrl}/account/orders/${order.id}?placed=1`);
        params.append("cancel_url", `${appUrl}/checkout?cancelled=1`);

        const stripeSecret = env.STRIPE_SECRET_KEY.replace(/[\uFEFF\r\n\s]/g, "");
        const stripeRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${stripeSecret}`,
            "Content-Type": "application/x-www-form-urlencoded",
            "Idempotency-Key": stripeIdempotencyKey,
          },
          body: params.toString(),
        });

        const checkoutSession = (await stripeRes.json()) as {
          url?: string;
          payment_intent?: string | { id?: string };
          error?: { message?: string };
        };

        if (!stripeRes.ok || !checkoutSession.url) {
          throw new Error(
            checkoutSession.error?.message || "Failed to create secure checkout session with Stripe."
          );
        }

        // Link the PaymentIntent so payment_intent.payment_failed /
        // charge.refunded webhooks can match this order.
        const paymentIntentId =
          typeof checkoutSession.payment_intent === "string"
            ? checkoutSession.payment_intent
            : (checkoutSession.payment_intent?.id ?? null);
        if (paymentIntentId) {
          await prisma.payment
            .update({
              where: { orderId: order.id },
              data: { stripePaymentIntentId: paymentIntentId },
            })
            .catch((error) => {
              console.error("failed to store payment intent id", error);
            });
        }

        return NextResponse.json(
          { orderId: order.id, orderNumber: order.orderNumber, url: checkoutSession.url },
          { status: 201 }
        );
      } catch (error) {
        // No payment session — cancel the orphan PENDING order so it does
        // not linger (and does not block this cart's idempotency retry).
        console.error("stripe checkout session failed", error);
        await cancelPendingOrder(order.id).catch(() => undefined);
        const errorMessage =
          error instanceof Error ? error.message : "Card payment processing encountered a network error.";
        return NextResponse.json(
          { error: errorMessage },
          { status: 502 }
        );
      }
    }

    // Card payment was selected but gateway keys are not yet configured
    await cancelPendingOrder(order.id).catch(() => undefined);
    return NextResponse.json(
      {
        error:
          "Online card payment gateway is currently synchronizing with the banking network. Please complete your order using Cash on Delivery (COD) or contact our concierge.",
      },
      { status: 503 }
    );
  } catch {
    return NextResponse.json({ error: "Unable to create your order." }, { status: 500 });
  }
}
