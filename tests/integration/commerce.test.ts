import "dotenv/config";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import { prisma } from "@/lib/db";
import {
  cancelPendingOrder,
  createOrder,
  markOrderPaid,
  refundOrder,
} from "@/lib/checkout/orders";
import { checkCoupon } from "@/lib/cart/quote";
import { resolveShipping } from "@/lib/checkout/shipping";
import type { CheckoutInput } from "@/lib/validators/checkout";

/**
 * Integration coverage for the commerce core, run against the local dev
 * database (npm run db:seed first). Every created row is cleaned up; stock
 * is restored so `npm run db:verify` invariants keep holding.
 */

const createdOrderIds: string[] = [];
let userId: string;
let product: { id: string; price: number; stock: number };

function checkoutInput(overrides?: Partial<CheckoutInput>): CheckoutInput {
  return {
    items: [{ productId: product.id, variantId: null, qty: 1 }],
    shippingMethod: "standard",
    address: {
      fullName: "Test Runner",
      line1: "1 Test Way",
      city: "Cairo",
      postalCode: "12345",
      country: "EG",
      phone: "",
    },
    couponCode: null,
    notes: null,
    ...overrides,
  };
}

async function stockOf(productId: string): Promise<number> {
  const row = await prisma.product.findUnique({
    where: { id: productId },
    select: { stock: true },
  });
  return row!.stock;
}

beforeAll(async () => {
  const user = await prisma.user.findFirst({
    where: { role: "CUSTOMER", isActive: true },
    select: { id: true },
  });
  if (!user) throw new Error("seed a customer first (npm run db:seed)");
  userId = user.id;

  const found = await prisma.product.findFirst({
    where: { status: "ACTIVE", stock: { gte: 2 } },
    select: { id: true, price: true, stock: true },
  });
  if (!found) throw new Error("no active product with stock");
  product = found;
});

afterAll(async () => {
  for (const orderId of createdOrderIds) {
    await prisma.order.delete({ where: { id: orderId } }).catch(() => undefined);
  }
  await prisma.$disconnect();
});

describe("createOrder (server-authoritative)", () => {
  it("creates a PENDING order with server-computed totals", async () => {
    const result = await createOrder(userId, checkoutInput());
    expect(result.ok).toBe(true);
    if (!result.ok) return;

    createdOrderIds.push(result.order.id);
    expect(result.order.status).toBe("PENDING");
    expect(result.order.paymentStatus).toBe("PENDING");
    // Server pricing: line from DB + resolveShipping on the discounted total.
    const expectedShipping = resolveShipping("standard", product.price);
    expect(result.order.total).toBe(product.price + expectedShipping);
    // exactly one line, priced from the DB
    expect(result.order.items).toHaveLength(1);
    expect(result.order.items[0].unitPrice).toBe(product.price);
  });

  it("returns the SAME order for a repeated idempotency key", async () => {
    const key = crypto.randomUUID();
    const first = await createOrder(userId, checkoutInput({ idempotencyKey: key }));
    const second = await createOrder(userId, checkoutInput({ idempotencyKey: key }));
    expect(first.ok && second.ok).toBe(true);
    if (!first.ok || !second.ok) return;

    createdOrderIds.push(first.order.id);
    expect(second.order.id).toBe(first.order.id);
    const count = await prisma.order.count({ where: { userId, idempotencyKey: key } });
    expect(count).toBe(1);
  });

  it("rejects empty carts and unknown products", async () => {
    const empty = await createOrder(userId, checkoutInput({ items: [] }));
    expect(empty.ok).toBe(false);
    if (!empty.ok) expect(empty.status).toBe(400);

    // A single ghost line empties the cart -> 400; a valid line plus a ghost
    // line leaves the cart non-empty -> 409 with per-line issues.
    const mixed = await createOrder(
      userId,
      checkoutInput({
        items: [
          { productId: product.id, variantId: null, qty: 1 },
          { productId: "does-not-exist", variantId: null, qty: 1 },
        ],
      })
    );
    expect(mixed.ok).toBe(false);
    if (!mixed.ok) {
      expect(mixed.status).toBe(409);
      expect(mixed.issues?.[0]?.productId).toBe("does-not-exist");
    }
  });
});

describe("markOrderPaid (fulfillment)", () => {
  it("decrements stock exactly once and is idempotent", async () => {
    const before = await stockOf(product.id);
    const order = await createOrder(userId, checkoutInput());
    expect(order.ok).toBe(true);
    if (!order.ok) return;
    createdOrderIds.push(order.order.id);

    const first = await markOrderPaid(order.order.id);
    const afterFirst = await stockOf(product.id);
    const second = await markOrderPaid(order.order.id);
    const afterSecond = await stockOf(product.id);

    expect(first.processed).toBe(true);
    expect(afterFirst).toBe(before - 1);
    expect(second.processed).toBe(false);
    expect(afterSecond).toBe(afterFirst);

    const ledger = await prisma.inventoryTransaction.count({
      where: { productId: product.id, note: { contains: order.order.orderNumber } },
    });
    expect(ledger).toBe(1);
  });

  it("rolls back and cancels the order when stock is insufficient", async () => {
    const order = await createOrder(userId, checkoutInput());
    expect(order.ok).toBe(true);
    if (!order.ok) return;
    createdOrderIds.push(order.order.id);

    // Another purchase drains stock between checkout and payment.
    const realStock = await stockOf(product.id);
    await prisma.product.update({ where: { id: product.id }, data: { stock: 0 } });

    const result = await markOrderPaid(order.order.id);
    const orderAfter = await prisma.order.findUnique({
      where: { id: order.order.id },
      select: { status: true, paymentStatus: true },
    });

    expect(result.processed).toBe(false);
    expect(result.reason).toBe("INSUFFICIENT_STOCK");
    expect(orderAfter?.status).toBe("CANCELLED");
    expect(orderAfter?.paymentStatus).toBe("FAILED");

    await prisma.product.update({ where: { id: product.id }, data: { stock: realStock } });
  });
});

describe("cancelPendingOrder / refundOrder", () => {
  it("cancels a PENDING order once and marks payment FAILED", async () => {
    const order = await createOrder(userId, checkoutInput());
    expect(order.ok).toBe(true);
    if (!order.ok) return;
    createdOrderIds.push(order.order.id);

    expect(await cancelPendingOrder(order.order.id)).toBe(true);
    expect(await cancelPendingOrder(order.order.id)).toBe(false);

    const row = await prisma.order.findUnique({
      where: { id: order.order.id },
      select: { status: true, paymentStatus: true },
    });
    expect(row?.status).toBe("CANCELLED");
    expect(row?.paymentStatus).toBe("FAILED");
  });

  it("refunds a paid order, restocks, and is idempotent", async () => {
    const before = await stockOf(product.id);
    const order = await createOrder(userId, checkoutInput());
    expect(order.ok).toBe(true);
    if (!order.ok) return;
    createdOrderIds.push(order.order.id);
    await markOrderPaid(order.order.id);

    const paidStock = await stockOf(product.id);
    expect(paidStock).toBe(before - 1);

    expect(await refundOrder(order.order.id)).toBe(true);
    expect(await refundOrder(order.order.id)).toBe(false);

    const row = await prisma.order.findUnique({
      where: { id: order.order.id },
      select: { status: true, paymentStatus: true },
    });
    expect(row?.status).toBe("REFUNDED");
    expect(row?.paymentStatus).toBe("REFUNDED");
    expect(await stockOf(product.id)).toBe(before);

    // A refunded order cannot be paid again.
    expect((await markOrderPaid(order.order.id)).processed).toBe(false);
  });
});

describe("coupon limits (server-side)", () => {
  it("enforces per-user limits across checkouts", async () => {
    const code = `TESTPL1${Date.now() % 1000}`;
    const coupon = await prisma.coupon.create({
      data: {
        code,
        type: "FIXED",
        value: 100,
        startsAt: new Date(Date.now() - 60_000),
        endsAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
        perUserLimit: 1,
        active: true,
      },
    });

    try {
      const first = await checkCoupon(code, product.price, userId);
      expect(first.ok).toBe(true);

      const order = await createOrder(userId, checkoutInput({ couponCode: code }));
      expect(order.ok).toBe(true);
      if (!order.ok) return;
      createdOrderIds.push(order.order.id);
      await markOrderPaid(order.order.id);

      // Second attempt by the same user must be rejected.
      const second = await checkCoupon(code, product.price, userId);
      expect(second.ok).toBe(false);
      if (!second.ok) expect(second.message).toMatch(/already used/i);

      // Another customer is unaffected.
      const other = await prisma.user.findFirst({
        where: { role: "CUSTOMER", isActive: true, id: { not: userId } },
        select: { id: true },
      });
      if (other) {
        const theirs = await checkCoupon(code, product.price, other.id);
        expect(theirs.ok).toBe(true);
      }
    } finally {
      await prisma.coupon.delete({ where: { id: coupon.id } }).catch(() => undefined);
    }
  });
});
