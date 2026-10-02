import { NextResponse } from "next/server";
import Stripe from "stripe";

import { getSession } from "@/lib/auth/guards";
import { cancelPendingOrder, createOrder } from "@/lib/checkout/orders";
import { getPublicEnv, getServerEnv } from "@/lib/env";
import { prisma } from "@/lib/db";
import { checkoutSchema } from "@/lib/validators/checkout";

/**
 * POST /api/checkout — creates a PENDING order from a fresh server quote.
 * - With STRIPE_SECRET_KEY: starts a hosted Stripe Checkout session (redirect URL).
 * - Without: returns `{ mock: true }` so the local mock payment flow can run.
 * Totals/address/stock are all recomputed on the server (strict zod, no money fields).
 */
export async function POST(request: Request) {
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
    const env = getServerEnv();

    if (env.STRIPE_SECRET_KEY) {
      try {
        const stripe = new Stripe(env.STRIPE_SECRET_KEY);
        const appUrl = getPublicEnv().NEXT_PUBLIC_APP_URL;
        // Same key across retries of this attempt — Stripe returns the same
        // session instead of creating duplicates.
        const stripeIdempotencyKey = `checkout-${parsed.data.idempotencyKey ?? order.id}`;
        const checkoutSession = await stripe.checkout.sessions.create(
          {
            mode: "payment",
            client_reference_id: order.id,
            metadata: { orderId: order.id },
            line_items: order.items.map((item) => ({
              quantity: item.quantity,
              price_data: {
                currency: "usd",
                unit_amount: item.unitPrice,
                product_data: { name: item.name },
              },
            })),
            success_url: `${appUrl}/account/orders/${order.id}?placed=1`,
            cancel_url: `${appUrl}/checkout?cancelled=1`,
          },
          { idempotencyKey: stripeIdempotencyKey }
        );

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
        return NextResponse.json(
          { error: "Unable to start payment. Try again." },
          { status: 502 }
        );
      }
    }

    return NextResponse.json(
      { orderId: order.id, orderNumber: order.orderNumber, mock: true },
      { status: 201 }
    );
  } catch {
    return NextResponse.json({ error: "Unable to create your order." }, { status: 500 });
  }
}
