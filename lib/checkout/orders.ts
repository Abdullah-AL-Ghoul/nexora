import { randomBytes } from "crypto";

import { prisma } from "@/lib/db";
import { checkCoupon, quoteCartItems } from "@/lib/cart/quote";
import { computeDiscount, formatCartTotals } from "@/lib/cart/pricing";
import { resolveShipping, type ShippingMethod } from "@/lib/checkout/shipping";
import type { Prisma } from "@/lib/generated/prisma/client";
import type { CheckoutInput } from "@/lib/validators/checkout";

/**
 * Order creation & fulfillment.
 *
 * Money rules:
 * - createOrder re-prices everything server-side (client totals never trusted).
 * - markOrderPaid is the ONLY place stock is decremented (webhook / mock pay),
 *   and it is idempotent: the PENDING → PAID claim happens once per order.
 */

const orderSelect = {
  id: true,
  orderNumber: true,
  status: true,
  paymentStatus: true,
  subtotal: true,
  discount: true,
  shipping: true,
  total: true,
  shippingMethod: true,
  address: true,
  couponCode: true,
  notes: true,
  placedAt: true,
  paidAt: true,
  items: {
    select: {
      id: true,
      productId: true,
      variantId: true,
      name: true,
      sku: true,
      variantName: true,
      unitPrice: true,
      quantity: true,
      lineTotal: true,
    },
  },
  payment: { select: { status: true, provider: true } },
} satisfies Prisma.OrderSelect;

export type OrderRecord = Prisma.OrderGetPayload<{ select: typeof orderSelect }>;

export type OrderFailure = {
  ok: false;
  status: number;
  error: string;
  issues?: { productId: string; variantId: string | null; reason: string }[];
};

export type OrderSuccess = { ok: true; order: OrderRecord };

export function generateOrderNumber(): string {
  const now = new Date();
  const ymd = [
    now.getFullYear().toString(),
    String(now.getMonth() + 1).padStart(2, "0"),
    String(now.getDate()).padStart(2, "0"),
  ].join("");
  const suffix = randomBytes(3).toString("hex").toUpperCase();
  return `NX-${ymd}-${suffix}`;
}

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}

/** Creates a PENDING order + PENDING payment from a fresh server quote. */
export async function createOrder(
  userId: string,
  input: CheckoutInput
): Promise<OrderSuccess | OrderFailure> {
  const quote = await quoteCartItems(input.items);

  if (quote.lines.length === 0) {
    return { ok: false, status: 400, error: "Your cart has no available items." };
  }
  if (quote.rejected.length > 0) {
    return {
      ok: false,
      status: 409,
      error: "Some items in your cart are no longer available.",
      issues: quote.rejected,
    };
  }

  let discount = 0;
  let couponCode: string | null = null;
  if (input.couponCode) {
    const check = await checkCoupon(input.couponCode, quote.subtotal);
    if (!check.ok) {
      return { ok: false, status: 400, error: check.message };
    }
    discount = computeDiscount(
      {
        type: check.coupon.type,
        value: check.coupon.value,
        maxDiscountAmount: check.coupon.maxDiscountAmount,
      },
      quote.subtotal
    );
    couponCode = check.coupon.code;
  }

  const totals = formatCartTotals(quote.subtotal, discount);
  const shipping = resolveShipping(input.shippingMethod, totals.total);
  const total = totals.total + shipping;

  const addressJson = {
    fullName: input.address.fullName,
    line1: input.address.line1,
    line2: input.address.line2?.trim() || null,
    city: input.address.city,
    region: input.address.region?.trim() || null,
    postalCode: input.address.postalCode,
    country: input.address.country,
    phone: input.address.phone?.trim() || null,
  };

  // orderNumber is unique — retry a couple of times on random collision.
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const order = await prisma.order.create({
        data: {
          orderNumber: generateOrderNumber(),
          userId,
          status: "PENDING",
          paymentStatus: "PENDING",
          subtotal: quote.subtotal,
          discount: totals.discount,
          shipping,
          total,
          shippingMethod: input.shippingMethod satisfies ShippingMethod,
          address: addressJson,
          couponCode,
          notes: input.notes?.trim() || null,
          items: {
            create: quote.lines.map((line) => ({
              productId: line.productId,
              variantId: line.variantId,
              name: line.name,
              sku: line.sku,
              variantName: line.variantName,
              unitPrice: line.unitPrice,
              quantity: line.qty,
              lineTotal: line.lineTotal,
            })),
          },
          payment: { create: { amount: total, currency: "usd", status: "PENDING" } },
        },
        select: orderSelect,
      });
      return { ok: true, order };
    } catch (error) {
      if (isUniqueViolation(error)) continue;
      throw error;
    }
  }

  return { ok: false, status: 500, error: "Unable to create your order." };
}

export type FulfillmentResult = { processed: boolean; orderId: string };

/**
 * Marks an order PAID exactly once, settles the payment, decrements stock
 * (PURCHASE inventory transactions), and records coupon usage.
 * Safe to call from the Stripe webhook and the local mock — repeat calls
 * return { processed: false } without touching stock.
 */
export async function markOrderPaid(orderId: string): Promise<FulfillmentResult> {
  return prisma.$transaction(async (tx) => {
    const claimed = await tx.order.updateMany({
      where: { id: orderId, status: "PENDING" },
      data: { status: "PAID", paymentStatus: "SUCCEEDED", paidAt: new Date() },
    });

    if (claimed.count === 0) {
      return { processed: false, orderId };
    }

    const order = await tx.order.findUnique({
      where: { id: orderId },
      select: { ...orderSelect, userId: true },
    });
    if (!order) {
      return { processed: false, orderId };
    }

    await tx.payment.update({
      where: { orderId },
      data: { status: "SUCCEEDED" },
    });

    for (const item of order.items) {
      let balanceAfter: number | null = null;

      if (item.variantId) {
        const variant = await tx.productVariant.update({
          where: { id: item.variantId },
          data: { stock: { decrement: item.quantity } },
        });
        balanceAfter = variant.stock;
      } else if (item.productId) {
        const product = await tx.product.update({
          where: { id: item.productId },
          data: { stock: { decrement: item.quantity } },
        });
        balanceAfter = product.stock;
      }

      await tx.inventoryTransaction.create({
        data: {
          productId: item.productId,
          variantId: item.variantId,
          delta: -item.quantity,
          reason: "PURCHASE",
          balanceAfter,
          note: `Order ${order.orderNumber}`,
        },
      });
    }

    if (order.couponCode) {
      const coupon = await tx.coupon.findUnique({
        where: { code: order.couponCode },
        select: { id: true },
      });
      if (coupon) {
        await tx.coupon.update({
          where: { id: coupon.id },
          data: { usedCount: { increment: 1 } },
        });
        await tx.couponUsage.create({
          data: { couponId: coupon.id, userId: order.userId, orderId: order.id },
        });
      }
    }

    return { processed: true, orderId };
  });
}
