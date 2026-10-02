import { NextResponse } from "next/server";

import { canTransition, restockOn } from "@/lib/admin/order-status";
import { requireApiRole } from "@/lib/auth/api-guards";
import { STAFF_ROLES } from "@/lib/auth/guards";
import { prisma } from "@/lib/db";
import { orderStatusSchema } from "@/lib/validators/admin";

/**
 * PATCH /api/admin/orders/[id] — staff status transitions (Manager + Admin).
 *
 * - Server-enforced transition map (no skipping states, no re-payment).
 * - CANCELLED / REFUNDED return paid stock with an InventoryTransaction;
 *   cancelling an unpaid (PENDING) order touches no stock.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const gate = await requireApiRole(STAFF_ROLES);
  if ("error" in gate) return gate.error;
  const actorId = gate.session.user.id;

  const { id } = await params;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = orderStatusSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ error: "Invalid status." }, { status: 400 });
  }
  const target = parsed.data.status;

  try {
    const order = await prisma.order.findUnique({
      where: { id },
      include: { items: { select: { productId: true, variantId: true, quantity: true } } },
    });
    if (!order) {
      return NextResponse.json({ error: "Order not found." }, { status: 404 });
    }

    if (!canTransition(order.status, target)) {
      return NextResponse.json(
        { error: `Cannot move order from ${order.status} to ${target}.` },
        { status: 409 }
      );
    }

    const paidStock = order.paymentStatus === "SUCCEEDED";
    const needsRestock = restockOn(target) && paidStock;

    const updated = await prisma.$transaction(async (tx) => {
      const data: {
        status: typeof target;
        cancelledAt?: Date;
        shippedAt?: Date;
        deliveredAt?: Date;
        paymentStatus?: "REFUNDED";
      } = { status: target };

      if (target === "CANCELLED") data.cancelledAt = new Date();
      if (target === "SHIPPED") data.shippedAt = new Date();
      if (target === "DELIVERED") data.deliveredAt = new Date();
      if (restockOn(target) && paidStock) data.paymentStatus = "REFUNDED";

      const next = await tx.order.update({
        where: { id },
        data,
        select: { id: true, status: true, paymentStatus: true },
      });

      if (needsRestock) {
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
              reason: target === "CANCELLED" ? "CANCELLATION" : "RETURN",
              balanceAfter,
              note: `Order ${order.orderNumber} ${target.toLowerCase()}`,
              actorId,
            },
          });
        }
        await tx.payment.update({
          where: { orderId: order.id },
          data: { status: "REFUNDED" },
        });
      }

      return next;
    });

    return NextResponse.json({ order: updated });
  } catch {
    return NextResponse.json({ error: "Unable to update order." }, { status: 500 });
  }
}
