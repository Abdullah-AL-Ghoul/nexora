import { describe, expect, it } from "vitest";

import { computeDiscount, formatCartTotals, lineTotal } from "@/lib/cart/pricing";
import { resolveShipping, FREE_SHIPPING_THRESHOLD } from "@/lib/checkout/shipping";
import { canTransition, restockOn } from "@/lib/admin/order-status";

describe("computeDiscount", () => {
  it("computes floored percent discounts on integer cents", () => {
    // 15% of 4999 = 749.85 → floored to 749
    expect(computeDiscount({ type: "PERCENT", value: 15, maxDiscountAmount: null }, 4999)).toBe(749);
    // 10% of 10000 = 1000 exactly
    expect(computeDiscount({ type: "PERCENT", value: 10, maxDiscountAmount: null }, 10_000)).toBe(1000);
  });

  it("applies fixed discounts as-is", () => {
    expect(computeDiscount({ type: "FIXED", value: 500, maxDiscountAmount: null }, 4999)).toBe(500);
  });

  it("caps at maxDiscountAmount", () => {
    expect(computeDiscount({ type: "PERCENT", value: 50, maxDiscountAmount: 1000 }, 10_000)).toBe(1000);
  });

  it("never exceeds the subtotal and never goes negative", () => {
    expect(computeDiscount({ type: "FIXED", value: 9000, maxDiscountAmount: null }, 5000)).toBe(5000);
    expect(computeDiscount({ type: "FIXED", value: 500, maxDiscountAmount: null }, 0)).toBe(0);
    expect(computeDiscount({ type: "FIXED", value: 500, maxDiscountAmount: null }, 100)).toBe(100);
  });
});

describe("cart totals", () => {
  it("computes line totals", () => {
    expect(lineTotal(1299, 3)).toBe(3897);
  });

  it("clamps discount into the totals and subtracts it", () => {
    expect(formatCartTotals(5000, 500)).toEqual({ subtotal: 5000, discount: 500, total: 4500 });
    // negative discount is treated as 0
    expect(formatCartTotals(5000, -100).discount).toBe(0);
    // discount larger than subtotal is clamped
    expect(formatCartTotals(5000, 9000).total).toBe(0);
  });
});

describe("resolveShipping", () => {
  it("charges standard below the free-shipping threshold", () => {
    expect(resolveShipping("standard", FREE_SHIPPING_THRESHOLD - 1)).toBe(990);
  });

  it("waives standard shipping at the threshold and above", () => {
    expect(resolveShipping("standard", FREE_SHIPPING_THRESHOLD)).toBe(0);
    expect(resolveShipping("standard", 500_000)).toBe(0);
  });

  it("always charges express, regardless of subtotal", () => {
    expect(resolveShipping("express", 0)).toBe(1990);
    expect(resolveShipping("express", 1_000_000)).toBe(1990);
  });
});

describe("order status transitions", () => {
  it("follows the fulfillment pipeline", () => {
    expect(canTransition("PAID", "PROCESSING")).toBe(true);
    expect(canTransition("PROCESSING", "SHIPPED")).toBe(true);
    expect(canTransition("SHIPPED", "DELIVERED")).toBe(true);
  });

  it("forbids skipping states and re-payment", () => {
    expect(canTransition("PAID", "SHIPPED")).toBe(false);
    expect(canTransition("PAID", "PENDING")).toBe(false);
    expect(canTransition("DELIVERED", "PAID")).toBe(false);
    expect(canTransition("CANCELLED", "PAID")).toBe(false);
  });

  it("allows cancellation only before shipping", () => {
    expect(canTransition("PAID", "CANCELLED")).toBe(true);
    expect(canTransition("PROCESSING", "CANCELLED")).toBe(true);
    expect(canTransition("SHIPPED", "CANCELLED")).toBe(false);
  });

  it("allows refunds only from DELIVERED", () => {
    expect(canTransition("DELIVERED", "REFUNDED")).toBe(true);
    expect(canTransition("PAID", "REFUNDED")).toBe(false);
  });

  it("restocks only on cancellation/refund targets", () => {
    expect(restockOn("CANCELLED")).toBe(true);
    expect(restockOn("REFUNDED")).toBe(true);
    expect(restockOn("SHIPPED")).toBe(false);
  });
});
