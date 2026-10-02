import { NextResponse } from "next/server";

import { checkCoupon, quoteCartItems } from "@/lib/cart/quote";
import { computeDiscount } from "@/lib/cart/pricing";
import { couponValidateSchema } from "@/lib/validators/cart";

/**
 * POST /api/coupons/validate — server-side coupon verification.
 * The subtotal is recomputed from the quoted cart (never trusted from the
 * client), then the coupon's activity, window, limits, and minimum are
 * checked against the coupon record.
 */
export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = couponValidateSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Invalid coupon request.", issues: parsed.error.issues.map((i) => i.message) },
      { status: 400 }
    );
  }

  try {
    const quote = await quoteCartItems(parsed.data.items);
    if (quote.lines.length === 0) {
      return NextResponse.json({ error: "No valid items to apply the coupon to." }, { status: 400 });
    }

    const check = await checkCoupon(parsed.data.code, quote.subtotal);
    if (!check.ok) {
      return NextResponse.json({ error: check.message }, { status: 400 });
    }

    const discount = computeDiscount(check.coupon, quote.subtotal);
    return NextResponse.json({
      coupon: check.coupon,
      subtotal: quote.subtotal,
      discount,
      total: quote.subtotal - discount,
    });
  } catch {
    return NextResponse.json({ error: "Unable to validate coupon." }, { status: 500 });
  }
}
