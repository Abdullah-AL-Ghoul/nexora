import { randomBytes } from "crypto";
import { revalidateTag } from "next/cache";

import { prisma } from "@/lib/db";
import { CATALOG_TAG, ADMIN_DASHBOARD_TAG } from "@/lib/cache";
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
 * - Fulfillment/cancellation/refund all revalidate the public catalog cache:
 *   stock and best-seller data feed storefront pages.
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

/** thrown inside the fulfillment transaction to roll everything back. */
class FulfillmentError extends Error {
  constructor(
    public code: "INSUFFICIENT_STOCK",
    message: string
  ) {
    super(message);
  }
}

/** Creates a PENDING order + PENDING payment from a fresh server quote. */
export async function createOrder(
  userId: string,
  input: CheckoutInput
): Promise<OrderSuccess | OrderFailure> {
  // Double-submit protection: an attempt with the same idempotency key
  // returns the original PENDING order instead of creating a duplicate.
  if (input.idempotencyKey) {
    const existing = await prisma.order.findUnique({
      where: { idempotencyKey: input.idempotencyKey },
      select: orderSelect,
    });
    if (existing && existing.status === "PENDING") {
      return { ok: true, order: existing };
    }
  }

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
    const check = await checkCoupon(input.couponCode, quote.subtotal, userId);
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
          idempotencyKey: input.idempotencyKey ?? null,
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
      revalidateTag(ADMIN_DASHBOARD_TAG, "max");
      return { ok: true, order };
    } catch (error) {
      // Two submissions with the same key raced past the findUnique — the
      // winner created the order, the loser returns it.
      if (
        isUniqueViolation(error) &&
        input.idempotencyKey &&
        String((error as { meta?: { target?: string[] } }).meta?.target?.[0] ?? "") ===
          "idempotencyKey"
      ) {
        const existing = await prisma.order.findUnique({
          where: { idempotencyKey: input.idempotencyKey },
          select: orderSelect,
        });
        if (existing) return { ok: true, order: existing };
      }
      if (isUniqueViolation(error)) continue;
      throw error;
    }
  }

  return { ok: false, status: 500, error: "Unable to create your order." };
}

export type FulfillmentResult = {
  processed: boolean;
  orderId: string;
  reason?: "ALREADY_PROCESSED" | "INSUFFICIENT_STOCK";
};

/**
 * Marks an order PAID exactly once, settles the payment, decrements stock
 * (PURCHASE inventory transactions), and records coupon usage.
 * Safe to call from the Stripe webhook and the local mock — repeat calls
 * return { processed: false } without touching stock.
 *
 * Stock decrements are guarded (stock >= qty). If any line cannot be
 * fulfilled the whole transaction rolls back and the order is cancelled +
 * payment marked FAILED, so money is never kept for an unfulfillable order.
 */
export async function markOrderPaid(orderId: string): Promise<FulfillmentResult> {
  try {
    return await prisma.$transaction(async (tx) => {
      const claimed = await tx.order.updateMany({
        where: { id: orderId, status: "PENDING" },
        data: { status: "PAID", paymentStatus: "SUCCEEDED", paidAt: new Date() },
      });

      if (claimed.count === 0) {
        return { processed: false, orderId, reason: "ALREADY_PROCESSED" as const };
      }

      const order = await tx.order.findUnique({
        where: { id: orderId },
        select: { ...orderSelect, userId: true },
      });
      if (!order) {
        return { processed: false, orderId, reason: "ALREADY_PROCESSED" as const };
      }

      await tx.payment.update({
        where: { orderId },
        data: { status: "SUCCEEDED" },
      });

      // Aggregate required stock decrements to minimize database round trips and locks
      const variantDeltas = new Map<string, number>();
      const productDeltas = new Map<string, number>();

      for (const item of order.items) {
        if (item.variantId) {
          variantDeltas.set(item.variantId, (variantDeltas.get(item.variantId) ?? 0) + item.quantity);
        } else if (item.productId) {
          productDeltas.set(item.productId, (productDeltas.get(item.productId) ?? 0) + item.quantity);
        }
      }

      // Sort keys deterministically to prevent deadlocks across concurrent fulfillment transactions
      const sortedVariantIds = Array.from(variantDeltas.keys()).sort();
      const sortedProductIds = Array.from(productDeltas.keys()).sort();

      const variantBalances = new Map<string, number>();
      for (const variantId of sortedVariantIds) {
        const qty = variantDeltas.get(variantId)!;
        const updated = await tx.productVariant.updateMany({
          where: { id: variantId, stock: { gte: qty } },
          data: { stock: { decrement: qty } },
        });
        if (updated.count === 0) {
          throw new FulfillmentError(
            "INSUFFICIENT_STOCK",
            `Variant ${variantId} has less stock than ${qty}`
          );
        }
        const variant = await tx.productVariant.findUnique({
          where: { id: variantId },
          select: { stock: true },
        });
        if (variant) {
          variantBalances.set(variantId, variant.stock);
        }
      }

      const productBalances = new Map<string, number>();
      for (const productId of sortedProductIds) {
        const qty = productDeltas.get(productId)!;
        const updated = await tx.product.updateMany({
          where: { id: productId, stock: { gte: qty } },
          data: { stock: { decrement: qty } },
        });
        if (updated.count === 0) {
          throw new FulfillmentError(
            "INSUFFICIENT_STOCK",
            `Product ${productId} has less stock than ${qty}`
          );
        }
        const product = await tx.product.findUnique({
          where: { id: productId },
          select: { stock: true },
        });
        if (product) {
          productBalances.set(productId, product.stock);
        }
      }

      // Batch insert inventory transactions with sequential balance tracking
      const currentVariantBalances = new Map<string, number>();
      for (const [vid, finalBal] of variantBalances) {
        currentVariantBalances.set(vid, finalBal + (variantDeltas.get(vid) ?? 0));
      }
      const currentProductBalances = new Map<string, number>();
      for (const [pid, finalBal] of productBalances) {
        currentProductBalances.set(pid, finalBal + (productDeltas.get(pid) ?? 0));
      }

      await tx.inventoryTransaction.createMany({
        data: order.items.map((item) => {
          let balanceAfter: number | null = null;
          if (item.variantId && currentVariantBalances.has(item.variantId)) {
            const nextBal = currentVariantBalances.get(item.variantId)! - item.quantity;
            currentVariantBalances.set(item.variantId, nextBal);
            balanceAfter = nextBal;
          } else if (item.productId && currentProductBalances.has(item.productId)) {
            const nextBal = currentProductBalances.get(item.productId)! - item.quantity;
            currentProductBalances.set(item.productId, nextBal);
            balanceAfter = nextBal;
          }

          return {
            productId: item.productId,
            variantId: item.variantId,
            delta: -item.quantity,
            reason: "PURCHASE" as const,
            balanceAfter,
            note: `Order ${order.orderNumber}`,
          };
        }),
      });

      if (order.couponCode) {
        const coupon = await tx.coupon.findUnique({
          where: { code: order.couponCode },
          select: { id: true, usageLimit: true, usedCount: true },
        });
        if (coupon) {
          // The limit was already validated at order creation; this is a
          // race safety net. Over-limit at fulfillment never fails a paid
          // order — it just skips the increment and is logged for review.
          if (coupon.usageLimit !== null && coupon.usedCount >= coupon.usageLimit) {
            console.error(
              `coupon ${order.couponCode} exceeded usageLimit at fulfillment (order ${order.orderNumber})`
            );
          } else {
            await tx.coupon.update({
              where: { id: coupon.id },
              data: { usedCount: { increment: 1 } },
            });
          }
          await tx.couponUsage.create({
            data: { couponId: coupon.id, userId: order.userId, orderId: order.id },
          });
        }
      }

      return { processed: true, orderId };
    });
  } catch (error) {
    if (error instanceof FulfillmentError && error.code === "INSUFFICIENT_STOCK") {
      await cancelPendingOrder(orderId);
      return { processed: false, orderId, reason: "INSUFFICIENT_STOCK" };
    }
    throw error;
  } finally {
    revalidateTag(CATALOG_TAG, "max");
    revalidateTag(ADMIN_DASHBOARD_TAG, "max");
  }
}

/**
 * Cancels a PENDING order (and its PENDING payment). Idempotent: orders in
 * any other state are left untouched. Used by the checkout route when a
 * Stripe session fails to start, and by checkout.session.expired webhooks.
 */
export async function cancelPendingOrder(orderId: string): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const claimed = await tx.order.updateMany({
      where: { id: orderId, status: "PENDING" },
      data: { status: "CANCELLED", paymentStatus: "FAILED", cancelledAt: new Date() },
    });
    if (claimed.count === 0) return false;

    await tx.payment.updateMany({
      where: { orderId, status: "PENDING" },
      data: { status: "FAILED" },
    });
    revalidateTag(CATALOG_TAG, "max");
    revalidateTag(ADMIN_DASHBOARD_TAG, "max");
    return true;
  });
}

/**
 * Marks a fulfilled (SUCCEEDED) order REFUNDED and returns the stock with
 * RETURN inventory transactions. Idempotent: repeat calls are no-ops.
 * Triggered by the charge.refunded webhook (refunds issued in Stripe).
 */
export async function refundOrder(orderId: string): Promise<boolean> {
  return prisma.$transaction(async (tx) => {
    const claimedPayment = await tx.payment.updateMany({
      where: { orderId, status: "SUCCEEDED" },
      data: { status: "REFUNDED" },
    });
    if (claimedPayment.count === 0) return false;

    const order = await tx.order.findUnique({
      where: { id: orderId },
      select: { ...orderSelect, userId: true, orderNumber: true },
    });
    if (!order) return false;

    await tx.order.update({
      where: { id: orderId },
      data: { status: "REFUNDED", paymentStatus: "REFUNDED" },
    });

    for (const item of order.items) {
      let balanceAfter: number | null = null;

      if (item.variantId) {
        const variant = await tx.productVariant.update({
          where: { id: item.variantId },
          data: { stock: { increment: item.quantity } },
        });
        balanceAfter = variant.stock;
      } else if (item.productId) {
        const product = await tx.product.update({
          where: { id: item.productId },
          data: { stock: { increment: item.quantity } },
        });
        balanceAfter = product.stock;
      }

      await tx.inventoryTransaction.create({
        data: {
          productId: item.productId,
          variantId: item.variantId,
          delta: item.quantity,
          reason: "RETURN",
          balanceAfter,
          note: `Refund of order ${order.orderNumber}`,
        },
      });
    }

    revalidateTag(CATALOG_TAG, "max");
    revalidateTag(ADMIN_DASHBOARD_TAG, "max");
    return true;
  });
}
