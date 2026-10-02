import { NextResponse } from "next/server";

import { getSession } from "@/lib/auth/guards";
import { markOrderPaid } from "@/lib/checkout/orders";
import { getServerEnv } from "@/lib/env";
import { prisma } from "@/lib/db";
import { mockPaySchema } from "@/lib/validators/checkout";

/**
 * POST /api/checkout/mock-pay — LOCAL DEVELOPMENT ONLY.
 *
 * Simulates a successful payment + webhook (marks the order PAID, decrements
 * stock, records coupon usage) so the full checkout flow is testable before
 * real Stripe keys exist. Hard-gated twice:
 *   1. STRIPE_SECRET_KEY must be empty (real payments win when configured),
 *   2. NEXORA_MOCK_PAY must be "1" (omitted in production deploys).
 */
export async function POST(request: Request) {
  const env = getServerEnv();
  if (env.STRIPE_SECRET_KEY) {
    return NextResponse.json(
      { error: "Stripe is configured — mock payments are disabled." },
      { status: 403 }
    );
  }
  if (env.NEXORA_MOCK_PAY !== "1") {
    return NextResponse.json(
      { error: "Mock payments are disabled on this server." },
      { status: 403 }
    );
  }

  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Sign in to pay." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = mockPaySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid payload." }, { status: 400 });
  }

  try {
    const order = await prisma.order.findFirst({
      where: { id: parsed.data.orderId, userId: session.user.id },
      select: { id: true, status: true },
    });
    if (!order) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }

    const result = await markOrderPaid(order.id);
    return NextResponse.json({ ok: true, alreadyPaid: !result.processed });
  } catch {
    return NextResponse.json({ error: "Unable to process payment." }, { status: 500 });
  }
}
