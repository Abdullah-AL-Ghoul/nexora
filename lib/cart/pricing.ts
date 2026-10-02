/**
 * Pure money math for cart & coupons (integer cents).
 * Kept side-effect free so Phase 11 unit tests can cover it directly.
 */

export type CouponSpec = {
  type: "PERCENT" | "FIXED";
  value: number;
  maxDiscountAmount: number | null;
};

/** Discount (cents) for a coupon applied to a subtotal (cents), floored at 0. */
export function computeDiscount(coupon: CouponSpec, subtotal: number): number {
  if (subtotal <= 0) return 0;

  const raw =
    coupon.type === "PERCENT"
      ? Math.floor((subtotal * coupon.value) / 100)
      : coupon.value;

  const capped =
    coupon.maxDiscountAmount !== null
      ? Math.min(raw, coupon.maxDiscountAmount)
      : raw;

  return Math.max(0, Math.min(capped, subtotal));
}

export function lineTotal(unitPrice: number, qty: number): number {
  return unitPrice * qty;
}

export function formatCartTotals(subtotal: number, discount: number) {
  const safeDiscount = Math.max(0, Math.min(discount, subtotal));
  return { subtotal, discount: safeDiscount, total: subtotal - safeDiscount };
}
